"use client";

import { Package, Receipt, User, Wallet, X } from "lucide-react";
import type { PanelInstance } from "@/src/core/panel-manager/types";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";

function PanelShell({ panel, title, icon, children }: { panel: PanelInstance; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const { closeTop } = usePanelManager();
  return (
    <div className="flex h-full flex-col bg-white text-slate-900" dir="rtl">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon}</div>
          <div className="min-w-0">
            <div className="truncate text-base font-extrabold">{title}</div>
            <div className="mt-0.5 text-xs text-slate-500">حالت: {panel.mode} · لایه {panel.stackIndex + 1}</div>
          </div>
        </div>
        <button onClick={closeTop} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="بستن پنل">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5">{children}</div>
    </div>
  );
}

export function ContactPlaceholderPanel({ panel }: { panel: PanelInstance }) {
  const { openEntity } = usePanelManager();
  return (
    <PanelShell panel={panel} title="ContactPanel موقت" icon={<User size={20} />}>
      <div className="space-y-4 text-sm leading-7 text-slate-700">
        <p>این یک placeholder برای پنل رسمی مشتری است. در مرحله بعد با ContactPanel واقعی جایگزین می‌شود.</p>
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="text-xs text-slate-500">entityId</div>
          <div className="mt-1 break-all font-mono text-left" dir="ltr">{panel.entityId ?? "create-mode"}</div>
          {panel.title && <div className="mt-2 font-bold">{panel.title}</div>}
        </div>
        <button className="btn-primary" onClick={() => openEntity("product", undefined, { context: "dev-poc", title: "محصول نمونه" })}>
          باز کردن ProductPanel نمونه روی همین stack
        </button>
      </div>
    </PanelShell>
  );
}

export function ProductPlaceholderPanel({ panel }: { panel: PanelInstance }) {
  return (
    <PanelShell panel={panel} title="ProductPanel موقت" icon={<Package size={20} />}>
      <div className="space-y-4 text-sm leading-7 text-slate-700">
        <p>این پنل نمونه برای اثبات Panel Stack است.</p>
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="text-xs text-slate-500">entityId</div>
          <div className="mt-1 break-all font-mono text-left" dir="ltr">{panel.entityId ?? "sample-product"}</div>
        </div>
      </div>
    </PanelShell>
  );
}

export function InvoicePlaceholderPanel({ panel }: { panel: PanelInstance }) {
  return (
    <PanelShell panel={panel} title="InvoicePanel موقت" icon={<Receipt size={20} />}>
      <div className="space-y-4 text-sm leading-7 text-slate-700">
        <p>این placeholder برای سند فروش/خرید است و در مرحله InvoicePanel واقعی جایگزین می‌شود.</p>
        <div className="rounded-2xl bg-slate-50 p-4">
          <div>docType: <span className="font-bold">{panel.docType ?? "sale"}</span></div>
          <div className="break-all font-mono text-left" dir="ltr">{panel.entityId ?? "create-mode"}</div>
        </div>
      </div>
    </PanelShell>
  );
}

export function PaymentPlaceholderPanel({ panel }: { panel: PanelInstance }) {
  return (
    <PanelShell panel={panel} title="PaymentPanel موقت" icon={<Wallet size={20} />}>
      <p className="text-sm text-slate-600">Placeholder پرداخت؛ بعداً به TransactionPanel/PaymentPanel واقعی وصل می‌شود.</p>
    </PanelShell>
  );
}
