"use client";

import { useState } from "react";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import { useGlobalShortcut } from "@/lib/hooks/useGlobalShortcut";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { BottomNav } from "./bottom-nav";
import { MobileFab } from "./mobile-fab";
import { DemoBanner } from "./demo-banner";
import { TrialCountdown } from "./trial-countdown";
import { AnnouncementBanner } from "./announcement-banner";
import { ImpersonationBanner } from "./impersonation-banner";
import { UpdatePrompt } from "./update-prompt";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { openDocument } = usePanelManager();

  /*
    میانبر F2 — فروش جدید.

    برچسب «F2» روی دکمه‌ی داشبورد و در صفحه‌ی راهنما به کاربر وعده داده
    شده بود ولی هیچ listener‌ای وجود نداشت؛ صرفاً تزئینی بود.

    اینجا در AppShell ثبت می‌شود نه در صفحه‌ی داشبورد، چون وعده‌ی راهنما
    «در هر صفحه‌ای» است. منطق مشترک (نادیده‌گرفتن هنگام تایپ، پاک‌سازی
    listener) در useGlobalShortcut است تا در میانبرهای بعدی تکرار نشود.
  */
  useGlobalShortcut("F2", () => {
    openDocument("sale", undefined, { mode: "create", context: "workspace" });
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.08),transparent_30%),linear-gradient(180deg,hsl(var(--background)),#fff)] text-foreground lg:flex">
      <div className="hidden lg:block">
        <Sidebar open={true} onClose={() => {}} />
      </div>

      <div className="lg:hidden">
        <Sidebar open={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      </div>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:h-screen lg:overflow-y-auto">
        {/*
          ترتیب عمدی: نوار جعل هویت اول است چون بحرانی‌ترین وضعیت را
          نشان می‌دهد و نباید زیر اعلان‌ها گم شود.
        */}
        <ImpersonationBanner />
        <AnnouncementBanner />
        <DemoBanner />
        <TrialCountdown />
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-7xl flex-1 shrink-0 px-3 py-4 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-6 lg:px-6 lg:pb-6">
          {children}
        </main>
      </div>

      {/*
        دکمه‌ی شناور «دسترسی سریع» (موبایل).

        ⚠️ این کامپوننت از قبل نوشته شده بود ولی هیچ‌جا رندر نمی‌شد —
        کد مرده. BottomNav فقط ناوبری است (بین بخش‌ها جابه‌جا می‌شود)،
        پس در موبایل هیچ راه یک‌کلیکی برای «ساختن» چیزی وجود نداشت.

        جای قرارگیری: bottom-[96px] تا بالای BottomNav بنشیند (ارتفاع
        ۶۸px + فاصله‌ی ۱۲px) و رویش نیفتد.
      */}
      <MobileFab />
      <BottomNav onMoreClick={() => setIsSidebarOpen(true)} />
      <UpdatePrompt />
    </div>
  );
}
