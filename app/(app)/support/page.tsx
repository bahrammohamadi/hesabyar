"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2, LifeBuoy, MessageSquare, Plus, RotateCcw, Send,
} from "lucide-react";
import { PageHeader, Spinner, EmptyState } from "@/components/shared/ui";
import { Badge, Button, Card, Field, Modal, Select, Textarea, useToast } from "@/src/shared/ui";
import { toFaDigits, toJalali } from "@/lib/utils/format";
import {
  TICKET_CATEGORIES, TICKET_CATEGORY_HINT, TICKET_CATEGORY_LABEL,
  TICKET_PRIORITIES, TICKET_PRIORITY_LABEL, TICKET_STATUS_CUSTOMER,
  hasUnreadForCustomer, relativeFa,
  type TicketCategory, type TicketPriority, type TicketStatus,
} from "@/lib/support/tickets";
import { cn } from "@/lib/utils/cn";

/**
 * پشتیبانی — سمت مشتری.
 *
 * چرا تیکت و نه فقط شماره تماس؟
 *   تماس تلفنی ردپا ندارد. کاربر می‌گوید «سه بار زنگ زدم»، ما
 *   نمی‌دانیم به چه کسی و چه شد. تیکت تاریخچه‌ی مکتوب می‌سازد و
 *   وقتی همان مشکل دوباره پیش بیاید، جواب قبلی در دسترس است.
 */

type Ticket = {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  createdAt: string;
  lastMessageAt: string | null;
  lastMessageBy: string | null;
  customerReadAt: string | null;
  firstResponseAt: string | null;
  messageCount: number;
  isMine: boolean;
};

type Message = {
  id: string;
  isStaff: boolean;
  body: string;
  createdAt: string;
  authorName: string;
  isSelf: boolean;
};

export default function SupportPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["support-tickets"],
    queryFn: async (): Promise<Ticket[]> => {
      const res = await fetch("/api/support/tickets");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در دریافت تیکت‌ها");
      return json.tickets as Ticket[];
    },
  });

  const tickets = data ?? [];
  const openCount = tickets.filter((t) => t.status === "open" || t.status === "pending").length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="پشتیبانی"
        subtitle="سؤال یا مشکلتان را اینجا بنویسید؛ پاسخ در همین صفحه ثبت می‌شود و تاریخچه‌اش می‌ماند."
        action={
          <Button onClick={() => setCreating(true)} icon={<Plus size={15} />}>
            تیکت جدید
          </Button>
        }
      />

      {isLoading ? (
        <Spinner />
      ) : error ? (
        <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive-text">
          {(error as Error).message}
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="هنوز تیکتی ثبت نکرده‌اید"
          description="اگر با مشکلی روبه‌رو شدید یا سؤالی دارید، با دکمه‌ی «تیکت جدید» برای ما بنویسید."
          action={<Button onClick={() => setCreating(true)} icon={<Plus size={15} />}>تیکت جدید</Button>}
        />
      ) : (
        <>
          {openCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {toFaDigits(openCount)} تیکت در جریان دارید.
            </p>
          )}
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {tickets.map((t) => (
                <TicketRow key={t.id} ticket={t} onOpen={() => setOpenId(t.id)} />
              ))}
            </ul>
          </Card>
        </>
      )}

      <NewTicketModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          qc.invalidateQueries({ queryKey: ["support-tickets"] });
          toast({ tone: "success", title: "تیکت ثبت شد", description: "به‌زودی پاسخ می‌دهیم." });
          setOpenId(id);
        }}
      />

      {openId && <TicketThread id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

/* ─────────────────────── ردیف فهرست ─────────────────────── */

function TicketRow({ ticket, onOpen }: { ticket: Ticket; onOpen: () => void }) {
  const status = TICKET_STATUS_CUSTOMER[ticket.status] ?? TICKET_STATUS_CUSTOMER.open;
  const unread = hasUnreadForCustomer(ticket);
  const when = ticket.lastMessageAt ?? ticket.createdAt;

  return (
    <li>
      {/*
        کل ردیف یک دکمه است، نه فقط عنوان: هدف لمسی روی موبایل باید
        تمام عرض باشد. min-h-16 حداقل ۴۴px توصیه‌شده را با فاصله رد
        می‌کند.
      */}
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-16 w-full items-start gap-3 p-3.5 text-right transition hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span
          className={cn(
            "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
            unread ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}
          aria-hidden
        >
          <MessageSquare size={15} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-bold text-foreground">{ticket.subject}</span>
            {unread && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-2xs font-extrabold text-primary-foreground">
                پاسخ جدید
              </span>
            )}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-muted-foreground">
            <span>{TICKET_CATEGORY_LABEL[ticket.category] ?? "سایر"}</span>
            <span aria-hidden>·</span>
            <span>{toFaDigits(ticket.messageCount)} پیام</span>
            <span aria-hidden>·</span>
            <span>{relativeFa(when) ?? toJalali(when)}</span>
          </span>
        </span>

        <span className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge tone={status.tone}>{status.label}</Badge>
          {ticket.priority === "high" && ticket.status !== "closed" && (
            <Badge tone="danger">فوری</Badge>
          )}
        </span>
      </button>
    </li>
  );
}

/* ─────────────────────── تیکت جدید ─────────────────────── */

function NewTicketModal({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<TicketCategory>("technical");
  const [priority, setPriority] = useState<TicketPriority>("normal");

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, category, priority }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "ثبت تیکت ناموفق بود");
      return json.id as string;
    },
    onSuccess: (id) => {
      setSubject(""); setBody(""); setCategory("technical"); setPriority("normal");
      onCreated(id);
    },
    onError: (e: Error) => toast({ tone: "error", title: "ثبت ناموفق", description: e.message }),
  });

  return (
    <Modal open={open} onClose={onClose} title="تیکت جدید" size="lg" mobileFullscreen>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <Field label="موضوع" required hint="در یک جمله بگویید مشکل چیست">
          <input
            className="input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            placeholder="مثلاً: گزارش سود کالا عدد اشتباه نشان می‌دهد"
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="دسته" hint={TICKET_CATEGORY_HINT[category]}>
            <Select value={category} onChange={(e) => setCategory(e.target.value as TicketCategory)}>
              {TICKET_CATEGORIES.map((c) => (
                <option key={c} value={c}>{TICKET_CATEGORY_LABEL[c]}</option>
              ))}
            </Select>
          </Field>

          <Field
            label="فوریت"
            hint="«فوری» را وقتی بزنید که کارتان کاملاً متوقف شده است"
          >
            <Select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}>
              {TICKET_PRIORITIES.map((p) => (
                <option key={p} value={p}>{TICKET_PRIORITY_LABEL[p].label}</option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="شرح"
          required
          hint="چه کاری کردید، چه انتظاری داشتید و چه دیدید — هرچه دقیق‌تر، پاسخ سریع‌تر"
        >
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4000}
            rows={6}
            required
          />
        </Field>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>انصراف</Button>
          <Button type="submit" loading={create.isPending} icon={<Send size={15} />}>
            ارسال تیکت
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ─────────────────────── نخ گفتگو ─────────────────────── */

function TicketThread({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [reply, setReply] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["support-ticket", id],
    queryFn: async () => {
      const res = await fetch(`/api/support/tickets/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در دریافت تیکت");
      return json as { ticket: Ticket & { closedAt: string | null }; messages: Message[] };
    },
    /*
      وقتی گفتگو باز است، هر ۲۰ ثانیه تازه می‌شود.

      چرا polling و نه realtime؟ کانال realtime برای هر کاربرِ باز یک
      اتصال دائم می‌گیرد و سهمیه‌ی پلن رایگان محدود است. برای صفحه‌ای
      که چند دقیقه باز می‌ماند، یک درخواست هر ۲۰ ثانیه ارزان‌تر است.
    */
    refetchInterval: 20_000,
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["support-ticket", id] });
    qc.invalidateQueries({ queryKey: ["support-tickets"] });
  }

  const send = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/support/tickets/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "ارسال ناموفق بود");
    },
    onSuccess: () => { setReply(""); refresh(); },
    onError: (e: Error) => toast({ tone: "error", title: e.message }),
  });

  const setStatus = useMutation({
    mutationFn: async (status: "closed" | "open") => {
      const res = await fetch(`/api/support/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "تغییر وضعیت ناموفق بود");
      return status;
    },
    onSuccess: (status) => {
      refresh();
      toast({ tone: "success", title: status === "closed" ? "تیکت بسته شد" : "تیکت دوباره باز شد" });
    },
    onError: (e: Error) => toast({ tone: "error", title: e.message }),
  });

  const ticket = data?.ticket;
  const closed = ticket?.status === "closed";
  const status = ticket ? TICKET_STATUS_CUSTOMER[ticket.status] : null;

  return (
    <Modal open onClose={onClose} title={ticket?.subject ?? "گفتگو"} size="lg" mobileFullscreen>
      {isLoading || !ticket ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {status && <Badge tone={status.tone}>{status.label}</Badge>}
            <Badge tone="neutral">{TICKET_CATEGORY_LABEL[ticket.category] ?? "سایر"}</Badge>
            <Badge tone={TICKET_PRIORITY_LABEL[ticket.priority]?.tone ?? "neutral"}>
              فوریت: {TICKET_PRIORITY_LABEL[ticket.priority]?.label ?? "عادی"}
            </Badge>
            <span className="text-2xs text-muted-foreground">
              ثبت: {toJalali(ticket.createdAt, true)}
            </span>
          </div>

          {/*
            ارتفاع محدود + اسکرول.
            tabIndex=0 لازم است: بدون آن ناحیه‌ی اسکرول‌شونده با
            صفحه‌کلید قابل پیمایش نیست — همان ایرادی که axe در نوار
            قیمت‌ها و پنل اعلان‌ها گرفت.
          */}
          <div
            className="max-h-[45vh] space-y-3 overflow-y-auto rounded-2xl border border-border bg-muted/30 p-3"
            tabIndex={0}
            role="log"
            aria-label="گفتگوی تیکت"
          >
            {data.messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
          </div>

          {closed ? (
            <div className="rounded-2xl border border-dashed border-border p-4 text-center">
              <p className="text-sm text-muted-foreground">
                این تیکت بسته شده است.
              </p>
              <Button
                className="mt-3"
                variant="secondary"
                loading={setStatus.isPending}
                onClick={() => setStatus.mutate("open")}
                icon={<RotateCcw size={15} />}
              >
                بازکردن دوباره
              </Button>
            </div>
          ) : (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (reply.trim().length < 5) {
                  toast({ tone: "error", title: "متن پیام را بنویسید" });
                  return;
                }
                send.mutate();
              }}
            >
              <label htmlFor="support-reply" className="block text-sm font-bold text-foreground">
                پاسخ شما
              </label>
              <Textarea
                id="support-reply"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={3}
                maxLength={4000}
                placeholder="پاسخ یا توضیح بیشتر..."
              />
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="secondary"
                  loading={setStatus.isPending}
                  onClick={() => setStatus.mutate("closed")}
                  icon={<CheckCircle2 size={15} />}
                >
                  مشکلم حل شد، ببند
                </Button>
                <Button type="submit" loading={send.isPending} icon={<Send size={15} />}>
                  ارسال پاسخ
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </Modal>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const staff = message.isStaff;
  return (
    <div className={cn("flex", staff ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl border p-3",
          staff
            ? "border-primary/20 bg-primary/5"
            : "border-border bg-card"
        )}
      >
        <div className="mb-1 flex items-center gap-2">
          <span className={cn("text-2xs font-extrabold", staff ? "text-primary" : "text-foreground")}>
            {message.authorName}
          </span>
          <span className="text-2xs text-muted-foreground">
            {relativeFa(message.createdAt) ?? toJalali(message.createdAt, true)}
          </span>
        </div>
        {/*
          whitespace-pre-wrap: کاربر پیام را چندخطی می‌نویسد و بدون
          این، همه‌چیز در یک پاراگراف به هم می‌چسبد.
          break-words: چسباندن یک URL طولانی نباید عرض حباب را بترکاند.
        */}
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
          {message.body}
        </p>
      </div>
    </div>
  );
}
