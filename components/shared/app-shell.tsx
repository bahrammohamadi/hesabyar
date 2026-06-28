"use client";

import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { BottomNav } from "./bottom-nav";
import { MobileFab } from "./mobile-fab";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden sm:block">
        <Sidebar open onClose={() => {}} />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        {/* فاصله پایین برای ناوبری موبایل (pb-20) */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto pb-32 sm:pb-24 lg:pb-6">
          {children}
        </main>
      </div>
      <BottomNav />
      <MobileFab />
    </div>
  );
}
