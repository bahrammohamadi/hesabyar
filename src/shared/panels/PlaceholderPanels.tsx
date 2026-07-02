"use client";

import { Package, Receipt, User, Wallet } from "lucide-react";
import type { PanelInstance } from "@/src/core/panel-manager/types";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import { Badge, Button, PanelShell, Section, StatusPill, Tabs } from "@/src/shared/ui";

export function ContactPlaceholderPanel({ panel }: { panel: PanelInstance }) {
  const { openEntity, closeTop } = usePanelManager();
  return (
    <PanelShell title="ContactPanel موقت" subtitle="اسکلت پنل مشتری — مرحله ۹ جایگزین می‌شود" icon={<User size={20} />} onClose={closeTop}>
      <div className="space-y-4">
        <Section title="شناسه موجودیت" description="State این پنل با باز شدن پنل‌های بالاتر حفظ می‌شود.">
          <div className="break-all rounded-xl bg-muted p-3 font-mono text-left text-sm" dir="ltr">{panel.entityId ?? "create-mode"}</div>
          {panel.title && <div className="mt-3"><Badge tone="primary">{panel.title}</Badge></div>}
        </Section>
        <Tabs
          items={[
            { value: "summary", label: "خلاصه", content: <p className="text-sm leading-7 text-muted-foreground">اینجا در مرحله بعد خلاصه مشتری، مانده، تماس‌ها و تعاملات نمایش داده می‌شود.</p> },
            { value: "finance", label: "مالی", content: <StatusPill kind="payment" status="unpaid" /> },
          ]}
        />
        <Button onClick={() => openEntity("product", undefined, { context: "dev-poc", title: "محصول نمونه" })}>
          باز کردن ProductPanel نمونه روی stack
        </Button>
      </div>
    </PanelShell>
  );
}

export function ProductPlaceholderPanel({ panel }: { panel: PanelInstance }) {
  const { closeTop } = usePanelManager();
  return (
    <PanelShell title="ProductPanel موقت" subtitle="اسکلت پنل کالا" icon={<Package size={20} />} onClose={closeTop}>
      <Section title="شناسه کالا / تنوع" description="در مرحله ۹ اطلاعات کالا، موجودی و تاریخچه قیمت اینجا می‌آید.">
        <div className="break-all rounded-xl bg-muted p-3 font-mono text-left text-sm" dir="ltr">{panel.entityId ?? "sample-product"}</div>
      </Section>
    </PanelShell>
  );
}

export function InvoicePlaceholderPanel({ panel }: { panel: PanelInstance }) {
  const { closeTop } = usePanelManager();
  return (
    <PanelShell title="InvoicePanel موقت" subtitle="اسکلت سند فروش/خرید" icon={<Receipt size={20} />} onClose={closeTop}>
      <Section title="سند" description="در مرحله InvoicePanel واقعی، header/lines/payment/status اینجا پیاده می‌شود.">
        <div className="flex items-center gap-2"><Badge tone="info">{panel.docType ?? "sale"}</Badge><StatusPill status="draft" /></div>
        <div className="mt-3 break-all font-mono text-left text-sm" dir="ltr">{panel.entityId ?? "create-mode"}</div>
      </Section>
    </PanelShell>
  );
}

export function PaymentPlaceholderPanel({ panel }: { panel: PanelInstance }) {
  const { closeTop } = usePanelManager();
  return (
    <PanelShell title="PaymentPanel موقت" subtitle="اسکلت پرداخت" icon={<Wallet size={20} />} onClose={closeTop}>
      <Section title="پرداخت">
        <p className="text-sm text-muted-foreground">بعداً به TransactionPanel/PaymentPanel واقعی وصل می‌شود.</p>
      </Section>
    </PanelShell>
  );
}
