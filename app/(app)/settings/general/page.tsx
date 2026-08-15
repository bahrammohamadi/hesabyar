"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, Palette, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { PageHeader, Spinner } from "@/components/shared/ui";
import { Button, Card, Field, Input, useToast } from "@/src/shared/ui";
import {
  applyTheme, DEFAULT_THEME, THEMES, THEME_STORAGE_KEY, THEME_CHANGE_EVENT, type ThemeId,
} from "@/lib/theme";
import { cn } from "@/lib/utils/cn";
import { BrandIdentityForm } from "@/components/shared/brand-identity-form";
import { PushToggle } from "@/components/shared/push-toggle";

/**
 * تنظیمات عمومی — نام کسب‌وکار و ظاهر برنامه.
 *
 * انتخابگر تم پیش از این **در دو صفحه تکرار شده بود**: اینجا و
 * بالای /settings/catalog. دو نسخه‌ی جدا از یک کامپوننت که باید
 * همیشه هماهنگ می‌ماندند. حالا فقط همین یکی.
 */

function ThemePicker() {
  /*
    ⚠️ مقدار اولیه در useState خوانده نمی‌شود بلکه در useEffect.

    خواندن localStorage هنگام رندر اول، بین سرور و کلاینت اختلاف
    می‌سازد (hydration mismatch): سرور همیشه DEFAULT_THEME می‌بیند و
    کلاینت مقدار ذخیره‌شده را. React در حالت production بی‌صدا
    نادیده می‌گیرد ولی نشانگر «انتخاب‌شده» روی تم اشتباه می‌ماند.
  */
  const [selected, setSelected] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
    if (stored) setSelected(stored);
  }, []);

  function choose(themeId: ThemeId) {
    setSelected(themeId);
    window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
    applyTheme(themeId);
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: themeId }));
  }

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-extrabold text-foreground">
        <Palette size={17} aria-hidden />
        ظاهر برنامه
      </h2>
      <p className="mb-4 text-2xs text-muted-foreground">
        تم انتخابی فقط روی همین دستگاه اعمال می‌شود.
      </p>

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {THEMES.map((theme) => {
          const active = selected === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => choose(theme.id)}
              aria-pressed={active}
              className={cn(
                "rounded-xl border p-3 text-right transition",
                active
                  ? "border-primary bg-primary/[0.06]"
                  : "border-border bg-card hover:border-primary/25"
              )}
            >
              <div className="mb-2.5 flex items-center justify-between">
                <div className="flex gap-1">
                  {theme.swatches.map((color) => (
                    <span
                      key={color}
                      className="h-6 w-6 rounded-full border border-border"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                {active && <Check size={15} className="text-primary" aria-hidden />}
              </div>
              <div className="text-xs font-extrabold text-foreground">{theme.name}</div>
              <div className="mt-0.5 text-2xs leading-5 text-muted-foreground">
                {theme.description}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

export default function GeneralSettingsPage() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");

  const orgQuery = useQuery({
    queryKey: ["settings-general-org", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("organizations")
        .select("id,name")
        .eq("id", orgId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (orgQuery.data?.name) setName(orgQuery.data.name);
  }, [orgQuery.data?.name]);

  const updateOrg = useMutation({
    mutationFn: async () => {
      if (!orgId) return;
      const supabase = createClient();
      const { error } = await supabase
        .from("organizations")
        .update({ name: name.trim() })
        .eq("id", orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "نام کسب‌وکار ذخیره شد", tone: "success" });
      qc.invalidateQueries({ queryKey: ["settings-general-org", orgId] });
      // نام در هدر و سایدبار هم نشان داده می‌شود.
      qc.invalidateQueries({ queryKey: ["org-context"] });
    },
    onError: (e) => toast({ title: (e as Error).message, tone: "error" }),
  });

  const dirty = name.trim() !== (orgQuery.data?.name ?? "").trim();

  return (
    <div className="space-y-4">
      <PageHeader title="کسب‌وکار و ظاهر" subtitle="نام، لوگو، اطلاعات تماس روی فاکتور و تم رنگی" />

      {orgQuery.isLoading ? (
        <Spinner />
      ) : (
        <Card className="p-4 sm:p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-extrabold text-foreground">
            <Building2 size={17} aria-hidden />
            اطلاعات کسب‌وکار
          </h2>
          <div className="grid items-end gap-3 md:grid-cols-[1fr_auto]">
            <Field label="نام فروشگاه" hint="این نام روی فاکتورها و بالای برنامه دیده می‌شود.">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="نام کسب‌وکار"
              />
            </Field>
            <Button
              onClick={() => updateOrg.mutate()}
              loading={updateOrg.isPending}
              /* دکمه فقط وقتی فعال است که واقعاً چیزی عوض شده باشد. */
              disabled={!name.trim() || !dirty}
              icon={<Save size={15} />}
            >
              ذخیره
            </Button>
          </div>
        </Card>
      )}

      {/*
        هویت برند زیر نام کسب‌وکار و بالای انتخاب تم: اطلاعاتی که روی
        سند مشتری چاپ می‌شود از ترجیح رنگی شخصی مهم‌تر است.
      */}
      <BrandIdentityForm />

      {/*
        اعلان دستگاه بعد از هویت برند و پیش از تم: تنظیمی عملیاتی
        است، نه ترجیح ظاهری.
      */}
      <PushToggle />

      <ThemePicker />
    </div>
  );
}
