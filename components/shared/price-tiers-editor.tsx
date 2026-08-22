"use client";

import { useState } from "react";
import { useOrgPrefs } from "@/lib/hooks/useOrgPrefs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Layers } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { EmptyState, Spinner } from "@/components/shared/ui";
import { Button, Card, Field, useConfirm, useToast } from "@/src/shared/ui";
import { ProductSelector, type SelectableVariant } from "@/components/shared/product-selector";
import { formatToman, toEnDigits, toFaDigits, tomanToRial } from "@/lib/utils/format";
import { tierPriceRial, type PriceTier } from "@/lib/wholesale";

/**
 * ویرایشگر پلکان قیمت عمده برای یک لیست قیمت.
 *
 * چرا این لازم بود: `price_lists` تخفیف را بر اساس **مشتری** می‌دهد
 * («این مشتری عمده‌فروش است، ۱۰٪ کمتر»). عمده‌فروش واقعی تخفیف را بر
 * اساس **تعداد** می‌دهد («۱۰ تا بخری ۱۰٪، ۵۰ تا بخری ۱۸٪»). هر
 * نرم‌افزار پخش ایرانی این را دارد و ما نداشتیم.
 *
 * ⚠️ پله‌ی بدون کالا روی **همه‌ی** کالاهای لیست اعمال می‌شود. این
 * حالت پیش‌فرض است چون رایج‌ترین کاربرد همین است.
 */
export function PriceTiersEditor({
  priceListId,
  orgId,
  listDiscountPercent,
}: {
  priceListId: string;
  orgId: string | null;
  listDiscountPercent: number;
}) {
  /* واحد پول سازمان — تومان یا ریال، از تنظیمات. */
  const { money, unitLabel: unitWord } = useOrgPrefs();
  const qc = useQueryClient();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [minQty, setMinQty] = useState("");
  const [mode, setMode] = useState<"percent" | "price">("percent");
  const [value, setValue] = useState("");
  const [variant, setVariant] = useState<SelectableVariant | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: tiers, isLoading } = useQuery({
    queryKey: ["price-tiers", priceListId],
    enabled: !!priceListId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("price_tiers")
        .select("id,variant_id,min_qty,unit_price,discount_percent,is_active,variant:product_variants(id,color,size,sale_price,product:products(name))")
        .eq("price_list_id", priceListId)
        .order("min_qty", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function addTier() {
    if (!orgId) return;
    const qty = Number(toEnDigits(minQty));
    const raw = Number(toEnDigits(value));

    if (!Number.isFinite(qty) || qty < 1) {
      toast({ title: "حداقل تعداد باید یک یا بیشتر باشد", tone: "error" });
      return;
    }
    if (!Number.isFinite(raw) || raw < 0) {
      toast({ title: "مقدار پله معتبر نیست", tone: "error" });
      return;
    }
    if (mode === "percent" && raw > 100) {
      toast({ title: "درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد", tone: "error" });
      return;
    }

    setSaving(true);
    const supabase = createClient();
    // ⚠️ دقیقاً یکی از دو ستون پر می‌شود؛ محدودیت price_tiers_one_mode
    // در دیتابیس همین را الزام می‌کند.
    const { error } = await supabase.from("price_tiers").insert({
      org_id: orgId,
      price_list_id: priceListId,
      variant_id: variant?.variant_id ?? null,
      min_qty: Math.floor(qty),
      unit_price: mode === "price" ? tomanToRial(raw) : null,
      discount_percent: mode === "percent" ? raw : null,
    });
    setSaving(false);

    if (error) {
      // ایندکس یکتا: همان تعداد روی همان کالا دو بار.
      const duplicate = error.code === "23505";
      toast({
        title: duplicate ? "برای این تعداد قبلاً پله تعریف شده" : "ثبت پله انجام نشد",
        description: duplicate ? "حداقل تعداد هر پله باید یکتا باشد." : error.message,
        tone: "error",
      });
      return;
    }

    setMinQty(""); setValue(""); setVariant(null);
    qc.invalidateQueries({ queryKey: ["price-tiers", priceListId] });
    qc.invalidateQueries({ queryKey: ["sale-price-tiers", priceListId] });
  }

  async function removeTier(id: string) {
    const ok = await confirm({
      title: "حذف پله",
      description: "این پله حذف می‌شود و قیمت‌ها به پله‌ی پایین‌تر برمی‌گردند.",
      confirmLabel: "حذف کن",
      tone: "danger",
    });
    if (!ok) return;
    const supabase = createClient();
    const { error } = await supabase.from("price_tiers").delete().eq("id", id);
    if (error) { toast({ title: "حذف انجام نشد", description: error.message, tone: "error" }); return; }
    qc.invalidateQueries({ queryKey: ["price-tiers", priceListId] });
    qc.invalidateQueries({ queryKey: ["sale-price-tiers", priceListId] });
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-3 sm:p-4">
        <div className="text-sm font-bold text-foreground">افزودن پله‌ی قیمت</div>
        <p className="text-xs text-muted-foreground">
          هرچه تعداد بیشتر، قیمت کمتر. پله‌ای که حداقل تعدادش از تعداد سفارش کمتر یا برابر باشد و از همه بزرگ‌تر باشد، برنده است.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="از این تعداد به بالا">
            <input
              aria-label="حداقل تعداد پله"
              className="input tabular-nums"
              inputMode="numeric"
              placeholder="مثلاً ۱۰"
              value={minQty}
              onChange={(e) => setMinQty(e.target.value)}
            />
          </Field>

          <Field label="نوع پله">
            <select aria-label="نوع پله" className="input" value={mode} onChange={(e) => setMode(e.target.value as "percent" | "price")}>
              <option value="percent">درصد تخفیف</option>
              <option value="price">قیمت ثابت</option>
            </select>
          </Field>

          <Field label={mode === "percent" ? "درصد تخفیف" : "قیمت هر واحد (تومان)"}>
            <input
              aria-label={mode === "percent" ? "درصد تخفیف پله" : "قیمت ثابت پله به تومان"}
              className="input tabular-nums"
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>

          <Field label="کالا (اختیاری)">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="input flex-1 truncate text-right"
              >
                {variant ? variant.product_name : "همه‌ی کالاهای لیست"}
              </button>
              {variant && (
                <button type="button" onClick={() => setVariant(null)} aria-label="حذف کالای انتخاب‌شده" className="btn-secondary shrink-0">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </Field>
        </div>

        <Button onClick={addTier} disabled={saving}>
          <Plus size={16} /> {saving ? "در حال ثبت..." : "افزودن پله"}
        </Button>
      </Card>

      {isLoading ? (
        <Spinner />
      ) : !tiers?.length ? (
        <EmptyState icon={Layers} title="پله‌ای تعریف نشده" description="بدون پله، قیمت همه‌ی تعدادها یکسان می‌ماند." />
      ) : (
        <div className="space-y-2">
          {tiers.map((tier: any) => {
            const productName = tier.variant?.product?.name;
            const base = tier.variant?.sale_price ?? 0;
            const effective =
              tier.unit_price ??
              (base > 0 ? tierPriceRial({ basePriceRial: base, qty: tier.min_qty, tiers: [tier as PriceTier], variantId: tier.variant_id ?? "x" }) : null);

            return (
              <div key={tier.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0 flex-1">
                  {/*
                    🔴 توکن‌های عددی هرکدام span جدا در flex با جداکننده‌ی
                    aria-hidden. رشته‌ی `${الف} · ${ب}` در متن راست‌به‌چپ
                    بازچینش می‌شود و اعداد به هم می‌چسبند — در DOM درست
                    است و فقط رندر خراب می‌شود، پس تست رشته‌ای نمی‌گیردش.
                  */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="font-bold tabular-nums text-foreground">
                      {toFaDigits(tier.min_qty)} عدد به بالا
                    </span>
                    <span aria-hidden="true" className="text-muted-foreground">·</span>
                    <span className="tabular-nums text-primary">
                      {/*
                        🔴 «تخفیف ۱۰٪» و نه «۱۰٪ تخفیف».

                        اندازه‌گیری با Range.getClientRects نشان داد وقتی
                        `٪` بلافاصله کلمه‌ی فارسی بعدش می‌آید، bidi آن را
                        به سمت راست عدد می‌برد و کاربر «٪۱۰» می‌بیند —
                        برعکس بقیه‌ی برنامه که «۱۰٪» نشان می‌دهد. با
                        آوردن کلمه به اول، `٪` انتهای رشته می‌ماند و درست
                        رندر می‌شود. (`bdi` و `\u2068FSI` هیچ‌کدام جوابش نداد.)
                      */}
                      {tier.unit_price !== null
                        ? money(tier.unit_price)
                        : `تخفیف ${toFaDigits(Number(tier.discount_percent))}٪`}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {productName ?? "همه‌ی کالاهای این لیست"}
                    {effective !== null && productName ? ` — هر واحد ${money(effective)}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => removeTier(tier.id)}
                  aria-label={`حذف پله ${tier.min_qty} عدد`}
                  className="shrink-0 text-muted-foreground transition hover:text-destructive"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <ProductSelector
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(v) => { setVariant(v); setPickerOpen(false); }}
      />
    </div>
  );
}
