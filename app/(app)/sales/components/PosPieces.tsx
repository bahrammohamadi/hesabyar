"use client";

/**
 * قطعات بصری صفحه فروش (POS) — مطابق مراجع طراحی step1/step2.
 *
 * ⚠️ این فایل فقط «ظرف بصری» است. هیچ منطق سبد خرید، جستجوی بارکد،
 * محاسبه‌ی مبلغ یا مدیریت روش پرداخت اینجا نیست — همه در
 * app/(app)/sales/page.tsx دست‌نخورده باقی مانده‌اند.
 */

import type { ReactNode } from "react";
import { Barcode, Package, Trash2, UserPlus, Users, X } from "lucide-react";
import { Badge, Button, Card } from "@/src/shared/ui";
import { EntityLink } from "@/components/shared/entity-link";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { PhoneLink } from "@/components/shared/phone-link";
import { formatToman, rialToToman, toFaDigits } from "@/lib/utils/format";
import type { CartItem } from "@/types/db";

/* ------------------------------------------------------------------ */
/* نوار جستجو / ورود بارکد — مطابق مرجع step1                          */
/*                                                                     */
/* ⚠️ اسکن با دوربین موبایل پیاده‌سازی نشده است. این ورودی با           */
/* بارکدخوان فیزیکی (که مثل کیبورد تایپ می‌کند) کار می‌کند: پنل         */
/* ProductSelector خودکار فوکوس می‌گیرد و روی فیلد barcode جستجو        */
/* می‌کند. متن UI عمداً «ورود بارکد» است نه «اسکن»، تا قابلیتی که       */
/* وجود ندارد به کاربر وعده داده نشود.                                 */
/* ------------------------------------------------------------------ */

export function PosSearchBar({ onOpenPicker }: { onOpenPicker: () => void }) {
  return (
    <Card className="p-3 sm:p-4">
      <p className="mb-2 text-xs font-bold text-muted-foreground">جستجوی کالا یا ورود بارکد</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onOpenPicker}
          className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-input bg-background px-3.5 text-right text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <Barcode size={18} className="shrink-0 text-muted-foreground" />
          <span className="truncate">نام کالا، کد کالا یا بارکد را وارد کنید (سازگار با بارکدخوان)</span>
        </button>
        <Button onClick={onOpenPicker} icon={<Package size={17} />} className="shrink-0">
          افزودن سریع
        </Button>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* کارت انتخاب مشتری — مطابق مرجع step1/step2                          */
/* ------------------------------------------------------------------ */

export function PosCustomerCard({
  customer,
  walletCredit,
  onPick,
  onClear,
}: {
  customer: { id: string; name: string; phone?: string | null } | null;
  walletCredit?: number | null;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <Card className="p-3 sm:p-4">
      <div className="mb-3 flex items-center gap-2">
        <Users size={16} className="text-primary" />
        <h2 className="text-sm font-extrabold text-foreground">انتخاب مشتری</h2>
      </div>

      {customer ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/[0.05] p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-foreground">{customer.name}</div>
              {customer.phone && <PhoneLink phone={customer.phone} className="text-xs" />}
            </div>
            <button
              type="button"
              onClick={onClear}
              aria-label="حذف مشتری"
              className="shrink-0 rounded-lg p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            >
              <X size={16} />
            </button>
          </div>
          {typeof walletCredit === "number" && walletCredit > 0 && (
            <div className="mt-2 text-xs text-muted-foreground">
              اعتبار کیف پول: <span className="font-bold tabular-nums text-primary">{formatToman(walletCredit)}</span>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={onPick}
          className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-dashed border-input px-3.5 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <UserPlus size={17} />
          جستجوی مشتری یا شماره تماس
        </button>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* لیست اقلام فاکتور — جدول در دسکتاپ، کارت در موبایل                  */
/* ------------------------------------------------------------------ */

export function PosCartList({
  cart,
  onQtyChange,
  onPriceChange,
  onRemove,
}: {
  cart: CartItem[];
  onQtyChange: (variantId: string, qty: number) => void;
  onPriceChange: (variantId: string, tomanValue: string) => void;
  onRemove: (variantId: string) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
        <h2 className="text-sm font-extrabold text-foreground">لیست اقلام فاکتور</h2>
        <Badge tone={cart.length > 0 ? "primary" : "neutral"}>
          {toFaDigits(cart.length)} قلم کالا
        </Badge>
      </div>

      {cart.length === 0 ? (
        <div className="mx-3 mb-3 rounded-2xl border border-dashed border-border py-10 text-center sm:mx-4 sm:mb-4">
          <Package size={26} className="mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">هنوز کالایی انتخاب نشده است</p>
        </div>
      ) : (
        <div className="max-h-[46vh] overflow-y-auto px-3 pb-3 sm:px-4 sm:pb-4">
          {/* سربرگ جدول — فقط دسکتاپ، مطابق مرجع (نوار تیره) */}
          <div className="sticky top-0 z-[1] hidden grid-cols-[minmax(200px,2.2fr)_130px_140px_minmax(110px,1fr)_44px] items-center gap-2 rounded-2xl bg-primary px-3 py-2.5 text-xs font-extrabold text-primary-foreground lg:grid">
            <span>نام محصول</span>
            <span className="text-center">تعداد</span>
            <span>قیمت واحد (تومان)</span>
            <span className="text-left">مجموع (تومان)</span>
            <span />
          </div>

          <ul className="divide-y divide-border">
            {cart.map((c) => (
              <li key={c.variant_id} className="py-3">
                {/* دسکتاپ */}
                <div className="hidden grid-cols-[minmax(200px,2.2fr)_130px_140px_minmax(110px,1fr)_44px] items-center gap-2 lg:grid">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <EntityLink type="product" id={c.product_id} className="truncate text-sm font-bold">
                        {c.product_name}
                      </EntityLink>
                      <EntityActionMenu type="product" id={c.product_id} label={c.product_name} />
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">{c.variant_label || "ساده"}</div>
                  </div>

                  <QtyStepper qty={c.qty} onChange={(n) => onQtyChange(c.variant_id, n)} />

                  <input
                    className="input h-10 min-h-10 text-left text-sm tabular-nums"
                    inputMode="numeric"
                    aria-label={`قیمت واحد ${c.product_name}`}
                    value={String(rialToToman(c.unit_price))}
                    onChange={(e) => onPriceChange(c.variant_id, e.target.value)}
                  />

                  <div className="text-left text-sm font-black tabular-nums text-foreground">
                    {formatToman(c.unit_price * c.qty - c.discount, false)}
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemove(c.variant_id)}
                    aria-label={`حذف ${c.product_name}`}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* موبایل و تبلت — کارت، مطابق مرجع step2 */}
                <div className="lg:hidden">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <EntityLink type="product" id={c.product_id} className="truncate text-sm font-bold">
                        {c.product_name}
                      </EntityLink>
                      <div className="mt-0.5 text-xs text-muted-foreground">{c.variant_label || "ساده"}</div>
                      <div className="mt-1 text-xs font-bold tabular-nums text-primary">
                        {formatToman(c.unit_price, false)} تومان
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(c.variant_id)}
                      aria-label={`حذف ${c.product_name}`}
                      className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <QtyStepper qty={c.qty} onChange={(n) => onQtyChange(c.variant_id, n)} />
                    <strong className="text-sm font-black tabular-nums text-foreground">
                      {formatToman(c.unit_price * c.qty - c.discount, false)}
                    </strong>
                  </div>
                </div>

                {c.qty > c.stock_qty && (
                  <div className="mt-2 text-xs font-medium text-warning">
                    ⚠ موجودی کافی نیست (موجودی: {toFaDigits(c.stock_qty)})
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function QtyStepper({ qty, onChange }: { qty: number; onChange: (n: number) => void }) {
  return (
    <div className="mx-auto flex h-10 items-center overflow-hidden rounded-xl border border-input bg-background">
      <button
        type="button"
        onClick={() => onChange(qty - 1)}
        aria-label="کم کردن تعداد"
        className="flex h-10 w-9 items-center justify-center text-muted-foreground transition hover:bg-muted"
      >
        −
      </button>
      <span className="min-w-9 text-center text-sm font-bold tabular-nums">{toFaDigits(qty)}</span>
      <button
        type="button"
        onClick={() => onChange(qty + 1)}
        aria-label="زیاد کردن تعداد"
        className="flex h-10 w-9 items-center justify-center text-muted-foreground transition hover:bg-muted"
      >
        +
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* کارت جمع مبالغ — کارت تیره مطابق مرجع step1                         */
/* ------------------------------------------------------------------ */

export function PosSummaryCard({
  subtotal,
  discountRial,
  total,
  paidWalletRial,
  credit,
  children,
}: {
  subtotal: number;
  discountRial: number;
  total: number;
  paidWalletRial: number;
  credit: number;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-[1.75rem] bg-primary p-4 text-primary-foreground shadow-sm sm:p-5">
      <SummaryRow label="جمع کل اقلام:" value={formatToman(subtotal, false)} />
      {discountRial > 0 && (
        <SummaryRow label="مجموع تخفیف‌ها:" value={`(${formatToman(discountRial, false)}−)`} />
      )}
      {paidWalletRial > 0 && (
        <SummaryRow label="پرداخت از اعتبار:" value={formatToman(paidWalletRial, false)} />
      )}
      {credit > 0 && <SummaryRow label="باقیمانده (نسیه):" value={formatToman(credit, false)} />}

      <div className="mt-3 border-t border-primary-foreground/20 pt-3">
        <div className="text-xs text-primary-foreground/90">مبلغ قابل پرداخت:</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-2xl font-black tabular-nums sm:text-[28px]">{formatToman(total, false)}</span>
          <span className="text-xs text-primary-foreground/90">تومان</span>
        </div>
      </div>

      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-primary-foreground/10 py-2 text-sm last:border-0">
      <span className="text-primary-foreground/90">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}
