"use client";

/**
 * بخش پرداخت صفحه فروش — مطابق مرجع step1 (روش پرداخت) و step2 (تایید و پرداخت).
 *
 * ⚠️ منطق پرداخت تغییر نکرده است. این کامپوننت فقط همان stateهای موجود
 * (`paidCash` / `paidCard` / `isCreditSale` / `accountId` / `discount`) را
 * با چیدمان مرجع نمایش می‌دهد. هیچ محاسبه‌ای اینجا انجام نمی‌شود.
 */

import { CreditCard, Banknote, FileText } from "lucide-react";
import { Card, Field, Select } from "@/src/shared/ui";
import { DatePicker } from "@/components/shared/date-picker";
import { formatToman } from "@/lib/utils/format";

export type PayMethod = "card" | "cash" | "credit";

const METHODS: { id: PayMethod; label: string; icon: typeof CreditCard }[] = [
  { id: "card", label: "کارتخوان", icon: CreditCard },
  { id: "cash", label: "نقدی", icon: Banknote },
  { id: "credit", label: "چک / امانی", icon: FileText },
];

/**
 * انتخاب روش پرداخت.
 * این فقط یک لایه‌ی بصری روی همان فیلدهای موجود است:
 *   کارتخوان → مبلغ در «دریافت کارتی»
 *   نقدی     → مبلغ در «دریافت نقدی»
 *   چک/امانی → همان حالت نسیه (isCreditSale)
 */
export function PosPaymentMethods({
  active,
  onSelect,
}: {
  active: PayMethod;
  onSelect: (m: PayMethod) => void;
}) {
  return (
    <Card className="p-3 sm:p-4">
      <div className="mb-3 flex items-center gap-2">
        <CreditCard size={16} className="text-primary" />
        <h2 className="text-sm font-extrabold text-foreground">روش پرداخت</h2>
      </div>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="روش پرداخت">
        {METHODS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              aria-pressed={isActive}
              className={[
                "flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-center transition focus:outline-none focus:ring-2 focus:ring-ring",
                isActive
                  ? "border-primary bg-primary/[0.06] text-primary shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
              ].join(" ")}
            >
              <Icon size={18} />
              <span className="text-[11px] font-bold leading-tight">{label}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/**
 * فیلدهای تکمیلی فاکتور: لیست قیمت، تاریخ، حساب، تخفیف.
 * همان کنترل‌های قبلی، فقط با چیدمان و توکن‌های معنایی.
 */
export function PosInvoiceFields({
  priceListId,
  onPriceListChange,
  priceLists,
  saleDate,
  onSaleDateChange,
  accountId,
  onAccountChange,
  accounts,
  discount,
  onDiscountChange,
  discountType,
  onDiscountTypeChange,
  discountRial,
}: {
  priceListId: string;
  onPriceListChange: (v: string) => void;
  priceLists: { id: string; name: string; discount_percent: number | null }[] | undefined;
  saleDate: string;
  onSaleDateChange: (v: string) => void;
  accountId: string;
  onAccountChange: (v: string) => void;
  accounts: { id: string; name: string }[] | undefined;
  discount: string;
  onDiscountChange: (v: string) => void;
  discountType: "fixed" | "percent";
  onDiscountTypeChange: (v: "fixed" | "percent") => void;
  discountRial: number;
}) {
  return (
    <Card className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4">
      <Field label="لیست قیمت">
        <Select value={priceListId} onChange={(e) => onPriceListChange(e.target.value)}>
          <option value="">قیمت عادی کالا</option>
          {priceLists?.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name} {list.discount_percent ? `(${list.discount_percent}٪)` : ""}
            </option>
          ))}
        </Select>
      </Field>

      <DatePicker label="تاریخ فاکتور" value={saleDate} onChange={onSaleDateChange} />

      <Field label="حساب دریافت وجه">
        <Select value={accountId} onChange={(e) => onAccountChange(e.target.value)}>
          <option value="">انتخاب...</option>
          {accounts?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="تخفیف" error={null}>
        <div className="flex gap-2">
          <input
            className="input"
            inputMode="numeric"
            aria-label="مقدار تخفیف"
            value={discount}
            onChange={(e) => onDiscountChange(e.target.value)}
          />
          <Select
            className="w-24 shrink-0"
            aria-label="نوع تخفیف"
            value={discountType}
            onChange={(e) => onDiscountTypeChange(e.target.value as "fixed" | "percent")}
          >
            <option value="fixed">تومان</option>
            <option value="percent">٪</option>
          </Select>
        </div>
        {discountRial > 0 && (
          <span className="mt-1 block text-xs text-muted-foreground">
            معادل تخفیف: {formatToman(discountRial)}
          </span>
        )}
      </Field>
    </Card>
  );
}
