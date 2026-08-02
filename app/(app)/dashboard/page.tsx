"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import { Modal } from "@/src/shared/ui";
import { Spinner } from "@/components/shared/ui";
import { EntityLink } from "@/components/shared/entity-link";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { PhoneLink } from "@/components/shared/phone-link";
import { formatToman, toFaDigits, tomanToRial, toEnDigits, toJalali } from "@/lib/utils/format";
import type { DashboardSummary } from "@/types/db";
import Link from "next/link";
import { ArrowUpFromLine, Loader2, Package2, Plus } from "lucide-react";
import {
  DashboardQuickActions,
  DashboardRecentInvoices,
  DashboardSalesChart,
  DashboardStats,
  DashboardStockAlert,
  DashboardTopProducts,
} from "./components";
import { useTopProducts } from "@/src/core/services/reports-service";

export default function DashboardPage() {
  const { orgId, loading: orgLoading } = useOrg();
  const { openDocument, openEntity } = usePanelManager();
  const [quickExpenseOpen, setQuickExpenseOpen] = useState(false);

  /*
    ساخت فاکتور از طریق panel-manager انجام می‌شود، نه یک Modal محلی.
    این تضمین می‌کند داشبورد و فهرست فروش دقیقاً یک UI را باز کنند.
  */
  function openNewSale() {
    openDocument("sale", undefined, { mode: "create", context: "dashboard" });
  }
  const [quickReceiptOpen, setQuickReceiptOpen] = useState(false);

  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<DashboardSummary> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("dashboard_summary", {
        p_org: orgId,
      });
      if (error) throw error;
      return data as DashboardSummary;
    },
  });

  const chartQuery = useQuery({
    queryKey: ["sales-chart", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("sales_chart_30d", {
        p_org: orgId,
      });
      if (error) throw error;
      return (data as { day: string; total: number }[]).map((d) => ({
        day: toJalali(d.day).slice(5),
        total: Math.round(d.total / 10),
      }));
    },
  });

  const { data: recentSales } = useQuery({
    queryKey: ["recent-sales", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("sales")
        .select("id, invoice_no, date, total, customer_id, customer:contacts(name)")
        .eq("status", "confirmed")
        .order("date", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const { data: lowStockItems } = useQuery({
    queryKey: ["dashboard-low-stock", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("product_variants")
        .select("id, color, size, stock_qty, product:products!inner(id, name, low_stock_threshold)")
        .eq("is_active", true)
        .limit(5000);
      return ((data as any[]) ?? [])
        .map((v) => ({
          variant_id: v.id,
          product_id: v.product?.id ?? null,
          product_name: v.product?.name ?? "",
          color: v.color,
          size: v.size,
          stock_qty: v.stock_qty,
          low_stock_threshold: v.product?.low_stock_threshold ?? 0,
        }))
        .filter((v) => v.stock_qty <= v.low_stock_threshold)
        .slice(0, 5);
    },
  });

  // هوک موجود گزارش‌ها — کوئری جدیدی ساخته نشده است.
  const topProductsQuery = useTopProducts(5);

  if (orgLoading || summaryQuery.isLoading) {
    return <Spinner label="در حال بارگذاری داشبورد..." />;
  }

  const s = summaryQuery.data;

  function openRecentSale(id: string) {
    openDocument("sale", id, { mode: "view", context: "dashboard" });
  }

  function handleRecentSaleClick(event: MouseEvent<HTMLElement>, id: string) {
    if (event.defaultPrevented) return;
    const href = `/sales/${id}`;
    if (event.metaKey || event.ctrlKey) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    openRecentSale(id);
  }

  function handleRecentSaleAuxClick(event: MouseEvent<HTMLElement>, id: string) {
    if (event.button === 1) {
      event.preventDefault();
      window.open(`/sales/${id}`, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="space-y-4">
      {/* هدر */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">داشبورد</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">مرکز کنترل و تحلیل لحظه‌ای کسب‌وکار</p>
        </div>
        {/* برچسب زیر sm پنهان می‌شود، پس نام دسترس‌پذیر باید صریح باشد. */}
        <button
          onClick={openNewSale}
          aria-label="فروش جدید"
          className="btn-primary shadow-md shadow-primary/20 transition-shadow hover:shadow-primary/30"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">فروش جدید</span>
          <span className="hidden rounded bg-primary-foreground px-1.5 py-0.5 text-2xs font-bold text-primary lg:inline">F2</span>
        </button>
      </div>

      <DashboardQuickActions
        onOpenQuickSale={openNewSale}
        onCreateProduct={() => openEntity("product", undefined, { mode: "create", context: "dashboard", title: "کالای جدید" })}
        onCreateContact={() => openEntity("contact", undefined, { mode: "create", context: "dashboard", title: "مشتری جدید" })}
      />

      <DashboardStats summary={s} onOpenExpense={() => setQuickExpenseOpen(true)} onOpenReceipt={() => setQuickReceiptOpen(true)} />

      {/*
        چیدمان مطابق مرجع: ستون اصلی (نمودار + پرفروش‌ها) و ستون کناری
        (هشدار موجودی + فاکتورهای اخیر).
        موبایل: تک‌ستونی · تبلت: تک‌ستونی با گرید داخلی · دسکتاپ: ۸/۴
      */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
        <div className="space-y-4 lg:col-span-8 lg:space-y-6">
          <DashboardSalesChart isLoading={chartQuery.isLoading} data={chartQuery.data} />
          <DashboardTopProducts
            isLoading={topProductsQuery.isLoading}
            items={topProductsQuery.data}
          />
        </div>

        <div className="space-y-4 lg:col-span-4 lg:space-y-6">
          <DashboardStockAlert
            lowStockCount={s?.low_stock_count ?? 0}
            items={lowStockItems}
          />
          <DashboardRecentInvoices
            sales={recentSales}
            onOpenSale={openRecentSale}
            onSaleClick={handleRecentSaleClick}
            onSaleAuxClick={handleRecentSaleAuxClick}
          />
        </div>
      </div>

      {/* مودال‌ها */}
      {quickExpenseOpen && <QuickTxModal orgId={orgId} type="expense" onClose={() => setQuickExpenseOpen(false)} />}
      {quickReceiptOpen && <QuickTxModal orgId={orgId} type="receipt" onClose={() => setQuickReceiptOpen(false)} />}
    </div>
  );
}

function QuickTxModal({ orgId, type, onClose }: { orgId: string | null; type: "expense" | "receipt"; onClose: () => void }) {
  const { branchId } = useOrg();
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [contactId, setContactId] = useState("");
  const [expenseCatId, setExpenseCatId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: accounts } = useQuery({
    queryKey: ["quick-tx-accounts", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("accounts").select("id, name").eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ["quick-tx-contacts", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("contacts").select("id, name").eq("is_active", true).order("name").limit(200);
      return data ?? [];
    },
  });

  const { data: expCats } = useQuery({
    queryKey: ["quick-exp-cats", orgId],
    enabled: !!orgId && type === "expense",
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("expense_categories").select("id, name").eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  async function handleSave() {
    setError(null);
    const amt = tomanToRial(Number(toEnDigits(amount)) || 0);
    if (amt <= 0) { setError("مبلغ را وارد کنید."); return; }
    if (!orgId) return;
    setSaving(true);
    const supabase = createClient();
    try {
      await supabase.from("transactions").insert({
        org_id: orgId,
        branch_id: branchId,
        type,
        amount: amt,
        account_id: accountId || null,
        contact_id: contactId || null,
        expense_category_id: expenseCatId || null,
        method: "cash",
        note: note.trim() || null,
      });
      onClose();
    } catch (e) {
      setError("خطا: " + (e as Error).message);
      setSaving(false);
    }
  }

  const title = type === "expense" ? "ثبت هزینه" : "ثبت دریافتی";

  return (
    <Modal open onClose={onClose} title={title}>
      <div className="space-y-4">
        <div>
          <label className="label">مبلغ (تومان) *</label><input aria-label="مبلغ (تومان) *" autoFocus className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="label">حساب</label><select aria-label="حساب" className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">انتخاب...</option>
            {accounts?.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        {type === "receipt" && (
          <div>
            <label className="label">از</label><select aria-label="از" className="input" value={contactId} onChange={(e) => setContactId(e.target.value)}>
              <option value="">—</option>
              {contacts?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        {type === "expense" && (
          <div>
            <label className="label">دسته هزینه</label><select aria-label="دسته هزینه" className="input" value={expenseCatId} onChange={(e) => setExpenseCatId(e.target.value)}>
              <option value="">—</option>
              {expCats?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label">توضیحات</label><input aria-label="توضیحات" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving && <Loader2 className="animate-spin" size={18} />} ثبت
          </button>
          <button onClick={onClose} className="btn-secondary">انصراف</button>
        </div>
      </div>
    </Modal>
  );
}
