"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getContactById, type ContactWithBalance } from "./contact-service";

export type InvoiceDocType = "sale" | "purchase";

export interface DocumentEntity {
  doc_id: string;
  doc_type: InvoiceDocType;
  physical_table: "sales" | "purchases";
  contact_id: string | null;
  doc_date: string;
  subtotal: number;
  discount_amount: number;
  total: number;
  paid_amount: number;
  status: string;
  invoice_no: string | null;
  note: string | null;
}

export interface DocumentLine {
  line_id: string;
  doc_id: string;
  doc_type: InvoiceDocType;
  product_id: string | null;
  product_variant_id: string | null;
  product_name: string;
  product_code: string | null;
  sku: string | null;
  barcode: string | null;
  variant_label: string;
  qty: number;
  unit_price: number;
  discount: number;
  line_total: number;
}

export interface DocumentBalance {
  doc_type: InvoiceDocType;
  doc_id: string;
  total: number;
  paid_amount: number;
  remaining: number;
  payment_status: "unpaid" | "partial" | "paid";
}

export interface InvoiceEntityData {
  document: DocumentEntity;
  lines: DocumentLine[];
  balance: DocumentBalance | null;
  contact: ContactWithBalance | null;
}

type DocumentViewRow = Omit<DocumentEntity, "invoice_no" | "note" | "doc_type" | "physical_table"> & {
  doc_type: string;
  physical_table: string;
};

type PhysicalDocRow = { id: string; invoice_no: string | null; note: string | null };

type DocumentLineRow = {
  line_id: string;
  doc_id: string;
  doc_type: string;
  product_id: string | null;
  product_variant_id: string | null;
  qty: number | string;
  unit_price: number;
  discount: number;
  line_total: number;
};

type VariantRow = {
  id: string;
  product_id: string | null;
  color: string | null;
  size: string | null;
  sku: string | null;
  barcode: string | null;
};

type ProductRow = { id: string; name: string; code: string | null };

function assertDocType(docType: string): InvoiceDocType {
  if (docType !== "sale" && docType !== "purchase") throw new Error("نوع سند نامعتبر است.");
  return docType;
}

export async function getDocumentById(docType: InvoiceDocType, id: string): Promise<DocumentEntity | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_documents")
    .select("doc_id,doc_type,physical_table,contact_id,doc_date,subtotal,discount_amount,total,paid_amount,status")
    .eq("doc_type", docType)
    .eq("doc_id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const viewRow = data as unknown as DocumentViewRow;
  const table = docType === "sale" ? "sales" : "purchases";
  const { data: physical, error: physicalError } = await supabase
    .from(table)
    .select("id, invoice_no, note")
    .eq("id", id)
    .maybeSingle();

  if (physicalError) throw physicalError;
  const physicalRow = physical as PhysicalDocRow | null;

  return {
    ...viewRow,
    doc_type: assertDocType(viewRow.doc_type),
    physical_table: docType === "sale" ? "sales" : "purchases",
    invoice_no: physicalRow?.invoice_no ?? null,
    note: physicalRow?.note ?? null,
  };
}

export async function getDocumentLines(docType: InvoiceDocType, id: string): Promise<DocumentLine[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_document_lines")
    .select("line_id,doc_id,doc_type,product_id,product_variant_id,qty,unit_price,discount,line_total")
    .eq("doc_type", docType)
    .eq("doc_id", id);

  if (error) throw error;
  const rows = ((data ?? []) as unknown as DocumentLineRow[]).filter((row) => row.doc_type === docType);

  const variantIds = rows.map((row) => row.product_variant_id).filter((value): value is string => !!value);
  const productIdsFromView = rows.map((row) => row.product_id).filter((value): value is string => !!value);

  const variantsById = new Map<string, VariantRow>();
  const productIds = new Set<string>(productIdsFromView);

  if (variantIds.length > 0) {
    const { data: variants, error: variantsError } = await supabase
      .from("product_variants")
      .select("id,product_id,color,size,sku,barcode")
      .in("id", variantIds);
    if (variantsError) throw variantsError;
    ((variants ?? []) as VariantRow[]).forEach((variant) => {
      variantsById.set(variant.id, variant);
      if (variant.product_id) productIds.add(variant.product_id);
    });
  }

  const productsById = new Map<string, ProductRow>();
  if (productIds.size > 0) {
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id,name,code")
      .in("id", Array.from(productIds));
    if (productsError) throw productsError;
    ((products ?? []) as ProductRow[]).forEach((product) => productsById.set(product.id, product));
  }

  return rows.map((row) => {
    const variant = row.product_variant_id ? variantsById.get(row.product_variant_id) ?? null : null;
    const productId = row.product_id ?? variant?.product_id ?? null;
    const product = productId ? productsById.get(productId) ?? null : null;
    const variantLabel = [variant?.color, variant?.size].filter(Boolean).join(" / ") || variant?.sku || variant?.barcode || "ساده";
    return {
      line_id: row.line_id,
      doc_id: row.doc_id,
      doc_type: assertDocType(row.doc_type),
      product_id: productId,
      product_variant_id: row.product_variant_id,
      product_name: product?.name ?? "کالا",
      product_code: product?.code ?? null,
      sku: variant?.sku ?? null,
      barcode: variant?.barcode ?? null,
      variant_label: variantLabel,
      qty: Number(row.qty ?? 0),
      unit_price: row.unit_price ?? 0,
      discount: row.discount ?? 0,
      line_total: row.line_total ?? 0,
    };
  });
}

export async function getDocumentBalance(docType: InvoiceDocType, id: string): Promise<DocumentBalance | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_document_balance")
    .select("doc_type,doc_id,total,paid_amount,remaining,payment_status")
    .eq("doc_type", docType)
    .eq("doc_id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as DocumentBalance;
  return { ...row, doc_type: assertDocType(row.doc_type) };
}

export async function getDocumentContact(contactId?: string | null) {
  if (!contactId) return null;
  return getContactById(contactId);
}

export async function getInvoiceEntity(docType: InvoiceDocType, id: string): Promise<InvoiceEntityData | null> {
  const document = await getDocumentById(docType, id);
  if (!document) return null;
  const [lines, balance, contact] = await Promise.all([
    getDocumentLines(docType, id),
    getDocumentBalance(docType, id),
    getDocumentContact(document.contact_id),
  ]);
  return { document, lines, balance, contact };
}

export function useDocumentEntity(docType?: InvoiceDocType | null, id?: string | null) {
  return useQuery({
    queryKey: ["entity", "invoice", docType, "detail", id] as const,
    enabled: !!docType && !!id,
    staleTime: 60_000,
    queryFn: () => getInvoiceEntity(docType!, id!),
  });
}
