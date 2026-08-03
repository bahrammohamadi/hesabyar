"use client";

import { useState, type MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import { PageHeader, Spinner, EmptyState } from "@/components/shared/ui";
import { DateRangeFilter, EMPTY_RANGE, applyRange, hasRange, type DateRange } from "@/src/shared/ui";
import { DataTable, type Column } from "@/src/shared/ui";
import { EntityLink } from "@/components/shared/entity-link";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { formatToman, toJalali } from "@/lib/utils/format";
import { Plus } from "lucide-react";
import Link from "next/link";


export default function PurchasesPage() {
  const { orgId } = useOrg();
  const { openDocument } = usePanelManager();

  const [range, setRange] = useState<DateRange>(EMPTY_RANGE);

  const { data: purchases, isLoading } = useQuery({
    // بازه در کلید کش تا تغییرش داده را دوباره از سرور بیاورد.
    queryKey: ["purchases-list", orgId, range.from, range.to],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      /*
        فیلتر سمت سرور، نه روی آرایه: کوئری limit دارد و فیلتر محلی
        فقط همان ردیف‌های آخر را می‌دید.
      */
      const base = supabase
        .from("purchases")
        .select("id, invoice_no, date, total, paid, supplier_id, supplier:contacts(name)")
        .order("date", { ascending: false })
        .limit(hasRange(range) ? 500 : 50);

      // همان اصلاحِ /sales: ستون timestamptz است، پس lt(روز بعد).
      const { data, error } = await applyRange(base, "date", range);
      if (error) throw error;
      return data as unknown as {
        id: string;
        invoice_no: string;
        date: string;
        total: number;
        paid: number;
        supplier_id: string | null;
        supplier: { name: string } | null;
      }[];
    },
  });

  function openPurchase(id: string) {
    openDocument("purchase", id, { mode: "view", context: "workspace" });
  }

  /*
    همان مسیر فروش: پنل مشترک باز می‌شود، نه Modal محلی.

    مودال قبلی (۲۰۰ خط، PurchaseModal) حذف شد. نداشت: بارکدخوان،
    ورود صوتی، انتخاب تاریخ، تخفیف، تفکیک نقدی/کارتی — و چیدمان
    موبایلش با فروش فرق داشت.
  */
  function openNewPurchase() {
    openDocument("purchase", undefined, { mode: "create", context: "workspace" });
  }

  function handlePurchaseRowClick(event: MouseEvent<HTMLElement>, id: string) {
    if (event.defaultPrevented) return;
    const href = `/purchases/${id}`;
    if (event.metaKey || event.ctrlKey) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    openPurchase(id);
  }

  function handlePurchaseRowAuxClick(event: MouseEvent<HTMLElement>, id: string) {
    if (event.button === 1) {
      event.preventDefault();
      window.open(`/purchases/${id}`, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div>
      <PageHeader
        title="خرید"
        subtitle="ثبت فاکتور خرید از تامین‌کننده‌ها"
        action={
          // برچسب زیر sm پنهان می‌شود، پس نام دسترس‌پذیر صریح لازم است.
          <button onClick={openNewPurchase} aria-label="خرید جدید" className="btn-primary">
            <Plus size={18} />
            <span className="hidden sm:inline">خرید جدید</span>
          </button>
        }
      />

      <div className="mb-4 rounded-2xl border border-border bg-card p-3.5 sm:p-4">
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      {isLoading ? (
        <Spinner />
      ) : !purchases || purchases.length === 0 ? (
        <EmptyState
          title="هنوز خریدی ثبت نشده"
          description="با ثبت فاکتور خرید، موجودی کالاها خودکار افزایش می‌یابد."
          action={
            <button onClick={openNewPurchase} className="btn-primary">
              <Plus size={18} /> خرید جدید
            </button>
          }
        />
      ) : (
        <DataTable
          rows={purchases}
          keyExtractor={(p) => p.id}
          className="bg-white/90"
          getRowProps={(p) => ({
            role: "link",
            tabIndex: 0,
            onClick: (event) => handlePurchaseRowClick(event, p.id),
            onAuxClick: (event) => handlePurchaseRowAuxClick(event, p.id),
            onKeyDown: (event) => { if (event.key === "Enter") openPurchase(p.id); },
            className: "cursor-pointer odd:bg-white even:bg-muted/60 hover:bg-primary/[0.06] hover:shadow-sm",
          })}
          columns={[
            {
              key: "invoice_no",
              header: "شماره",
              render: (p) => (
                <Link
                  href={`/purchases/${p.id}`}
                  className="font-medium text-primary hover:underline"
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
                    event.preventDefault();
                    event.stopPropagation();
                    openPurchase(p.id);
                  }}
                >
                  {p.invoice_no}
                </Link>
              ),
            },
            { key: "date", header: "تاریخ", render: (p) => <span className="text-muted-foreground">{toJalali(p.date)}</span> },
            {
              key: "supplier",
              header: "تامین‌کننده",
              render: (p) => p.supplier_id ? (
                <div className="flex items-center gap-2">
                  <EntityLink type="contact" id={p.supplier_id}>{p.supplier?.name ?? "تامین‌کننده"}</EntityLink>
                  <span onClick={(event) => event.stopPropagation()}><EntityActionMenu type="contact" id={p.supplier_id} label={p.supplier?.name ?? "تامین‌کننده"} /></span>
                </div>
              ) : <span className="text-muted-foreground">—</span>,
            },
            { key: "total", header: "مبلغ", align: "left", render: (p) => <span className="font-semibold tabular-nums">{formatToman(p.total)}</span> },
            { key: "paid", header: "پرداخت‌شده", align: "left", render: (p) => <span className="tabular-nums">{formatToman(p.paid)}</span> },
          ] satisfies Column<(typeof purchases)[number]>[]}
        />
      )}

    </div>
  );
}
