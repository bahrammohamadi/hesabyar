"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { Modal } from "@/components/shared/ui";
import { Search, User, X, UserPlus } from "lucide-react";
import { PhoneLink } from "@/components/shared/phone-link";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
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
  const { orgId } = useOrg();
  const { openEntityForResult } = usePanelManager();
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

  // باز کردن فرم کامل ContactPanel و دریافت نتیجه بعد از ذخیره
  async function openCreate() {
    if (!orgId || creating) return;
    setCreating(true);
    // روی موبایل اگر انتخابگر زیر پنل باز بماند، می‌تواند فوکوس/لمس inputهای پنل را مختل کند.
    // اول انتخابگر را می‌بندیم و سپس پنل کامل را برای نتیجه باز می‌کنیم.
    onClose();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    const result = await openEntityForResult("contact", {
      mode: "create",
      context: "picker",
      title: filterType === "supplier" ? "تأمین‌کننده جدید" : "مشتری جدید",
      props: { initialName: term, initialType: filterType },
    });
    setCreating(false);
    if (result?.id) {
      const data = result.data as { name?: string; phone?: string | null; type?: ContactType } | undefined;
      onSelect({
        id: result.id,
        name: data?.name ?? result.title ?? "مخاطب جدید",
        phone: data?.phone ?? null,
        type: data?.type ?? filterType,
      });
      setTerm("");
      onClose();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="md" mobileFullscreen>
        <div className="flex h-full min-h-0 flex-col gap-3">
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

          <button onClick={openCreate} disabled={creating} className="btn-secondary w-full justify-center border-dashed disabled:opacity-60">
            <UserPlus size={18} />
            {creating ? "در حال باز کردن فرم..." : `ایجاد ${filterType === "customer" ? "مشتری" : "تامین‌کننده"} جدید`}
            {term && ` («${term}»)`}
          </button>

          <div className="text-xs text-slate-400">
            {isLoading ? "در حال بارگذاری..." : `${filtered.length} مورد`}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto space-y-1.5 pb-3">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="w-full rounded-xl border border-slate-100 hover:border-primary/30 hover:bg-primary/[0.04] p-3 transition flex items-center gap-3"
              >
                <button
                  type="button"
                  onClick={() => onSelect(c)}
                  className="min-w-0 flex-1 text-right flex items-center gap-3"
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                    <User size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm text-slate-800 truncate">{c.name || "بدون نام"}</div>
                    {c.phone && <div className="text-xs text-slate-400 mt-0.5">برای انتخاب روی نام بزنید</div>}
                  </div>
                </button>
                {c.phone && <PhoneLink phone={c.phone} className="shrink-0 text-xs" />}
              </div>
            ))}
            {filtered.length === 0 && !isLoading && (
              <div className="text-center text-sm text-slate-400 py-8">موردی یافت نشد.</div>
            )}
          </div>
        </div>
    </Modal>
  );
}
