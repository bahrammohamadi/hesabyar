"use client";

import { useState, type MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import { PageHeader, Spinner } from "@/components/shared/ui";
import { DataTable, type Column } from "@/src/shared/ui";
import { EntityLink } from "@/components/shared/entity-link";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { formatToman, toFaDigits, toJalali } from "@/lib/utils/format";
import { Plus, ShoppingCart } from "lucide-react";
import Link from "next/link";

export default function SalesPage() {
  const { orgId } = useOrg();
  const { openDocument } = usePanelManager();

  /*
    همان مسیر داشبورد: پنل مشترک باز می‌شود، نه یک Modal محلی.
    ابطال کش پس از بسته‌شدن پنل، از طریق onCreated داخل فرم انجام
    می‌شود؛ اینجا لازم نیست.
  */
  function openNewSale() {
    openDocument("sale", undefined, { mode: "create", context: "workspace" });
  }

  const { data: sales, isLoading } = useQuery({
    queryKey: ["sales-list", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("sales")
        .select("id, invoice_no, date, total, paid_credit, status, customer_id, customer:contacts(name)")
        .order("date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as unknown as {
        id: string;
        invoice_no: string;
        date: string;
        total: number;
        paid_credit: number;
        status: string;
        customer_id: string | null;
        customer: { name: string } | null;
      }[];
    },
  });

  function openSale(id: string) {
    openDocument("sale", id, { mode: "view", context: "workspace" });
  }

  function handleSaleRowClick(event: MouseEvent<HTMLElement>, id: string) {
    if (event.defaultPrevented) return;
    const href = `/sales/${id}`;
    if (event.metaKey || event.ctrlKey) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    openSale(id);
  }

  function handleSaleRowAuxClick(event: MouseEvent<HTMLElement>, id: string) {
    if (event.button === 1) {
      event.preventDefault();
      window.open(`/sales/${id}`, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div>
      <PageHeader
        title="فروش"
        subtitle="صدور فاکتور و مدیریت فروش"
        action={
          <button onClick={openNewSale} className="btn-primary">
            <Plus size={18} />
            <span className="hidden sm:inline">فروش جدید</span>
          </button>
        }
      />

      {isLoading ? (
        <Spinner />
      ) : !sales || sales.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/[0.06] text-primary flex items-center justify-center mx-auto mb-4">
            <ShoppingCart size={26} />
          </div>
          <p className="font-semibold text-foreground">هنوز فروشی ثبت نشده</p>
          <p className="mt-1 text-sm text-muted-foreground">اولین فاکتور فروش خود را صادر کنید.</p>
          <button onClick={openNewSale} className="btn-primary mt-4 mx-auto">
            <Plus size={18} /> فروش جدید
          </button>
        </div>
      ) : (
        <DataTable
          rows={sales}
          keyExtractor={(s) => s.id}
          className="bg-white/90"
          getRowProps={(s) => ({
            role: "link",
            tabIndex: 0,
            onClick: (event) => handleSaleRowClick(event, s.id),
            onAuxClick: (event) => handleSaleRowAuxClick(event, s.id),
            onKeyDown: (event) => { if (event.key === "Enter") openSale(s.id); },
            className: "cursor-pointer odd:bg-card even:bg-muted/40 hover:bg-primary/[0.06] hover:shadow-sm",
          })}
          columns={[
            {
              key: "invoice_no",
              mobile: "title",
              header: "شماره فاکتور",
              render: (s) => (
                <Link
                  href={`/sales/${s.id}`}
                  className="font-medium text-primary hover:underline"
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
                    event.preventDefault();
                    event.stopPropagation();
                    openSale(s.id);
                  }}
                >
                  {s.invoice_no}
                </Link>
              ),
            },
            { key: "date", header: "تاریخ", mobile: "subtitle", render: (s) => <span className="tabular-nums text-muted-foreground">{toJalali(s.date)}</span> },
            {
              key: "customer",
              header: "مشتری",
              render: (s) => s.customer_id ? (
                <div className="flex items-center gap-2">
                  <EntityLink type="contact" id={s.customer_id}>{s.customer?.name ?? "مشتری"}</EntityLink>
                  <span onClick={(event) => event.stopPropagation()}><EntityActionMenu type="contact" id={s.customer_id} label={s.customer?.name ?? "مشتری"} /></span>
                </div>
              ) : <span className="text-muted-foreground">مشتری نقدی</span>,
            },
            { key: "total", header: "مبلغ", align: "left", mobile: "amount", render: (s) => <span className="font-semibold tabular-nums">{formatToman(s.total)}</span> },
            { key: "credit", header: "نسیه", render: (s) => s.paid_credit > 0 ? <span className="font-bold tabular-nums text-finance-debt">{formatToman(s.paid_credit, false)}</span> : <span className="text-muted-foreground">—</span> },
            { key: "status", header: "وضعیت", render: (s) => <span className="badge bg-info-soft text-info-text border border-info/20">{s.status === "settled" ? "تسویه‌شده" : s.status === "reversed" ? "برگشت‌خورده" : "ثبت‌شده"}</span> },
          ] satisfies Column<(typeof sales)[number]>[]}
        />
      )}

    </div>
  );
}

