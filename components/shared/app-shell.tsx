"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { BottomNav } from "./bottom-nav";
import { DemoBanner } from "./demo-banner";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
