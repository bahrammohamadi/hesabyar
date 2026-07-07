"use client";

import { useState, useCallback, useMemo, useEffect, useRef, type MouseEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import { PageHeader, Spinner, EmptyState } from "@/components/shared/ui";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { PhoneLink } from "@/components/shared/phone-link";
import { formatToman, normalizeSearchText } from "@/lib/utils/format";
import { Plus, Search, User, Pencil, Trash2 } from "lucide-react";
import type { Contact, ContactType } from "@/types/db";

const TYPE_LABEL: Record<ContactType, string> = {
  customer: "مشتری",
  supplier: "تامین‌کننده",
  both: "هر دو",
};

export function ContactsPageContent({ forcedType, forcedFilter, forcedAction }: { forcedType?: ContactType; forcedFilter?: "debtors" | "creditors"; forcedAction?: "new" }) {
  const { orgId, branchId } = useOrg();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | ContactType>("");
  const [balanceFilter, setBalanceFilter] = useState<"" | "debtors" | "creditors">("");
  const [sortBy, setSortBy] = useState<"name_asc" | "name_desc" | "code_asc" | "code_desc" | "balance_high" | "balance_low" | "newest">("code_desc");
  const qc = useQueryClient();
  const { openEntity } = usePanelManager();
  const autoOpenCreateRef = useRef(false);

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["contacts", orgId, search, typeFilter],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      let q = supabase
        .from("contacts")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (search.trim()) {
        const t = normalizeSearchText(search);
        q = q.or(`name.ilike.%${t}%,phone.ilike.%${t}%,code.ilike.%${t}%`);
      }
      if (typeFilter) q = q.in("type", typeFilter === "both" ? ["both"] : [typeFilter, "both"]);
      const { data, error } = await q;
      if (error) throw error;
      return data as Contact[];
    },
  });

  // مانده حساب‌ها
  const { data: balances } = useQuery({
    queryKey: ["contact-balances", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("contact_balances")
        .select("contact_id, balance");
      if (error) throw error;
      const map: Record<string, number> = {};
      (data as { contact_id: string; balance: number }[]).forEach(
        (r) => (map[r.contact_id] = r.balance)
      );
      return map;
    },
  });

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("آیا از حذف این شخص مطمئن هستید؟")) return;
    const supabase = createClient();
    await supabase.from("contacts").update({ is_active: false }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["contacts"] });
    qc.invalidateQueries({ queryKey: ["contact-balances"] });
  }, [qc]);

  const filtered = useMemo(() => {
    let result = contacts ?? [];
    const t = normalizeSearchText(search);
    if (t) {
      result = result.filter((c) =>
        normalizeSearchText(`${c.name} ${c.phone ?? ""} ${(c as any).code ?? ""}`).includes(t)
      );
    }
    if (typeFilter) {
      result = result.filter((c) => c.type === typeFilter || c.type === "both");
    }
    if (balanceFilter) {
      result = result.filter((c) => {
        const bal = balances?.[c.id] ?? 0;
        return balanceFilter === "debtors" ? bal > 0 : bal < 0;
      });
    }
    result = [...result].sort((a, b) => {
      const balA = balances?.[a.id] ?? 0;
      const balB = balances?.[b.id] ?? 0;
      if (sortBy === "name_desc") return (b.name || "").localeCompare(a.name || "", "fa");
      if (sortBy === "code_asc") return String((a as any).code ?? "").localeCompare(String((b as any).code ?? ""), "fa", { numeric: true });
      if (sortBy === "code_desc") return String((b as any).code ?? "").localeCompare(String((a as any).code ?? ""), "fa", { numeric: true });
      if (sortBy === "balance_high") return Math.abs(balB) - Math.abs(balA);
      if (sortBy === "balance_low") return Math.abs(balA) - Math.abs(balB);
      if (sortBy === "newest") return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
      return (a.name || "").localeCompare(b.name || "", "fa");
    });
    return result;
  }, [contacts, search, typeFilter, balanceFilter, balances, sortBy]);

  useEffect(() => {
    const type = forcedType ?? (searchParams.get("type") as ContactType | null);
    const filter = forcedFilter ?? searchParams.get("filter");
    const action = forcedAction ?? searchParams.get("action");
    if (type === "customer" || type === "supplier" || type === "both") {
      setTypeFilter(type);
    } else if (!forcedType) {
      setTypeFilter("");
    }
    if (filter === "debtors" || filter === "creditors") setBalanceFilter(filter);
    else setBalanceFilter("");
    if (action === "new" && !autoOpenCreateRef.current) {
      autoOpenCreateRef.current = true;
      openEntity("contact", undefined, { mode: "create", context: "workspace", title: "شخص جدید", props: { initialType: type === "supplier" || type === "both" ? type : "customer" } });
    }
    if (action !== "new") autoOpenCreateRef.current = false;
  }, [searchParams, forcedType, forcedFilter, forcedAction, openEntity]);

  function openContact(id: string, name?: string | null) {
    openEntity("contact", id, { mode: "view", context: "workspace", title: name ?? undefined });
  }

  function handleContactRowClick(event: MouseEvent<HTMLElement>, id: string, name?: string | null) {
    if (event.defaultPrevented) return;
    const href = `/contacts/${id}`;
    if (event.metaKey || event.ctrlKey) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    openContact(id, name);
  }

  function handleContactRowAuxClick(event: MouseEvent<HTMLElement>, id: string) {
    if (event.button === 1) {
      event.preventDefault();
      window.open(`/contacts/${id}`, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div>
      <PageHeader
        title="اشخاص"
        subtitle="مشتری‌ها و تامین‌کننده‌ها"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => openEntity("contact", undefined, { mode: "create", context: "workspace", title: "شخص جدید", props: { initialType: typeFilter || "customer" } })}
              className="btn-primary"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">شخص جدید</span>
            </button>
          </div>
        }
      />

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            className="input pr-10"
            placeholder="جستجوی نام..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input w-32 sm:w-36"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ContactType | "")}
        >
          <option value="">همه</option>
          <option value="customer">مشتری</option>
          <option value="supplier">تامین‌کننده</option>
        </select>
        <select
          className="input w-36 sm:w-44"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
        >
          <option value="code_desc">جدیدترین بر اساس کد</option>
          <option value="code_asc">قدیمی‌ترین بر اساس کد</option>
          <option value="newest">جدیدترین بر اساس تاریخ ثبت</option>
          <option value="name_asc">نام A-Z</option>
          <option value="name_desc">نام Z-A</option>
          <option value="balance_high">مانده بیشتر</option>
          <option value="balance_low">مانده کمتر</option>
        </select>
      </div>

      {isLoading ? (
        <Spinner label="در حال بارگذاری..." />
      ) : !contacts || contacts.length === 0 ? (
        <EmptyState title="هنوز شخصی ثبت نشده" description="مشتری یا تامین‌کننده اضافه کنید." />
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const bal = balances?.[c.id] ?? 0;
            return (
              <div
                key={c.id}
                role="link"
                tabIndex={0}
                onClick={(event) => handleContactRowClick(event, c.id, c.name)}
                onAuxClick={(event) => handleContactRowAuxClick(event, c.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") openContact(c.id, c.name);
                }}
                className="card p-4 flex items-center justify-between gap-3 cursor-pointer border-white/80 bg-white/90 shadow-sm shadow-slate-900/[0.03] transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-slate-900/[0.06]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 text-base font-black shadow-sm">
                    {(c.name || "؟").trim().slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <Link
                      href={`/contacts/${c.id}`}
                      className="block truncate font-semibold text-primary hover:underline"
                      onClick={(event) => {
                        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
                        event.preventDefault();
                        event.stopPropagation();
                        openContact(c.id, c.name);
                      }}
                    >
                      {c.name || "بدون نام"}
                    </Link>
                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                      {(c as any).code && <span className="font-mono text-primary">{(c as any).code}</span>}
                      <span className="badge bg-slate-100 text-slate-500">{TYPE_LABEL[c.type]}</span>
                      {c.phone && <span onClick={(event) => event.stopPropagation()}><PhoneLink phone={c.phone} className="text-xs" /></span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-left">
                    {bal !== 0 && (
                      <span
                        className={`text-sm font-medium ${
                          bal > 0 ? "text-rose-600" : "text-emerald-600"
                        }`}
                      >
                        {bal > 0 ? "بدهکار " : "بستانکار "}
                        {formatToman(Math.abs(bal), false)}
                      </span>
                    )}
                  </div>
                  <div onClick={(event) => event.stopPropagation()}>
                    <EntityActionMenu type="contact" id={c.id} label={c.name} phone={c.phone} />
                  </div>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      openEntity("contact", c.id, { mode: "edit", context: "workspace", title: c.name });
                    }}
                    className="text-slate-400 hover:text-primary p-1"
                  >
                    <Pencil size={17} />
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDelete(c.id);
                    }}
                    className="text-slate-400 hover:text-rose-600 p-1"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}


export default function ContactsPage() {
  return <ContactsPageContent />;
}
