"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { BottomNav } from "./bottom-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenu={() => setOpen(true)} />
        {/* فاصله پایین برای ناوبری موبایل (pb-20) */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto pb-24 lg:pb-6">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
