"use client";

import { useState, useCallback, useMemo, useEffect, useRef, type MouseEvent } from "react";
import { useOrgPrefs } from "@/lib/hooks/useOrgPrefs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import { useDemoGuard } from "@/lib/hooks/useDemoGuard";
import { PageHeader, Spinner, EmptyState } from "@/components/shared/ui";
import { Button, Card, Select } from "@/src/shared/ui";
import { CrmKpiCard, CustomerTierBadge } from "./components/ContactsPieces";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { PhoneLink } from "@/components/shared/phone-link";
import { formatToman, normalizeSearchText, toFaDigits } from "@/lib/utils/format";
import { History, Pencil, Plus, Search, Star, Trash2, User, Users, Wallet } from "lucide-react";
import type { Contact, ContactType } from "@/types/db";
import { Pagination, usePagination } from "@/src/shared/ui";

const TYPE_LABEL: Record<ContactType, string> = {
  customer: "مشتری",
  supplier: "تامین‌کننده",
  both: "هر دو",
};

export function ContactsPageContent({ forcedType, forcedFilter, forcedAction }: { forcedType?: ContactType; forcedFilter?: "debtors" | "creditors"; forcedAction?: "new" }) {
  /* واحد پول سازمان — تومان یا ریال، از تنظیمات. */
  const { money, unitLabel: unitWord } = useOrgPrefs();
  const { orgId, branchId } = useOrg();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | ContactType>("");
  const [balanceFilter, setBalanceFilter] = useState<"" | "debtors" | "creditors">("");
  const [sortBy, setSortBy] = useState<"name_asc" | "name_desc" | "code_asc" | "code_desc" | "balance_high" | "balance_low" | "newest">("code_desc");
  const qc = useQueryClient();
  const { openEntity } = usePanelManager();
  const { guard: demoGuard } = useDemoGuard();
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
    if (demoGuard("حذف مخاطب")) return;
    if (!confirm("آیا از حذف این شخص مطمئن هستید؟")) return;
    const supabase = createClient();
    await supabase.from("contacts").update({ is_active: false }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["contacts"] });
    qc.invalidateQueries({ queryKey: ["contact-balances"] });
  }, [qc, demoGuard]);

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

  /*
    صفحه‌بندی سمت کلاینت.
    قبل از این، هر ۵۴۳ مخاطب همزمان رندر می‌شد و ۲۵٬۴۴۷ گره DOM
    می‌ساخت؛ کاربر در هر لحظه حدود ۱۵ ردیف می‌بیند.
    جستجو و مرتب‌سازی همچنان روی کل مجموعه اجرا می‌شود.
  */
  const { paged, page, setPage, pageSize, setPageSize, totalPages } = usePagination(filtered);


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

  // شمارنده‌های نمایشی — از همان دادهٔ موجود مشتق می‌شوند، بدون کوئری جدید.
  const totalCount = contacts?.length ?? 0;
  const debtorsTotal = useMemo(
    () => (contacts ?? []).reduce((sum, c) => { const b = balances?.[c.id] ?? 0; return b > 0 ? sum + b : sum; }, 0),
    [contacts, balances]
  );
  const debtorsCount = useMemo(
    () => (contacts ?? []).filter((c) => (balances?.[c.id] ?? 0) > 0).length,
    [contacts, balances]
  );
  const creditorsCount = useMemo(
    () => (contacts ?? []).filter((c) => (balances?.[c.id] ?? 0) < 0).length,
    [contacts, balances]
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="مدیریت مشتریان (CRM)"
        subtitle="مدیریت مالی و گروه‌بندی مخاطبین"
        action={
          <Button
            onClick={() => openEntity("contact", undefined, { mode: "create", context: "workspace", title: "شخص جدید", props: { initialType: typeFilter || "customer" } })}
            icon={<Plus size={17} />}
          >
            <span className="hidden sm:inline">افزودن مشتری جدید</span>
            <span className="sm:hidden">افزودن</span>
          </Button>
        }
      />

      {/* KPI — مطابق مرجع */}
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        <CrmKpiCard label="کل مخاطبین" value={toFaDigits(totalCount)} icon={Users} tone="primary" />
        <CrmKpiCard label="بستانکاران" value={toFaDigits(creditorsCount)} chip="نفر" icon={Star} tone="accent" />
        <CrmKpiCard label="مجموع بدهی‌ها" value={money(debtorsTotal, false)} chip="بدهکار" icon={Wallet} tone="danger" />
        <CrmKpiCard label="مخاطبین بدهکار" value={toFaDigits(debtorsCount)} chip="مورد" icon={History} tone="info" />
      </div>

      {/* فهرست جامع مشتریان */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold text-foreground">فهرست جامع مشتریان</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">مدیریت مالی و گروه‌بندی مخاطبین</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
              <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input
                className="input pr-9"
                placeholder="جستجوی نام مشتری..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              className="w-32"
              aria-label="نوع مخاطب"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as ContactType | "")}
            >
              <option value="">همه</option>
              <option value="customer">مشتری</option>
              <option value="supplier">تامین‌کننده</option>
            </Select>
            <Select
              className="w-40"
              aria-label="مرتب‌سازی"
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
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="p-6"><Spinner label="در حال بارگذاری..." /></div>
        ) : !contacts || contacts.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={User} title="هنوز شخصی ثبت نشده" description="مشتری یا تامین‌کننده اضافه کنید." />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={Search} title="مشتری یافت نشد" description="فیلترها یا عبارت جستجو را تغییر دهید." />
          </div>
        ) : (
          <>
            {/* دسکتاپ — جدول، مطابق مرجع */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[820px] text-right text-sm">
                <thead className="border-y border-border bg-muted/60 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-extrabold">مشتری</th>
                    <th className="px-4 py-3 font-extrabold">شماره تماس</th>
                    <th className="px-4 py-3 font-extrabold">سطح کاربری</th>
                    <th className="px-4 py-3 text-left font-extrabold">مانده بدهی ({unitWord})</th>
                    <th className="px-4 py-3 font-extrabold">کد</th>
                    <th className="px-4 py-3 font-extrabold">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((c) => {
                    const bal = balances?.[c.id] ?? 0;
                    return (
                      <tr
                        key={c.id}
                        role="link"
                        tabIndex={0}
                        onClick={(event) => handleContactRowClick(event, c.id, c.name)}
                        onAuxClick={(event) => handleContactRowAuxClick(event, c.id)}
                        onKeyDown={(event) => { if (event.key === "Enter") openContact(c.id, c.name); }}
                        className="cursor-pointer border-b border-border transition last:border-0 hover:bg-primary/[0.03]"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-black text-primary">
                              {(c.name || "؟").trim().slice(0, 1)}
                            </div>
                            <div className="min-w-0">
                              <Link
                                href={`/contacts/${c.id}`}
                                className="block truncate font-bold text-foreground hover:text-primary hover:underline"
                                onClick={(event) => {
                                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  openContact(c.id, c.name);
                                }}
                              >
                                {c.name || "بدون نام"}
                              </Link>
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                {TYPE_LABEL[c.type]}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                          {c.phone ? <PhoneLink phone={c.phone} className="text-sm" /> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <CustomerTierBadge tier={bal > 0 ? "بدهکار" : bal < 0 ? "بستانکار" : "معمولی"} />
                        </td>
                        <td className="px-4 py-3 text-left">
                          {bal === 0 ? (
                            <span className="tabular-nums text-muted-foreground">۰</span>
                          ) : (
                            <span className={`font-extrabold tabular-nums ${bal > 0 ? "text-finance-debt" : "text-finance-credit"}`}>
                              {money(Math.abs(bal), false)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {(c as any).code ? (
                            <span className="font-mono text-xs text-primary">{(c as any).code}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                            <EntityActionMenu type="contact" id={c.id} label={c.name} phone={c.phone} />
                            <button
                              onClick={() => openEntity("contact", c.id, { mode: "edit", context: "workspace", title: c.name })}
                              aria-label={`ویرایش ${c.name}`}
                              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(c.id)}
                              aria-label={`حذف ${c.name}`}
                              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* موبایل و تبلت — کارت */}
            <ul className="divide-y divide-border lg:hidden">
              {paged.map((c) => {
                const bal = balances?.[c.id] ?? 0;
                return (
                  <li
                    key={c.id}
                    /*
                      role="link" اینجا نبود چون li داخل ul باید نقش
                      ضمنی listitem را حفظ کند؛ بازنویسی آن باعث می‌شد
                      ul هیچ فرزند معتبری نداشته باشد (ایراد serious
                      «list» در axe-core). دسترسی با کیبورد از طریق
                      tabIndex و onKeyDown حفظ شده است.
                    */
                    tabIndex={0}
                    onClick={(event) => handleContactRowClick(event, c.id, c.name)}
                    onAuxClick={(event) => handleContactRowAuxClick(event, c.id)}
                    onKeyDown={(event) => { if (event.key === "Enter") openContact(c.id, c.name); }}
                    className="flex cursor-pointer items-center justify-between gap-3 p-3.5 transition hover:bg-primary/[0.03]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-black text-primary">
                        {(c.name || "؟").trim().slice(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-foreground">{c.name || "بدون نام"}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <CustomerTierBadge tier={bal > 0 ? "بدهکار" : bal < 0 ? "بستانکار" : "معمولی"} />
                          {c.phone && (
                            <span onClick={(event) => event.stopPropagation()}>
                              <PhoneLink phone={c.phone} className="text-xs" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {bal !== 0 && (
                        <span className={`text-xs font-extrabold tabular-nums ${bal > 0 ? "text-finance-debt" : "text-finance-credit"}`}>
                          {money(Math.abs(bal), false)}
                        </span>
                      )}
                      <div onClick={(event) => event.stopPropagation()}>
                        <EntityActionMenu type="contact" id={c.id} label={c.name} phone={c.phone} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <div className="px-4 pb-3">
          <Pagination
            page={page}
            totalPages={totalPages}
            total={filtered.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
          {filtered.length !== totalCount && (
            <p className="pt-2 text-2xs text-muted-foreground">
              فیلترشده از مجموع {toFaDigits(totalCount)} مخاطب
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}


export default function ContactsPage() {
  return <ContactsPageContent />;
}
