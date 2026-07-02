"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type ContactType = "customer" | "supplier" | "both";
export type DocumentType = "sale" | "purchase";

export interface ContactEntity {
  id: string;
  org_id: string;
  branch_id: string | null;
  name: string;
  type: ContactType;
  phone: string | null;
  mobile: string | null;
  code: string | null;
  address: string | null;
  description: string | null;
  credit_limit: number;
  opening_balance: number;
  tags: string[];
  meta: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface ContactBalance {
  contact_id: string;
  total_sales: number;
  total_received: number;
  balance: number;
  last_activity_at: string | null;
}

export interface ContactWithBalance {
  contact: ContactEntity;
  balance: ContactBalance;
}

export interface ContactDocument {
  doc_id: string;
  doc_type: DocumentType;
  physical_table: "sales" | "purchases";
  contact_id: string | null;
  doc_date: string;
  subtotal: number;
  discount_amount: number;
  total: number;
  paid_amount: number;
  status: string;
  invoice_no: string | null;
}

type ContactRow = Omit<ContactEntity, "mobile" | "tags" | "meta"> & {
  tags: string[] | null;
  meta: Record<string, unknown> | null;
};

type ContactBalanceRow = {
  contact_id: string;
  total_sales: number | null;
  total_received: number | null;
  balance: number | null;
  last_activity_at: string | null;
};

type DocumentRow = Omit<ContactDocument, "invoice_no">;
type InvoiceRow = { id: string; invoice_no: string | null };

function stringFromMeta(meta: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function normalizeContact(row: ContactRow): ContactEntity {
  const meta = row.meta ?? {};
  return {
    ...row,
    tags: row.tags ?? [],
    meta,
    mobile: stringFromMeta(meta, ["mobile", "mobile_phone", "cellphone"]),
  };
}

function emptyBalance(contactId: string): ContactBalance {
  return { contact_id: contactId, total_sales: 0, total_received: 0, balance: 0, last_activity_at: null };
}

export async function getContactById(id: string): Promise<ContactWithBalance | null> {
  const supabase = createClient();
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, org_id, branch_id, name, type, phone, code, address, description, credit_limit, opening_balance, tags, meta, is_active, created_at")
    .eq("id", id)
    .maybeSingle();

  if (contactError) throw contactError;
  if (!contact) return null;

  const { data: balance, error: balanceError } = await supabase
    .from("v_contact_balance")
    .select("contact_id,total_sales,total_received,balance,last_activity_at")
    .eq("contact_id", id)
    .maybeSingle();

  if (balanceError) throw balanceError;

  const normalized = normalizeContact(contact as ContactRow);
  const balanceRow = balance as ContactBalanceRow | null;

  return {
    contact: normalized,
    balance: balanceRow
      ? {
          contact_id: balanceRow.contact_id,
          total_sales: balanceRow.total_sales ?? 0,
          total_received: balanceRow.total_received ?? 0,
          balance: balanceRow.balance ?? 0,
          last_activity_at: balanceRow.last_activity_at,
        }
      : emptyBalance(id),
  };
}

export async function getContactDocuments(id: string): Promise<ContactDocument[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_documents")
    .select("doc_id,doc_type,physical_table,contact_id,doc_date,subtotal,discount_amount,total,paid_amount,status")
    .eq("contact_id", id)
    .order("doc_date", { ascending: false });

  if (error) throw error;
  const documents = ((data ?? []) as unknown as DocumentRow[]).filter((doc): doc is DocumentRow & { doc_type: DocumentType } => doc.doc_type === "sale" || doc.doc_type === "purchase");

  const saleIds = documents.filter((doc) => doc.doc_type === "sale").map((doc) => doc.doc_id);
  const purchaseIds = documents.filter((doc) => doc.doc_type === "purchase").map((doc) => doc.doc_id);

  const invoiceMap = new Map<string, string | null>();

  if (saleIds.length > 0) {
    const { data: sales, error: salesError } = await supabase.from("sales").select("id, invoice_no").in("id", saleIds);
    if (salesError) throw salesError;
    ((sales ?? []) as InvoiceRow[]).forEach((row) => invoiceMap.set(row.id, row.invoice_no));
  }

  if (purchaseIds.length > 0) {
    const { data: purchases, error: purchasesError } = await supabase.from("purchases").select("id, invoice_no").in("id", purchaseIds);
    if (purchasesError) throw purchasesError;
    ((purchases ?? []) as InvoiceRow[]).forEach((row) => invoiceMap.set(row.id, row.invoice_no));
  }

  return documents.map((doc) => ({ ...doc, invoice_no: invoiceMap.get(doc.doc_id) ?? null }));
}

export function useContactEntity(id?: string | null) {
  return useQuery({
    queryKey: ["entity", "contact", "detail", id] as const,
    enabled: !!id,
    staleTime: 60_000,
    queryFn: () => getContactById(id!),
  });
}

export function useContactDocuments(id?: string | null) {
  return useQuery({
    queryKey: ["entity", "contact", "documents", id] as const,
    enabled: !!id,
    staleTime: 60_000,
    queryFn: () => getContactDocuments(id!),
  });
}
