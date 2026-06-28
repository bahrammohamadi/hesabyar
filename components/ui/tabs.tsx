"use client";

import * as React from "react";

export function Tabs({ children, defaultValue, className }: { children: React.ReactNode; defaultValue?: string; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`inline-flex h-10 items-center justify-center rounded-lg bg-slate-100 p-1 ${className || ""}`}>
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  // Simple implementation - in real app would use context
  return (
    <button 
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all ${className || ""}`}
      data-tab-value={value}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`mt-2 ${className || ""}`} data-tab-content={value}>
      {children}
    </div>
  );
}