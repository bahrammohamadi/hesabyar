"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Building2, CheckCircle2, Clock, Inbox, MessageSquare,
  Send, UserPlus, UserMinus,
} from "lucide-react";
import { PageHeader, Spinner, EmptyState } from "@/components/shared/ui";
import { Badge, Button, Card, Modal, Select, Textarea, useToast } from "@/src/shared/ui";
import { toFaDigits, toJalali } from "@/lib/utils/format";
import {
  TICKET_CATEGORY_LABEL, TICKET_PRIORITIES, TICKET_PRIORITY_LABEL,
  TICKET_STATUS_STAFF, relativeFa,
  type TicketPriority, type TicketStatus,
} from "@/lib/support/tickets";
import { cn } from "@/lib/utils/cn";

/**
 * صف تیکت‌ها — تیم پشتیبانی.
 *
 * ترتیب پیش‌فرض «هرچه هنوز تمام نشده» است، نه «همه». صفحه‌ای که با
 * تیکت‌های بسته‌ی سه ماه پیش شروع شود، کار روزمره را کند می‌کند.
 */

type AdminTicket = {
  id: string;
  orgId: string | null;
  orgName: string;
  ownerName: string | null;
  creatorEmail: string | null;
  creatorName: string | null;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: keyof typeof TICKET_CATEGORY_LABEL;
  assignedTo: string | null;
  assigneeEmail: string | null;
  createdAt: string;
  lastMessageAt: string | null;
  lastMessageBy: string | null;
  firstResponseAt: string | null;
  messageCount: number;
  unread: boolean;
};

type Summary = {
  total: number; open: number; pending: number;
  unread: number; high: number; avgFirstResponseHours: number | null;
};

const FILTERS = [
  { key: "unresolved", label: "در جریان" },
  { key: "open", label: "نیازمند پاسخ" },
  { key: "pending", label: "منتظر مشتری" },
  { key: "resolved", label: "حل‌شده" },
  { key: "closed", label: "بسته" },
  { key: "", label: "همه" },
] as const;

export default function AdminTicketsPage() {
  const [filter, setFilter] = useState<string>("unresolved");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-tickets", filter],
    queryFn: async () => {
      const res = await fetch(`/api/admin/tickets?status=${encodeURIComponent(filter)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در دریافت تیکت‌ها");
      return json as { tickets: AdminTicket[]; summary: Summary };
    },
    refetchInterval: 60_000,
  });

  const tickets = data?.tickets ?? [];
  const s = data?.summary;

  return (
    <div className="space-y-4">
      <PageHeader
        title="تیکت‌های پشتیبانی"
        subtitle="پیام‌های کسب‌وکارها؛ زمان اولین پاسخ مهم‌ترین شاخص کیفیت پشتیبانی است"
      />

      {isLoading ? (
        <Spinner />
      ) : error ? (
        <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive-text">
          {(error as Error).message}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            <Tile icon={Inbox} label="کل تیکت‌ها" value={toFaDigits(s?.total ?? 0)} />
            <Tile
              icon={MessageSquare}
              label="نیازمند پاسخ"
              value={toFaDigits(s?.open ?? 0)}
              tone={(s?.open ?? 0) > 0 ? "danger" : "neutral"}
            />
            <Tile icon={Clock} label="منتظر مشتری" value={toFaDigits(s?.pending ?? 0)} />
            <Tile
              icon={AlertTriangle}
              label="فوری و باز"
              value={toFaDigits(s?.high ?? 0)}
              tone={(s?.high ?? 0) > 0 ? "warning" : "neutral"}
            />
            <Tile
              icon={CheckCircle2}
              label="میانگین اولین پاسخ"
              value={
                s?.avgFirstResponseHours == null
                  ? "—"
                  : `${toFaDigits(s.avgFirstResponseHours)} ساعت`
              }
            />
          </div>

          {/* فیلترها — روی موبایل نوار اسکرول افقی، بدون بریدگی */}
          <div
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
            tabIndex={0}
            role="group"
            aria-label="فیلتر وضعیت تیکت"
          >
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={cn(
                  "min-h-9 shrink-0 rounded-xl border px-3 text-xs font-bold transition",
                  filter === f.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {tickets.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="تیکتی در این وضعیت نیست"
              description="وقتی کسب‌وکاری تیکت بفرستد، اینجا نمایش داده می‌شود."
            />
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-border">
                {tickets.map((t) => (
                  <AdminTicketRow key={t.id} ticket={t} onOpen={() => setOpenId(t.id)} />
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {openId && <AdminTicketThread id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function Tile({
  icon: Icon, label, value, tone = "neutral",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone?: "neutral" | "warning" | "danger";
}) {
  const toneCls = {
    neutral: "bg-muted text-muted-foreground",
    warning: "bg-warning-soft text-warning-onSoft",
    danger: "bg-destructive/10 text-destructive-text",
  }[tone];

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", toneCls)} aria-hidden>
          <Icon size={15} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-2xs text-muted-foreground">{label}</span>
          <span className="block text-sm font-extrabold tabular-nums text-foreground">{value}</span>
        </span>
      </div>
    </Card>
  );
}

function AdminTicketRow({ ticket, onOpen }: { ticket: AdminTicket; onOpen: () => void }) {
  const status = TICKET_STATUS_STAFF[ticket.status] ?? TICKET_STATUS_STAFF.open;
  const when = ticket.lastMessageAt ?? ticket.createdAt;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-16 w-full items-start gap-3 p-3.5 text-right transition hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span
          className={cn(
            "mt-1 h-2 w-2 shrink-0 rounded-full",
            ticket.unread ? "bg-primary" : "bg-transparent"
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-bold text-foreground">{ticket.subject}</span>
            {ticket.unread && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-2xs font-extrabold text-primary-foreground">
                خوانده‌نشده
              </span>
            )}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Building2 size={11} aria-hidden />
              {ticket.orgName}
            </span>
            <span aria-hidden>·</span>
            <span>{TICKET_CATEGORY_LABEL[ticket.category] ?? "سایر"}</span>
            <span aria-hidden>·</span>
            <span>{toFaDigits(ticket.messageCount)} پیام</span>
            <span aria-hidden>·</span>
            <span>{relativeFa(when) ?? toJalali(when)}</span>
            {ticket.assigneeEmail && (
              <>
                <span aria-hidden>·</span>
                <span dir="ltr">{ticket.assigneeEmail}</span>
              </>
            )}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge tone={status.tone}>{status.label}</Badge>
          {ticket.priority === "high" && <Badge tone="danger">فوری</Badge>}
        </span>
      </button>
    </li>
  );
}

/* ─────────────────────── گفتگو (ادمین) ─────────────────────── */

type AdminMessage = {
  id: string; isStaff: boolean; body: string; createdAt: string; authorName: string;
};

function AdminTicketThread({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [reply, setReply] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-ticket", id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/tickets/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در دریافت تیکت");
      return json as { ticket: AdminTicket; messages: AdminMessage[]; canReply: boolean };
    },
    refetchInterval: 20_000,
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["admin-ticket", id] });
    qc.invalidateQueries({ queryKey: ["admin-tickets"] });
  }

  const send = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/tickets/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "ارسال ناموفق بود");
    },
    onSuccess: () => { setReply(""); refresh(); toast({ tone: "success", title: "پاسخ ارسال شد" }); },
    onError: (e: Error) => toast({ tone: "error", title: e.message }),
  });

  const patch = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch(`/api/admin/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "تغییر ناموفق بود");
    },
    onSuccess: () => { refresh(); toast({ tone: "success", title: "به‌روزرسانی شد" }); },
    onError: (e: Error) => toast({ tone: "error", title: e.message }),
  });

  const ticket = data?.ticket;
  const canReply = data?.canReply ?? false;

  return (
    <Modal open onClose={onClose} title={ticket?.subject ?? "تیکت"} size="xl" mobileFullscreen>
      {isLoading || !ticket ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          {/* زمینه‌ی کسب‌وکار — بدون آن، پشتیبان نمی‌داند با چه کسی طرف است */}
          <div className="rounded-2xl border border-border bg-muted/40 p-3">
            <dl className="grid gap-2 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-2xs text-muted-foreground">کسب‌وکار</dt>
                <dd className="font-bold text-foreground">{ticket.orgName}</dd>
              </div>
              <div>
                <dt className="text-2xs text-muted-foreground">فرستنده</dt>
                <dd className="font-bold text-foreground">
                  {ticket.creatorName ?? ticket.ownerName ?? "—"}
                  {ticket.creatorEmail && (
                    <span className="block font-normal text-muted-foreground" dir="ltr">
                      {ticket.creatorEmail}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-2xs text-muted-foreground">اولین پاسخ</dt>
                <dd className="font-bold text-foreground">
                  {ticket.firstResponseAt
                    ? relativeFa(ticket.firstResponseAt) ?? toJalali(ticket.firstResponseAt, true)
                    : "هنوز پاسخ نداده‌ایم"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={TICKET_STATUS_STAFF[ticket.status]?.tone ?? "neutral"}>
              {TICKET_STATUS_STAFF[ticket.status]?.label ?? ticket.status}
            </Badge>
            <Badge tone="neutral">{TICKET_CATEGORY_LABEL[ticket.category] ?? "سایر"}</Badge>
            {ticket.assigneeEmail ? (
              <Badge tone="info">مسئول: {ticket.assigneeEmail}</Badge>
            ) : (
              <Badge tone="warning">بدون مسئول</Badge>
            )}
          </div>

          <div
            className="max-h-[40vh] space-y-3 overflow-y-auto rounded-2xl border border-border bg-muted/30 p-3"
            tabIndex={0}
            role="log"
            aria-label="گفتگوی تیکت"
          >
            {data.messages.map((m) => (
              <div key={m.id} className={cn("flex", m.isStaff ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl border p-3",
                    m.isStaff ? "border-primary/20 bg-primary/5" : "border-border bg-card"
                  )}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className={cn("text-2xs font-extrabold", m.isStaff ? "text-primary" : "text-foreground")}>
                      {m.authorName}
                    </span>
                    <span className="text-2xs text-muted-foreground">
                      {relativeFa(m.createdAt) ?? toJalali(m.createdAt, true)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                    {m.body}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {!canReply ? (
            /*
              ادمینی که فقط مجوز مشاهده دارد. پنهان‌کردن فرم کافی نیست —
              روت هم ۴۰۳ می‌دهد — ولی نشان‌دادن فرمی که کار نمی‌کند
              بدترین حالت است.
            */
            <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
              شما فقط اجازه‌ی مشاهده‌ی تیکت‌ها را دارید. برای پاسخ‌دادن، مجوز «پاسخ به تیکت» لازم است.
            </p>
          ) : (
            <>
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (reply.trim().length < 5) {
                    toast({ tone: "error", title: "متن پاسخ را بنویسید" });
                    return;
                  }
                  send.mutate();
                }}
              >
                <label htmlFor="admin-reply" className="block text-sm font-bold text-foreground">
                  پاسخ تیم پشتیبانی
                </label>
                <Textarea
                  id="admin-reply"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={4}
                  maxLength={4000}
                  placeholder="پاسخ شما برای مشتری..."
                />
                <div className="flex justify-end">
                  <Button type="submit" loading={send.isPending} icon={<Send size={15} />}>
                    ارسال پاسخ
                  </Button>
                </div>
              </form>

              <div className="grid gap-2 border-t border-border pt-3 sm:grid-cols-3">
                <label className="block space-y-1.5">
                  <span className="text-2xs font-bold text-muted-foreground">وضعیت</span>
                  <Select
                    value={ticket.status}
                    onChange={(e) => patch.mutate({ status: e.target.value })}
                  >
                    {(Object.keys(TICKET_STATUS_STAFF) as TicketStatus[]).map((k) => (
                      <option key={k} value={k}>{TICKET_STATUS_STAFF[k].label}</option>
                    ))}
                  </Select>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-2xs font-bold text-muted-foreground">اولویت</span>
                  <Select
                    value={ticket.priority}
                    onChange={(e) => patch.mutate({ priority: e.target.value })}
                  >
                    {TICKET_PRIORITIES.map((p) => (
                      <option key={p} value={p}>{TICKET_PRIORITY_LABEL[p].label}</option>
                    ))}
                  </Select>
                </label>

                <div className="space-y-1.5">
                  <span className="block text-2xs font-bold text-muted-foreground">مسئول</span>
                  {ticket.assignedTo ? (
                    <Button
                      variant="secondary"
                      className="w-full"
                      loading={patch.isPending}
                      onClick={() => patch.mutate({ unassign: true })}
                      icon={<UserMinus size={14} />}
                    >
                      برداشتن مسئول
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      className="w-full"
                      loading={patch.isPending}
                      onClick={() => patch.mutate({ assign_to_me: true })}
                      icon={<UserPlus size={14} />}
                    >
                      من پیگیری می‌کنم
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
