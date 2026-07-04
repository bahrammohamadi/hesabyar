"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils/cn";
import { usePanelManager } from "./panel-manager.store";
import type { PanelInstance } from "./types";
import { PaymentPlaceholderPanel } from "@/src/shared/panels/PlaceholderPanels";
import { ContactPanel } from "@/src/shared/panels/ContactPanel";
import { InvoicePanel } from "@/src/shared/panels/InvoicePanel";
import { ProductPanel } from "@/src/shared/panels/ProductPanel";

function RenderPanel({ panel }: { panel: PanelInstance }) {
  if (panel.type === "contact") return <ContactPanel panel={panel} />;
  if (panel.type === "product") return <ProductPanel panel={panel} />;
  if (panel.type === "invoice") return <InvoicePanel panel={panel} />;
  if (panel.type === "payment") return <PaymentPlaceholderPanel panel={panel} />;
  return null;
}

export function PanelHost() {
  const { stack, topPanel, closeTop } = usePanelManager();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const shouldLock = stack.length > 0;
    if (!shouldLock) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [stack.length > 0]);

  useEffect(() => {
    if (stack.length === 0) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeTop();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [stack.length, closeTop]);

  if (stack.length === 0 || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: "var(--z-panel)" }} aria-live="polite">
      <button
        className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px] pointer-events-auto"
        onClick={closeTop}
        aria-label="بستن پنل فعال"
      />
      {stack.map((panel) => {
        const isTop = panel.id === topPanel?.id;
        const offset = Math.min(panel.stackIndex, 2) * 22;
        return (
          <section
            key={panel.id}
            role="dialog"
            aria-modal={isTop}
            aria-hidden={!isTop}
            className={cn(
              "pointer-events-auto fixed bottom-0 top-0 right-0 w-[min(92vw,560px)] overflow-hidden border-l border-slate-200 bg-white shadow-2xl transition-all duration-200 ease-out",
              isTop ? "translate-x-0 opacity-100" : "translate-x-6 opacity-75 pointer-events-none"
            )}
            style={{
              zIndex: 90 + panel.stackIndex,
              right: `${offset}px`,
              transform: isTop ? `translateX(0)` : `translateX(${offset + 12}px)`,
            }}
          >
            <RenderPanel panel={panel} />
          </section>
        );
      })}
    </div>,
    document.body
  );
}
