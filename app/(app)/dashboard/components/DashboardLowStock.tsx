"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { toFaDigits } from "@/lib/utils/format";

export type DashboardLowStockItem = {
  variant_id: string;
  product_id: string | null;
  product_name: string;
  color: string | null;
  size: string | null;
  stock_qty: number;
  low_stock_threshold: number;
};

export function DashboardLowStock({ lowStockCount }: { lowStockCount: number; items?: DashboardLowStockItem[] }) {
  return (
    <div className={`card p-4 border-l-4 ${lowStockCount > 0 ? "border-l-rose-400 bg-rose-50/30" : "border-l-slate-200"}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-500">کالاهای کم‌موجود</div>
          <div className="text-xl font-bold text-slate-800">{toFaDigits(lowStockCount)} مورد</div>
        </div>
        <AlertTriangle className={lowStockCount > 0 ? "text-amber-500" : "text-slate-300"} size={24} />
      </div>
      {lowStockCount > 0 && (
        <Link href="/inventory/movements" className="text-xs text-amber-600 font-medium mt-2 inline-block hover:underline">
          بررسی و سفارش کالا →
        </Link>
      )}
    </div>
  );
}
