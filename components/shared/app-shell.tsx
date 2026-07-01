"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { BottomNav } from "./bottom-nav";
import { MobileFab } from "./mobile-fab";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar - visible on sm, togglable on xs */}
      <div className="hidden sm:block">
        <Sidebar open={true} onClose={() => {}} />
      </div>
      <div className="fixed inset-0 z-40 sm:hidden">
         <Sidebar open={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto pb-32 sm:pb-24 lg:pb-6">
          {children}
        </main>
      </div>
      <BottomNav />
      <MobileFab />
    </div>
  );
}
