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
    const originalBodyPosition = document.body.style.position;
    const originalBodyTop = document.body.style.top;
    const originalBodyWidth = document.body.style.width;
    const scrollY = window.scrollY;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.position = originalBodyPosition;
      document.body.style.top = originalBodyTop;
      document.body.style.width = originalBodyWidth;
      window.scrollTo(0, scrollY);
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

  useEffect(() => {
    if (!mounted || stack.length === 0) return;

    const previous = new Map<HTMLElement, { inert: boolean; ariaHidden: string | null }>();

    function shouldSkip(element: HTMLElement, panelRoot: Element | null) {
      if (panelRoot && element === panelRoot) return true;
      if (panelRoot && panelRoot.contains(element)) return true;
      const zIndex = element.style.zIndex;
      return zIndex.includes("--z-confirm") || zIndex.includes("--z-toast");
    }

    function markInactiveSiblings() {
      const panelRoot = document.querySelector("[data-panel-host-root='true']");
      Array.from(document.body.children).forEach((child) => {
        if (!(child instanceof HTMLElement)) return;
        if (shouldSkip(child, panelRoot)) return;
        if (!previous.has(child)) {
          previous.set(child, { inert: child.hasAttribute("inert"), ariaHidden: child.getAttribute("aria-hidden") });
        }
        child.setAttribute("inert", "");
        child.setAttribute("aria-hidden", "true");
      });
    }

    markInactiveSiblings();
    const observer = new MutationObserver(markInactiveSiblings);
    observer.observe(document.body, { childList: true });

    return () => {
      observer.disconnect();
      previous.forEach((state, element) => {
        if (state.inert) element.setAttribute("inert", "");
        else element.removeAttribute("inert");
        if (state.ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", state.ariaHidden);
      });
    };
  }, [mounted, stack.length]);

  if (stack.length === 0 || !mounted) return null;

  return createPortal(
    <div data-panel-host-root="true" className="fixed inset-0 isolate overflow-hidden overscroll-contain" style={{ zIndex: "var(--z-panel)", height: "100dvh" }} aria-live="polite">
      <button
        className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px] pointer-events-auto animate-fade-in"
        style={{ zIndex: 0 }}
        onClick={closeTop}
        aria-label="بستن پنل فعال"
      />
      {stack.slice(-4).map((panel) => {
        const isTop = panel.id === topPanel?.id;
        const offset = Math.min(panel.stackIndex, 2) * 22;
        return (
          <section
            key={panel.id}
            role="dialog"
            aria-modal={isTop}
            aria-hidden={!isTop}
            onWheel={(event) => event.stopPropagation()}
            onTouchMove={(event) => event.stopPropagation()}
            className={cn(
              "pointer-events-auto fixed bottom-0 top-0 right-0 overscroll-contain overflow-hidden border-l border-border bg-card shadow-2xl",
              // ورود فقط برای پنل رویی؛ پنل‌های زیرین از قبل جا افتاده‌اند.
              isTop && "animate-slide-in",
              "transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none",
              isTop ? "translate-x-0 opacity-100" : "translate-x-6 opacity-75 pointer-events-none"
            )}
            style={{
              zIndex: 10 + panel.stackIndex,
              right: `${offset}px`,
              width: "min(100vw, 560px)",
              maxWidth: "100vw",
              height: "100dvh",
              maxHeight: "100dvh",
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
