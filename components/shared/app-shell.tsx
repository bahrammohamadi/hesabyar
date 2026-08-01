"use client";

import { useEffect, useState } from "react";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { BottomNav } from "./bottom-nav";
import { DemoBanner } from "./demo-banner";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { openDocument } = usePanelManager();

  /*
    میانبر F2 برای فروش جدید.

    این میانبر در دو جا به کاربر وعده داده شده بود — برچسب «F2» روی دکمه‌ی
    داشبورد و صفحه‌ی راهنما — ولی هرگز پیاده‌سازی نشده بود. حالا که ساخت
    فاکتور یک پنل مشترک دارد، در سطح پوسته قابل اتصال است.

    وقتی کاربر در حال تایپ است نادیده گرفته می‌شود تا با فرم‌ها تداخل نکند.
  */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "F2") return;
      const el = document.activeElement as HTMLElement | null;
      const typing =
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable);
      if (typing) return;
      event.preventDefault();
      openDocument("sale", undefined, { mode: "create", context: "workspace" });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openDocument]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.08),transparent_30%),linear-gradient(180deg,hsl(var(--background)),#fff)] text-foreground lg:flex">
      <div className="hidden lg:block">
        <Sidebar open={true} onClose={() => {}} />
      </div>

      <div className="lg:hidden">
        <Sidebar open={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      </div>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:h-screen lg:overflow-y-auto">
        <DemoBanner />
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-7xl flex-1 shrink-0 px-3 py-4 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-6 lg:px-6 lg:pb-6">
          {children}
        </main>
      </div>

      <BottomNav onMoreClick={() => setIsSidebarOpen(true)} />
    </div>
  );
}
