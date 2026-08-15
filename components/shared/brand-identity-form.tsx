"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ImagePlus, Info, Save, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { Button, Card, Field, Input, useToast } from "@/src/shared/ui";
import { Spinner } from "@/components/shared/ui";
import {
  EMPTY_BRAND,
  LOGO_BUCKET,
  LOGO_MIME_TYPES,
  brandCompleteness,
  logoPath,
  normalizeBrand,
  validateLogoFile,
  type BrandIdentity,
} from "@/lib/brand-identity";
import { toFaDigits } from "@/lib/utils/format";

/**
 * فرم هویت برند — نام، لوگو و اطلاعات تماسی که روی فاکتور می‌نشیند.
 *
 * 🔴 چرا ساخته شد: صفحه‌ی فاکتور **لوگو و نام خودِ ترازو** را چاپ
 * می‌کرد. مشتری «مزون پوشاک» فاکتوری می‌گرفت که بالایش نوشته بود
 * «ترازو». ستون `organizations.logo_url` وجود داشت ولی هیچ‌جا پر
 * نمی‌شد — هر چهار سازمان زنده `null` داشتند.
 */

/** فیلدهای متنی، به‌ترتیب اهمیت روی فاکتور. */
const FIELDS: {
  key: keyof BrandIdentity;
  label: string;
  hint?: string;
  placeholder?: string;
  dir?: "ltr";
}[] = [
  { key: "display_name", label: "نام روی فاکتور", hint: "اگر خالی بماند، نام کسب‌وکار استفاده می‌شود." },
  { key: "slogan", label: "شعار یا زیرعنوان", placeholder: "مثلاً: پوشاک زنانه" },
  { key: "phone", label: "تلفن ثابت", dir: "ltr", placeholder: "۰۱۱۳۳۳۳۳۳۳۳" },
  { key: "mobile", label: "موبایل", dir: "ltr", placeholder: "۰۹۱۲۳۴۵۶۷۸۹" },
  { key: "address", label: "آدرس" },
  { key: "postal_code", label: "کد پستی", dir: "ltr" },
  { key: "email", label: "ایمیل", dir: "ltr" },
  { key: "website", label: "وب‌سایت", dir: "ltr", placeholder: "example.com" },
  { key: "instagram", label: "اینستاگرام", dir: "ltr", placeholder: "@myshop" },
  {
    key: "national_id",
    label: "شناسه ملی / کد ملی",
    dir: "ltr",
    hint: "برای فاکتور رسمی لازم است.",
  },
  { key: "economic_code", label: "کد اقتصادی", dir: "ltr" },
];

export function BrandIdentityForm() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<BrandIdentity>(EMPTY_BRAND);
  const [uploading, setUploading] = useState(false);

  const brandQuery = useQuery({
    queryKey: ["brand-identity", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_brand_identity", { p_org: orgId });
      if (error) throw error;
      return normalizeBrand(data);
    },
  });

  useEffect(() => {
    if (brandQuery.data) setForm(brandQuery.data);
  }, [brandQuery.data]);

  const save = useMutation({
    mutationFn: async (next: BrandIdentity) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("save_brand_identity", {
        p_org: orgId,
        p_brand: next,
      });
      if (error) throw error;
      return normalizeBrand(data);
    },
    onSuccess: (saved) => {
      setForm(saved);
      toast({ title: "اطلاعات برند ذخیره شد", tone: "success" });
      qc.invalidateQueries({ queryKey: ["brand-identity", orgId] });
      // هدر و سایدبار هم نام و لوگو را نشان می‌دهند.
      qc.invalidateQueries({ queryKey: ["org-context"] });
    },
    onError: (e) => toast({ title: (e as Error).message, tone: "error" }),
  });

  async function handleFile(file: File) {
    if (!orgId) return;
    const problem = validateLogoFile(file);
    if (problem) {
      toast({ title: problem, tone: "error" });
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      /*
        مسیر با orgId شروع می‌شود چون سیاست RLS سطل دقیقاً همان را
        می‌سنجد. تغییر ساختار مسیر یعنی آپلود رد می‌شود.
      */
      const path = logoPath(orgId, file.name);
      const { error: upErr } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
      const next = { ...form, logo_url: pub.publicUrl };
      setForm(next);
      // بلافاصله ذخیره می‌شود؛ آپلودی که ذخیره نشود، کاربر را گیج می‌کند.
      save.mutate(next);
    } catch (e) {
      toast({ title: "خطا در آپلود لوگو: " + (e as Error).message, tone: "error" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const completeness = brandCompleteness(form);

  if (brandQuery.isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-extrabold text-foreground">
          <Building2 size={17} aria-hidden />
          هویت برند
        </h2>
        <p className="mb-4 text-2xs leading-6 text-muted-foreground">
          این اطلاعات در سربرگ فاکتور، نسخه‌ی چاپی و تصویری که برای مشتری می‌فرستید
          دیده می‌شود.
        </p>

        {/* نوار پیشرفت — کاربر باید بداند چقدر مانده. */}
        {completeness.missing.length > 0 && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-info/25 bg-info-soft/60 p-3">
            <Info size={15} className="mt-0.5 shrink-0 text-info-onSoft" aria-hidden />
            <p className="text-2xs leading-6 text-info-onSoft">
              {toFaDigits(completeness.filled)} از {toFaDigits(completeness.total)} مورد کلیدی
              تکمیل شده. برای فاکتور حرفه‌ای این‌ها را هم پر کنید:{" "}
              <strong>{completeness.missing.join("، ")}</strong>
            </p>
          </div>
        )}

        {/* لوگو */}
        <div className="mb-5 flex flex-wrap items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted">
            {form.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.logo_url}
                alt="لوگوی کسب‌وکار"
                className="h-full w-full object-contain"
              />
            ) : (
              <ImagePlus size={24} className="text-muted-foreground/50" aria-hidden />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept={LOGO_MIME_TYPES.join(",")}
                className="sr-only"
                id="brand-logo-input"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
              {/*
                برچسب به‌جای دکمه: ورودی فایل بومی را نمی‌شود استایل داد،
                و دکمه‌ای که با JS کلیک را forward کند در بعضی مرورگرهای
                موبایل کار نمی‌کند.
              */}
              <label
                htmlFor="brand-logo-input"
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground transition hover:border-primary/40 hover:text-primary"
              >
                <Upload size={15} aria-hidden />
                {uploading ? "در حال آپلود…" : form.logo_url ? "تغییر لوگو" : "آپلود لوگو"}
              </label>

              {form.logo_url && (
                <Button
                  variant="ghost"
                  icon={<Trash2 size={15} />}
                  onClick={() => {
                    const next = { ...form, logo_url: null };
                    setForm(next);
                    save.mutate(next);
                  }}
                >
                  حذف لوگو
                </Button>
              )}
            </div>
            <p className="mt-2 text-2xs text-muted-foreground">
              PNG، JPG، WebP یا SVG · حداکثر ۲ مگابایت · ترجیحاً مربعی
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint}>
              <Input
                value={form[f.key] ?? ""}
                dir={f.dir}
                placeholder={f.placeholder}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            </Field>
          ))}

          <div className="sm:col-span-2">
            <Field
              label="یادداشت پای فاکتور"
              hint="مثلاً شرایط مرجوعی، ضمانت یا تشکر از مشتری. زیر جدول اقلام چاپ می‌شود."
            >
              <textarea
                className="input min-h-20 py-2"
                rows={3}
                value={form.invoice_note ?? ""}
                onChange={(e) => setForm({ ...form, invoice_note: e.target.value })}
                placeholder="کالای فروخته‌شده تا ۷ روز با فاکتور قابل تعویض است."
              />
            </Field>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            onClick={() => save.mutate(form)}
            loading={save.isPending}
            icon={<Save size={15} />}
          >
            ذخیره اطلاعات برند
          </Button>
        </div>
      </Card>
    </div>
  );
}
