"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check, Copy, ExternalLink, Eye, EyeOff, Store,
} from "lucide-react";
import { PageHeader, Spinner } from "@/components/shared/ui";
import { Button, Card, Field, Input, Textarea, useToast } from "@/src/shared/ui";
import { validateSlug, suggestSlug, storefrontUrl } from "@/lib/storefront";
import { cn } from "@/lib/utils/cn";

/**
 * تنظیمات صفحه‌ی عمومی فروشگاه.
 *
 * کاربر لینک `/shop/<نشانی>` را در بیوی اینستاگرام می‌گذارد و مشتری
 * بدون ورود، آدرس و ساعت کاری و چند کالا را می‌بیند.
 *
 * 🔴 پیش‌فرض **منتشرنشده** است. انتشار باید یک اقدام آگاهانه باشد؛
 * عمومی‌شدن ناخواسته‌ی فهرست کالا و نشانی، خطایی است که پس گرفته
 * نمی‌شود.
 */

type Storefront = {
  slug: string;
  is_published: boolean;
  title: string;
  tagline: string | null;
  about: string | null;
  address: string | null;
  phone: string | null;
  instagram: string | null;
  telegram: string | null;
  whatsapp: string | null;
  hours: string | null;
  show_prices: boolean;
};

const EMPTY = {
  slug: "", title: "", tagline: "", about: "", address: "",
  phone: "", instagram: "", telegram: "", whatsapp: "", hours: "",
  show_prices: false, is_published: false,
};

export default function StorefrontSettingsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["storefront"],
    queryFn: async () => {
      const res = await fetch("/api/storefront");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در دریافت تنظیمات");
      return json as { storefront: Storefront | null; orgName: string | null };
    },
  });

  useEffect(() => {
    if (!data) return;
    if (data.storefront) {
      const s = data.storefront;
      setForm({
        slug: s.slug, title: s.title, tagline: s.tagline ?? "", about: s.about ?? "",
        address: s.address ?? "", phone: s.phone ?? "", instagram: s.instagram ?? "",
        telegram: s.telegram ?? "", whatsapp: s.whatsapp ?? "", hours: s.hours ?? "",
        show_prices: s.show_prices, is_published: s.is_published,
      });
    } else {
      // اولین بار: عنوان از نام کسب‌وکار، نشانی در صورت امکان پیشنهاد می‌شود.
      setForm((prev) => ({
        ...prev,
        title: data.orgName ?? "",
        slug: suggestSlug(data.orgName) ?? "",
      }));
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/storefront", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در ذخیره");
      return json as { storefront: Storefront };
    },
    onSuccess: (json) => {
      toast({
        title: json.storefront.is_published ? "فروشگاه منتشر شد" : "تنظیمات ذخیره شد",
        tone: "success",
      });
      qc.invalidateQueries({ queryKey: ["storefront"] });
    },
    onError: (e) => toast({ title: (e as Error).message, tone: "error" }),
  });

  const slugCheck = validateSlug(form.slug);
  const slugError = form.slug.length > 0 && !slugCheck.ok ? slugCheck.reason : null;
  const canSave = form.title.trim().length > 0 && slugCheck.ok;

  const url = slugCheck.ok
    ? storefrontUrl(form.slug, typeof window !== "undefined" ? window.location.origin : undefined)
    : "";

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // بعضی مرورگرها بدون HTTPS اجازه نمی‌دهند؛ سکوت بهتر از خطای گیج‌کننده است.
      toast({ title: "کپی نشد. نشانی را دستی انتخاب کنید.", tone: "warning" });
    }
  }

  if (isLoading) return <Spinner label="در حال بارگذاری…" />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="صفحه‌ی عمومی فروشگاه"
        subtitle="یک صفحه‌ی ساده برای مشتریان؛ لینکش را در بیوی اینستاگرام بگذارید"
      />

      {/* ── وضعیت انتشار ── */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-foreground">
              <Store size={17} aria-hidden />
              وضعیت
            </h2>
            <p className="mt-1 text-2xs leading-6 text-muted-foreground">
              {form.is_published
                ? "صفحه‌ی شما عمومی است و هرکسی با داشتن نشانی می‌تواند ببیندش."
                : "صفحه منتشر نشده است. تا وقتی منتشر نکنید هیچ‌کس آن را نمی‌بیند."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setForm((p) => ({ ...p, is_published: !p.is_published }))}
            aria-pressed={form.is_published}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold transition",
              form.is_published
                ? "border-success/30 bg-success-soft text-success-onSoft"
                : "border-border bg-card text-muted-foreground hover:border-primary/40"
            )}
          >
            {form.is_published ? <Eye size={16} aria-hidden /> : <EyeOff size={16} aria-hidden />}
            {form.is_published ? "منتشر شده" : "منتشر نشده"}
          </button>
        </div>

        {form.is_published && slugCheck.ok && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-muted p-3">
            <code className="min-w-0 flex-1 truncate font-mono text-2xs text-foreground" dir="ltr">
              {url}
            </code>
            <Button
              size="sm"
              variant="secondary"
              onClick={copyUrl}
              icon={copied ? <Check size={14} /> : <Copy size={14} />}
            >
              {copied ? "کپی شد" : "کپی"}
            </Button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-bold text-foreground transition hover:border-primary/40"
            >
              <ExternalLink size={14} aria-hidden />
              مشاهده
            </a>
          </div>
        )}
      </Card>

      {/* ── اطلاعات صفحه ── */}
      <Card className="space-y-4 p-4 sm:p-5">
        <h2 className="text-sm font-extrabold text-foreground">اطلاعات صفحه</h2>

        <Field
          label="نشانی صفحه"
          required
          error={slugError}
          hint="فقط حروف انگلیسی کوچک، عدد و خط تیره. این همان چیزی است که در لینک دیده می‌شود."
        >
          <Input
            value={form.slug}
            onChange={(e) =>
              setForm((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))
            }
            placeholder="my-shop"
            dir="ltr"
            className="text-left"
          />
        </Field>

        <Field label="عنوان فروشگاه" required>
          <Input
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="مثلاً: مزون پوشاک نگار"
          />
        </Field>

        <Field label="شعار کوتاه" hint="یک جمله زیر عنوان نمایش داده می‌شود.">
          <Input
            value={form.tagline}
            onChange={(e) => setForm((p) => ({ ...p, tagline: e.target.value }))}
            placeholder="بوتیک لباس زنانه"
          />
        </Field>

        <Field label="درباره‌ی ما">
          <Textarea
            value={form.about}
            onChange={(e) => setForm((p) => ({ ...p, about: e.target.value }))}
            placeholder="چند خط درباره‌ی کسب‌وکارتان"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="نشانی">
            <Input
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              placeholder="تهران، خیابان…"
            />
          </Field>
          <Field label="ساعت کاری">
            <Input
              value={form.hours}
              onChange={(e) => setForm((p) => ({ ...p, hours: e.target.value }))}
              placeholder="شنبه تا پنجشنبه ۱۰ تا ۲۲"
            />
          </Field>
          <Field label="تلفن">
            <Input
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              dir="ltr"
              className="text-left"
            />
          </Field>
          <Field label="واتس‌اپ" hint="با صفر شروع کنید؛ خودمان کد کشور را اضافه می‌کنیم.">
            <Input
              value={form.whatsapp}
              onChange={(e) => setForm((p) => ({ ...p, whatsapp: e.target.value }))}
              dir="ltr"
              className="text-left"
              placeholder="09121234567"
            />
          </Field>
          <Field label="اینستاگرام" hint="فقط نام کاربری؛ @ یا آدرس کامل هم قبول است.">
            <Input
              value={form.instagram}
              onChange={(e) => setForm((p) => ({ ...p, instagram: e.target.value }))}
              dir="ltr"
              className="text-left"
              placeholder="my_shop"
            />
          </Field>
          <Field label="تلگرام">
            <Input
              value={form.telegram}
              onChange={(e) => setForm((p) => ({ ...p, telegram: e.target.value }))}
              dir="ltr"
              className="text-left"
              placeholder="my_shop"
            />
          </Field>
        </div>
      </Card>

      {/* ── نمایش قیمت ── */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold text-foreground">نمایش قیمت کالاها</h2>
            <p className="mt-1 text-2xs leading-6 text-muted-foreground">
              اگر خاموش باشد، فقط نام و عکس کالا دیده می‌شود و قیمت نمایش داده نمی‌شود.
              {" "}
              <span className="text-muted-foreground">
                در هر حالت، قیمت خرید و تعداد دقیق موجودی هرگز عمومی نمی‌شود.
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setForm((p) => ({ ...p, show_prices: !p.show_prices }))}
            aria-pressed={form.show_prices}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-bold transition",
              form.show_prices
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-primary/40"
            )}
          >
            {form.show_prices ? "نمایش قیمت" : "بدون قیمت"}
          </button>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!canSave}>
          ذخیره
        </Button>
      </div>
    </div>
  );
}
