"use client";

import { MoreVertical, Save, Search, Trash2 } from "lucide-react";
import { Badge, Button, Card, DataTable, EmptyState, Field, IconButton, Input, NumberInput, Section, Select, Skeleton, StatusPill, Tabs, Textarea, useToast } from "@/src/shared/ui";
import { Money, PersianDate } from "@/src/shared/format";

const rows = [
  { id: "1", name: "بهرام محمدی", status: "unpaid", amount: 24180000 },
  { id: "2", name: "شال لینن فلورانس", status: "paid", amount: 4980000 },
];

export default function DesignSystemShowcasePage() {
  const { toast } = useToast();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground">Design System فاز B</h1>
        <p className="mt-1 text-sm text-muted-foreground">نمایش کامپوننت‌های پایه برای Panelها و Workspaceهای آینده.</p>
      </div>

      <Section title="Buttons" description="اکشن‌های اصلی و مالی">
        <div className="flex flex-wrap gap-2">
          <Button icon={<Save size={16} />}>ذخیره</Button>
          <Button variant="secondary">انصراف</Button>
          <Button variant="danger" icon={<Trash2 size={16} />}>حذف</Button>
          <Button variant="ghost">اکشن کم‌اهمیت</Button>
          <Button loading>در حال ذخیره</Button>
          <IconButton aria-label="گزینه‌ها"><MoreVertical size={18} /></IconButton>
        </div>
      </Section>

      <Section title="Inputs" description="فرم‌های فشرده مالی و RTL">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="نام مشتری" required><Input placeholder="مثلاً بهرام محمدی" /></Field>
          <Field label="مبلغ" hint="ورودی فارسی/انگلیسی پشتیبانی می‌شود"><NumberInput value={24180000} onValueChange={() => {}} /></Field>
          <Field label="وضعیت"><Select defaultValue="confirmed"><option value="confirmed">تأییدشده</option><option value="draft">پیش‌نویس</option></Select></Field>
          <Field label="توضیحات"><Textarea placeholder="یادداشت..." /></Field>
        </div>
      </Section>

      <Section title="Badges / StatusPill">
        <div className="flex flex-wrap gap-2">
          <Badge tone="primary">اصلی</Badge>
          <Badge tone="success">موفق</Badge>
          <Badge tone="warning">هشدار</Badge>
          <Badge tone="danger">خطر</Badge>
          <Badge tone="info">اطلاع</Badge>
          {(["draft", "confirmed", "paid", "settled", "reversed", "cancelled", "returned"] as const).map((s) => <StatusPill key={s} status={s} />)}
          {(["unpaid", "partial", "paid"] as const).map((s) => <StatusPill key={`p-${s}`} kind="payment" status={s} />)}
        </div>
      </Section>

      <Section title="Formatters">
        <div className="grid gap-3 md:grid-cols-3">
          <Card className="p-4"><div className="text-xs text-muted-foreground">پول</div><Money value={24180000} tone="debt" /></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">تاریخ شمسی</div><PersianDate value={new Date()} /></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Skeleton</div><Skeleton className="mt-2 h-8" /></Card>
        </div>
      </Section>

      <Section title="Table" action={<Button size="sm" icon={<Search size={14} />}>جستجو</Button>}>
        <DataTable
          rows={rows}
          keyExtractor={(row) => row.id}
          columns={[
            { key: "name", header: "عنوان", render: (row) => row.name },
            { key: "status", header: "وضعیت", render: (row) => <StatusPill kind="payment" status={row.status} /> },
            { key: "amount", header: "مبلغ", align: "left", render: (row) => <Money value={row.amount} tone={row.status === "unpaid" ? "debt" : "positive"} /> },
          ]}
        />
      </Section>

      <Section title="Tabs / Empty / Toast">
        <Tabs
          items={[
            { value: "one", label: "خلاصه", content: <EmptyState title="هنوز داده‌ای نیست" description="در پنل‌های واقعی، empty state عملیاتی نمایش داده می‌شود." /> },
            { value: "two", label: "پیام", content: <Button onClick={() => toast({ title: "عملیات موفق", description: "نمونه Toast سیستم", tone: "success" })}>نمایش Toast</Button> },
          ]}
        />
      </Section>
    </div>
  );
}
