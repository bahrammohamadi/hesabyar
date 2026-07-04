"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toEnglishDigits } from "@/src/shared/format";
import { useToast } from "@/src/shared/ui";

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

export interface ContactMutationInput {
  org_id?: string;
  branch_id?: string | null;
  name: string;
  type: ContactType;
  phone?: string | null;
  address?: string | null;
  description?: string | null;
  meta?: Record<string, unknown>;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  birth_date?: string | null;
  national_code?: string | null;
  job_title?: string | null;
  gender?: string | null;
}

export interface ContactUpdatePatch {
  name?: string;
  type?: ContactType;
  phone?: string | null;
  address?: string | null;
  description?: string | null;
  meta?: Record<string, unknown>;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  birth_date?: string | null;
  national_code?: string | null;
  job_title?: string | null;
  gender?: string | null;
  is_active?: boolean;
}

type ContactWritePayload = {
  name: string;
  type: ContactType;
  phone: string | null;
  address: string | null;
  description: string | null;
  meta: Record<string, unknown>;
};

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

function normalizePhone(phone?: string | null) {
  const raw = (phone ?? "").trim();
  if (!raw) return null;
  return toEnglishDigits(raw).replace(/[\s-]/g, "");
}

function validateContactInput(input: Pick<ContactMutationInput, "name" | "phone">) {
  const name = input.name.trim();
  if (!name) throw new Error("نام مخاطب الزامی است.");
  const phone = normalizePhone(input.phone);
  if (phone && !/^\+?\d{7,15}$/.test(phone)) throw new Error("شماره تماس معتبر نیست.");
  return { name, phone };
}

function toContactPayload(input: ContactMutationInput): ContactWritePayload {
  const { name, phone } = validateContactInput(input);
  const meta = { ...(input.meta ?? {}) };
  const setMeta = (key: string, value: string | null | undefined) => {
    if (value !== undefined) meta[key] = value?.trim() || null;
  };
  setMeta("first_name", input.first_name);
  setMeta("last_name", input.last_name);
  setMeta("email", input.email);
  setMeta("birth_date", input.birth_date);
  setMeta("national_code", input.national_code);
  setMeta("job_title", input.job_title);
  setMeta("gender", input.gender);
  return {
    name,
    type: input.type,
    phone,
    address: input.address?.trim() || null,
    description: input.description?.trim() || null,
    meta,
  };
}

export async function createContact(input: ContactMutationInput & { org_id: string }): Promise<ContactEntity> {
  const supabase = createClient();
  const payload = toContactPayload(input);
  const { data, error } = await supabase
    .from("contacts")
    .insert({ ...payload, org_id: input.org_id, branch_id: input.branch_id ?? null })
    .select("id, org_id, branch_id, name, type, phone, code, address, description, credit_limit, opening_balance, tags, meta, is_active, created_at")
    .single();
  if (error) throw new Error("خطا در ساخت مخاطب: " + error.message);
  return normalizeContact(data as ContactRow);
}

export async function updateContact(id: string, patch: ContactUpdatePatch): Promise<ContactEntity> {
  const supabase = createClient();
  const payload: Partial<ContactWritePayload> & { is_active?: boolean } = {};
  if (patch.name !== undefined || patch.phone !== undefined || patch.type !== undefined || patch.address !== undefined || patch.description !== undefined || patch.meta !== undefined || patch.first_name !== undefined || patch.last_name !== undefined || patch.email !== undefined || patch.birth_date !== undefined || patch.national_code !== undefined || patch.job_title !== undefined || patch.gender !== undefined) {
    const next = toContactPayload({
      name: patch.name ?? "_",
      type: patch.type ?? "customer",
      phone: patch.phone,
      address: patch.address,
      description: patch.description,
      meta: patch.meta,
      first_name: patch.first_name,
      last_name: patch.last_name,
      email: patch.email,
      birth_date: patch.birth_date,
      national_code: patch.national_code,
      job_title: patch.job_title,
      gender: patch.gender,
    });
    if (patch.name !== undefined) payload.name = next.name;
    if (patch.type !== undefined) payload.type = next.type;
    if (patch.phone !== undefined) payload.phone = next.phone;
    if (patch.address !== undefined) payload.address = next.address;
    if (patch.description !== undefined) payload.description = next.description;
    if (patch.meta !== undefined || patch.first_name !== undefined || patch.last_name !== undefined || patch.email !== undefined || patch.birth_date !== undefined || patch.national_code !== undefined || patch.job_title !== undefined || patch.gender !== undefined) payload.meta = next.meta;
  }
  if (patch.is_active !== undefined) payload.is_active = patch.is_active;

  const { data, error } = await supabase
    .from("contacts")
    .update(payload)
    .eq("id", id)
    .select("id, org_id, branch_id, name, type, phone, code, address, description, credit_limit, opening_balance, tags, meta, is_active, created_at")
    .single();
  if (error) throw new Error("خطا در ویرایش مخاطب: " + error.message);
  return normalizeContact(data as ContactRow);
}

export async function deactivateContact(id: string) {
  return updateContact(id, { is_active: false });
}

export async function reactivateContact(id: string) {
  return updateContact(id, { is_active: true });
}

function invalidateContactQueries(queryClient: ReturnType<typeof useQueryClient>, id?: string) {
  queryClient.invalidateQueries({ queryKey: ["contacts"] });
  queryClient.invalidateQueries({ queryKey: ["contact-balances"] });
  queryClient.invalidateQueries({ queryKey: ["entity", "contact"] });
  if (id) {
    queryClient.invalidateQueries({ queryKey: ["entity", "contact", "detail", id] });
    queryClient.invalidateQueries({ queryKey: ["entity", "contact", "documents", id] });
  }
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: createContact,
    onSuccess: (contact) => {
      invalidateContactQueries(queryClient, contact.id);
      toast({ title: "مخاطب ساخته شد", description: contact.name, tone: "success" });
    },
    onError: (error) => toast({ title: "خطا در ساخت مخاطب", description: (error as Error).message, tone: "error" }),
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ContactUpdatePatch }) => updateContact(id, patch),
    onSuccess: (contact) => {
      invalidateContactQueries(queryClient, contact.id);
      toast({ title: "مخاطب ذخیره شد", description: contact.name, tone: "success" });
    },
    onError: (error) => toast({ title: "خطا در ذخیره مخاطب", description: (error as Error).message, tone: "error" }),
  });
}

export function useDeactivateContact() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: deactivateContact,
    onSuccess: (contact) => {
      invalidateContactQueries(queryClient, contact.id);
      toast({ title: "مخاطب غیرفعال شد", description: contact.name, tone: "success" });
    },
    onError: (error) => toast({ title: "خطا در غیرفعال‌سازی", description: (error as Error).message, tone: "error" }),
  });
}

export function useReactivateContact() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: reactivateContact,
    onSuccess: (contact) => {
      invalidateContactQueries(queryClient, contact.id);
      toast({ title: "مخاطب فعال شد", description: contact.name, tone: "success" });
    },
    onError: (error) => toast({ title: "خطا در فعال‌سازی", description: (error as Error).message, tone: "error" }),
  });
}
