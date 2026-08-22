"use client";

import { useEffect, useState } from "react";
import { Coins, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { useOrgPrefs, useInvalidateOrgPrefs } from "@/lib/hooks/useOrgPrefs";
import { Button, Card, Field, Select, useToast } from "@/src/shared/ui";
import { CURRENCIES, businessTypeOptions, industryProfile, type CurrencyCode } from "@/lib/org-prefs";
import { CURRENCY_SWITCH_NOTE, formatMoney } from "@/lib/utils/money";
import { UNIT_META } from "@/lib/units";

/**
 * تنظیمات نمایش و شخصی‌سازی صنفی.
 *
 * 🔴 قاعده‌ای که در متن هم به کاربر گفته می‌شود:
 *   واحد پول فقط **نمایش** را عوض می‌کند. هیچ مبلغ ثبت‌شده‌ای
 *   دست نمی‌خورد. بدون این توضیح، کاربری که واحد را عوض می‌کند و
 *   می‌بیند همه‌ی اعداد ده برابر شده‌اند فکر می‌کند داده‌اش نابود
 *   شده — و آن ترس کاملاً منطقی است.
 */
export function OrgPrefsForm() {
  const { orgId, role } = useOrg();
  const { prefs, businessType, loading } = useOrgPrefs();
  const invalidate = useInvalidateOrgPrefs();
  const { toast } = useToast();

  const [currency, setCurrency] = useState<CurrencyCode>(prefs.currency);
  const [industry, setIndustry] = useState<string>(prefs.businessType ?? "");
  const [industryUi, setIndustryUi] = useState<boolean>(prefs.industryUi);
  const [saving, setSaving] = useState(false);

  /* پس از بارگذاری، فرم با مقدار واقعی هم‌گام می‌شود. */
  useEffect(() => {
    if (loading) return;
    setCurrency(prefs.currency);
    setIndustry(prefs.businessType ?? "");
    setIndustryUi(prefs.industryUi);
  }, [loading, prefs.currency, prefs.businessType, prefs.industryUi]);

  /*
    🔴 فقط مالک و مدیر. این تنظیمات روی نمایش مبالغ **همه‌ی**
    کاربران سازمان اثر می‌گذارد؛ اگر صندوق‌دار واحد را عوض کند،
    بقیه ناگهان اعداد ده‌برابر می‌بینند. گارد اصلی در تابع دیتابیس
    است و این فقط پنهان‌کردن دکمه است.
  */
  const canEdit = role === "owner" || role === "manager";

  async function save() {
    if (!orgId) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("save_org_prefs", {
        p_org: orgId,
        p_patch: {
          currency,
          businessType: industry || null,
          industryUi,
        },
      });
      if (error) {
        toast({ title: "ذخیره نشد", description: error.message, tone: "error" });
        return;
      }
      invalidate();
      toast({ title: "تنظیمات ذخیره شد", tone: "success" });
    } finally {
      setSaving(false);
    }
  }

  const previewProfile = industryProfile(industryUi ? industry || businessType : null);

  if (loading) return <div className="h-32 animate-pulse rounded-xl bg-muted" />;

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Coins size={18} className="text-primary" aria-hidden />
          <h2 className="text-sm font-extrabold text-foreground">واحد پول</h2>
        </div>

        <Field label="مبالغ با کدام واحد نمایش داده شوند؟">
          <Select
            value={currency}
            disabled={!canEdit}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
          >
            {(Object.keys(CURRENCIES) as CurrencyCode[]).map((c) => (
              <option key={c} value={c}>
                {CURRENCIES[c].label}
              </option>
            ))}
          </Select>
        </Field>

        {/*
          پیش‌نمایش زنده — مؤثرترین راه فهماندن اینکه چه اتفاقی
          می‌افتد. یک مبلغ ثابت، در هر دو واحد.
        */}
        <div className="rounded-xl bg-muted p-3">
          <div className="mb-1.5 text-2xs text-muted-foreground">پیش‌نمایش</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="tabular-nums font-bold text-foreground">
              {formatMoney(1_000_000, currency)}
            </span>
            <span aria-hidden="true" className="text-muted-foreground">·</span>
            <span className="text-2xs text-muted-foreground">
              همان مبلغ در واحد دیگر: {formatMoney(1_000_000, currency === "toman" ? "rial" : "toman")}
            </span>
          </div>
        </div>

        <p className="text-2xs leading-relaxed text-muted-foreground">{CURRENCY_SWITCH_NOTE}</p>
      </Card>

      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Store size={18} className="text-primary" aria-hidden />
          <h2 className="text-sm font-extrabold text-foreground">شخصی‌سازی صنفی</h2>
        </div>

        <p className="text-2xs leading-relaxed text-muted-foreground">
          با انتخاب صنف، برچسب‌ها و پیش‌فرض‌های پنل با کسب‌وکار شما هماهنگ می‌شوند: واحد
          پیش‌فرض کالا، گزینه‌های پیشنهادی رنگ و سایز، و پنهان‌شدن فیلدهایی که برای صنف شما
          کاربردی ندارند.
        </p>

        <Field label="صنف کسب‌وکار">
          <Select
            value={industry}
            disabled={!canEdit || !industryUi}
            onChange={(e) => setIndustry(e.target.value)}
          >
            <option value="">— خودکار از ثبت‌نام —</option>
            {businessTypeOptions().map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>

        <label className="flex items-start gap-2.5 rounded-xl border border-border p-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
            checked={industryUi}
            disabled={!canEdit}
            onChange={(e) => setIndustryUi(e.target.checked)}
          />
          <span className="text-xs leading-6 text-muted-foreground">
            <span className="font-bold text-foreground">شخصی‌سازی صنفی فعال باشد</span>
            <span className="block">
              اگر خاموشش کنید، پنل حالت عمومی می‌گیرد و همه‌ی فیلدها نمایش داده می‌شوند.
            </span>
          </span>
        </label>

        {/* پیش‌نمایش اثر انتخاب */}
        <div className="rounded-xl bg-muted p-3 text-2xs leading-6 text-muted-foreground">
          <div className="mb-1 font-bold text-foreground">با این تنظیم:</div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>واژه‌ی کالا: «{previewProfile.productWord}»</span>
            <span aria-hidden="true">·</span>
            <span>واحد پیش‌فرض: {UNIT_META[previewProfile.defaultUnit].defaultUnit}</span>
            {previewProfile.hiddenFields.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  پنهان: {previewProfile.hiddenFields.map((f) => FIELD_LABELS[f]).join("، ")}
                </span>
              </>
            )}
          </div>
        </div>
      </Card>

      {canEdit ? (
        <Button onClick={save} disabled={saving}>
          {saving ? "در حال ذخیره..." : "ذخیره تنظیمات"}
        </Button>
      ) : (
        <p className="text-2xs text-muted-foreground">
          فقط مالک یا مدیر مجموعه می‌تواند این تنظیمات را تغییر دهد.
        </p>
      )}
    </div>
  );
}

const FIELD_LABELS: Record<string, string> = {
  color: "رنگ",
  size: "سایز",
  season: "فصل",
  material: "جنس",
};
