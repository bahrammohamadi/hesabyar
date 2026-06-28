"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { Modal } from "@/components/shared/ui";
import { Search, User, X, UserPlus, Loader2, Phone } from "lucide-react";
import type { ContactType } from "@/types/db";

export interface SelectableContact {
  id: string;
  name: string;
  phone: string | null;
  type: ContactType;
}

/**
 * انتخابگر حرفه‌ای مشتری/تامین‌کننده — جستجو + ایجاد سریع بدون خروج از صفحه.
 */
export function ContactSelector({
  open,
  onClose,
  onSelect,
  filterType = "customer",
  title = "انتخاب مشتری",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (c: SelectableContact) => void;
  filterType?: "customer" | "supplier";
  title?: string;
}) {
  const { orgId, branchId } = useOrg();
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["all-contacts", orgId, filterType],
    enabled: !!orgId && open,
    queryFn: async (): Promise<SelectableContact[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, phone, type")
        .eq("is_active", true)
        .in("type", [filterType, "both"])
        .order("name")
        .limit(5000);
      if (error) throw error;
      return (data as SelectableContact[]) ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!contacts) return [];
    const t = term.trim().toLowerCase();
    if (!t) return contacts.slice(0, 200);
    return contacts
      .filter((c) => `${c.name} ${c.phone ?? ""}`.toLowerCase().includes(t))
      .slice(0, 200);
  }, [contacts, term]);

  // فرم ایجاد سریع
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createContact() {
    setError(null);
    if (!newName.trim()) {
      setError("نام الزامی است.");
      return;
    }
    if (!orgId) return;
    setSaving(true);
    const supabase = createClient();
    const { data, error: e } = await supabase
      .from("contacts")
      .insert({
        org_id: orgId,
        branch_id: branchId,
        name: newName.trim(),
        phone: newPhone.trim() || null,
        type: filterType,
      })
      .select("id, name, phone, type")
      .single();
    if (e) {
      setError("خطا: " + e.message);
      setSaving(false);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["all-contacts"] });
    await qc.invalidateQueries({ queryKey: ["contacts"] });
    setSaving(false);
    onSelect(data as SelectableContact);
  }

  // پیش‌پرکردن نام از عبارت جستجو
  function openCreate() {
    setNewName(term);
    setNewPhone("");
    setCreating(true);
  }

  return (
    <Modal open={open} onClose={onClose} title={creating ? "مشتری جدید" : title} size="md" mobileFullscreen>
      {creating ? (
        <div className="space-y-4">
          <div>
            <label className="label">نام *</label>
            <input className="input" autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div>
            <label className="label">شماره تماس</label>
            <input
              className="input text-left"
              dir="ltr"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
          </div>
          {error && <div className="rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-3">{error}</div>}
          <div className="flex gap-2">
            <button onClick={createContact} disabled={saving} className="btn-primary flex-1">
              {saving && <Loader2 className="animate-spin" size={18} />}
              ثبت و انتخاب
            </button>
            <button onClick={() => setCreating(false)} className="btn-secondary">
              بازگشت
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              ref={inputRef}
              className="input pr-10"
              placeholder="جستجو: نام یا شماره تماس..."
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
            {term && (
              <button onClick={() => setTerm("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <X size={16} />
              </button>
            )}
          </div>

          <button onClick={openCreate} className="btn-secondary w-full justify-center border-dashed">
            <UserPlus size={18} />
            ایجاد {filterType === "customer" ? "مشتری" : "تامین‌کننده"} جدید
            {term && ` («${term}»)`}
          </button>

          <div className="text-xs text-slate-400">
            {isLoading ? "در حال بارگذاری..." : `${filtered.length} مورد`}
          </div>

          <div className="max-h-[45vh] overflow-y-auto space-y-1.5">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelect(c)}
                className="w-full text-right rounded-xl border border-slate-100 hover:border-brand-300 hover:bg-brand-50/40 p-3 transition flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                  <User size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm text-slate-800 truncate">{c.name || "بدون نام"}</div>
                  {c.phone && (
                    <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5" dir="ltr">
                      <Phone size={11} /> {c.phone}
                    </div>
                  )}
                </div>
              </button>
            ))}
            {filtered.length === 0 && !isLoading && (
              <div className="text-center text-sm text-slate-400 py-8">موردی یافت نشد.</div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
