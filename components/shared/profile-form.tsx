"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { Button, Field, useToast } from "@/src/shared/ui";

/**
 * ویرایش نام و شماره‌ی خودِ کاربر.
 *
 * 🔴 تا امروز نام فقط *نمایش* داده می‌شد. کسی که نامش را اشتباه وارد
 * کرده بود هیچ راهی جز تماس با پشتیبانی نداشت — همان وضعیتی که برای
 * تغییر رمز هم بود.
 */
export function ProfileForm() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["account-profile"],
    queryFn: async () => {
      const res = await fetch("/api/account/profile");
      if (!res.ok) throw new Error("خطا در دریافت اطلاعات");
      return (await res.json()) as {
        fullName: string; phone: string; email: string;
        orgName: string | null; isOwner: boolean;
      };
    },
  });

  /*
    مقدار اولیه فقط تا وقتی کاربر دست به فرم نزده پر می‌شود.
    بدون `touched`، هر بار که کوئری دوباره اجرا می‌شد (مثلاً با
    برگشتن به تب) نوشته‌ی نیمه‌کاره‌ی کاربر پاک می‌شد.
  */
  useEffect(() => {
    if (data && !touched) {
      setFullName(data.fullName ?? "");
      setPhone(data.phone ?? "");
    }
  }, [data, touched]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, phone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "ذخیره نشد");
    },
    onSuccess: () => {
      setTouched(false);
      qc.invalidateQueries({ queryKey: ["account-profile"] });
      // هدر نام را از این کوئری‌ها می‌خواند؛ بدون این، نام قدیمی
      // تا رفرش بعدی بالای صفحه می‌ماند.
      qc.invalidateQueries({ queryKey: ["account-current-user"] });
      qc.invalidateQueries({ queryKey: ["header-identity"] });
      toast({ tone: "success", title: "اطلاعات شما ذخیره شد" });
    },
    onError: (e: Error) => toast({ tone: "error", title: e.message }),
  });

  if (isLoading) return <div className="h-24 animate-pulse rounded-xl bg-muted" />;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="نام و نام خانوادگی" required hint="این نام بالای صفحه و روی فاکتورها دیده می‌شود">
          <input
            className="input"
            value={fullName}
            onChange={(e) => { setFullName(e.target.value); setTouched(true); }}
            maxLength={100}
            required
          />
        </Field>

        <Field label="موبایل" hint="برای بازیابی حساب و تماس پشتیبانی">
          <input
            className="input text-left"
            dir="ltr"
            inputMode="numeric"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setTouched(true); }}
            placeholder="09121234567"
          />
        </Field>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          loading={save.isPending}
          disabled={!touched || fullName.trim().length < 2}
          icon={<Save size={15} />}
        >
          ذخیره تغییرات
        </Button>
      </div>
    </form>
  );
}
