"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Plus, Eye, EyeOff } from "lucide-react";
import { PageHeader, Spinner, EmptyState } from "@/components/shared/ui";
import { Badge, Button, Card, Select, useToast } from "@/src/shared/ui";
import { toJalali } from "@/lib/utils/format";

type Announcement = {
  id: string;
  title: string;
  body: string | null;
  tone: "info" | "success" | "warning" | "danger";
  org_id: string | null;
  is_active: boolean;
  created_at: string;
};

const TONE_LABEL = {
  info: "اطلاع‌رسانی", success: "موفقیت", warning: "هشدار", danger: "بحرانی",
} as const;
const TONE_BADGE = {
  info: "info", success: "success", warning: "warning", danger: "danger",
} as const;

export default function AdminAnnouncementsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tone, setTone] = useState<Announcement["tone"]>("info");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async (): Promise<Announcement[]> => {
      const res = await fetch("/api/admin/announcements");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "خطا در دریافت اعلان‌ها");
      return json.announcements as Announcement[];
    },
  });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 3) {
      toast({ tone: "error", title: "عنوان را بنویسید" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), tone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "ثبت ناموفق بود");
      toast({ tone: "success", title: "اعلان منتشر شد" });
      setTitle(""); setBody(""); setTone("info"); setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    } catch (err) {
      toast({ tone: "error", title: "ثبت ناموفق", description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function toggle(a: Announcement) {
    setBusy(a.id);
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: a.id, is_active: !a.is_active }),
      });
      if (!res.ok) throw new Error("تغییر وضعیت ناموفق بود");
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    } catch (err) {
      toast({ tone: "error", title: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="اعلان‌های پلتفرم"
        subtitle="پیام‌هایی که در نوار بالای پنل و در زنگوله‌ی اعلان‌های همه‌ی کاربران نمایش داده می‌شود"
        action={
          <Button onClick={() => setOpen((v) => !v)} icon={<Plus size={15} />}>
            اعلان جدید
          </Button>
        }
      />

      {open && (
        <Card className="p-4">
          <form onSubmit={create} className="space-y-3">
            <div>
              <label htmlFor="ann-title" className="mb-1.5 block text-sm font-bold text-foreground">عنوان</label>
              <input
                id="ann-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً: قطعی کوتاه سرویس در شب جمعه"
                className="min-h-11 w-full rounded-xl border border-border bg-card px-3.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label htmlFor="ann-body" className="mb-1.5 block text-sm font-bold text-foreground">توضیح (اختیاری)</label>
              <textarea
                id="ann-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-border bg-card p-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="sm:w-52">
                <label htmlFor="ann-tone" className="mb-1.5 block text-sm font-bold text-foreground">نوع</label>
                <Select id="ann-tone" value={tone} onChange={(e) => setTone(e.target.value as Announcement["tone"])}>
                  {Object.entries(TONE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </div>
              <div className="flex gap-2 sm:mr-auto">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>انصراف</Button>
                <Button type="submit" loading={saving}>انتشار</Button>
              </div>
            </div>
          </form>
        </Card>
      )}

      {isLoading ? (
        <Spinner label="در حال بارگذاری..." />
      ) : error ? (
        <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive-text">{(error as Error).message}</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Megaphone} title="اعلانی ثبت نشده" description="با دکمه‌ی «اعلان جدید» اولین پیام را منتشر کنید." />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {rows.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-bold text-foreground">{a.title}</span>
                    <Badge tone={TONE_BADGE[a.tone]}>{TONE_LABEL[a.tone]}</Badge>
                    {!a.is_active && <Badge tone="neutral">غیرفعال</Badge>}
                    {a.org_id && <Badge tone="info">فقط یک کسب‌وکار</Badge>}
                  </div>
                  {a.body && <p className="mt-1 text-xs leading-5 text-muted-foreground">{a.body}</p>}
                  <p className="mt-1 text-2xs text-muted-foreground">{toJalali(a.created_at)}</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busy === a.id}
                  onClick={() => toggle(a)}
                  icon={a.is_active ? <EyeOff size={13} /> : <Eye size={13} />}
                >
                  {a.is_active ? "غیرفعال کن" : "فعال کن"}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
