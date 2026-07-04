"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface DailySalesReportRow {
  org_id: string;
  sale_date: string;
  invoice_count: number;
  total_sales: number;
  total_discount: number;
}

export interface CustomerDebtReportRow {
  org_id: string;
  contact_id: string;
  contact_name: string;
  phone: string | null;
  total_sales: number;
  total_received: number;
  debt_amount: number;
  last_activity_at: string | null;
}

export interface ProductProfitabilityReportRow {
  org_id: string;
  product_id: string;
  product_variant_id: string;
  product_name: string;
  product_code: string | null;
  sku: string | null;
  barcode: string | null;
  qty_sold: number;
  sales_amount: number;
  cost_amount: number;
  gross_profit: number;
  gross_margin_percent: number;
}

export interface TopProductReportRow {
  org_id: string;
  product_id: string;
  product_variant_id: string;
  product_name: string;
  product_code: string | null;
  sku: string | null;
  barcode: string | null;
  qty_sold: number;
  sales_amount: number;
}

export interface MonthlyProfitReportRow {
  org_id: string;
  month_start: string;
  sales_amount: number;
  cost_amount: number;
  gross_profit: number;
}

export interface PurchaseSummaryReportRow {
  org_id: string;
  purchase_date: string;
  month_start: string;
  purchase_count: number;
  total_purchase: number;
  total_discount: number;
}

function applyDateRange<T extends { gte: (column: string, value: string) => T; lte: (column: string, value: string) => T }>(query: T, column: string, fromDate?: string, toDate?: string) {
  let next = query;
  if (fromDate) next = next.gte(column, fromDate);
  if (toDate) next = next.lte(column, toDate);
  return next;
}

export async function getDailySales(fromDate?: string, toDate?: string): Promise<DailySalesReportRow[]> {
  const supabase = createClient();
  let query = supabase.from("v_daily_sales").select("*").order("sale_date", { ascending: false });
  query = applyDateRange(query, "sale_date", fromDate, toDate);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as DailySalesReportRow[];
}

export async function getCustomerDebt(): Promise<CustomerDebtReportRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("v_customer_debt").select("*").order("debt_amount", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CustomerDebtReportRow[];
}

export async function getProductProfitability(): Promise<ProductProfitabilityReportRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("v_product_profitability").select("*").order("gross_profit", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProductProfitabilityReportRow[];
}

export async function getTopProducts(limit = 20): Promise<TopProductReportRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("v_top_products").select("*").order("qty_sold", { ascending: false }).order("sales_amount", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as TopProductReportRow[];
}

export async function getMonthlyProfit(fromDate?: string, toDate?: string): Promise<MonthlyProfitReportRow[]> {
  const supabase = createClient();
  let query = supabase.from("v_monthly_profit").select("*").order("month_start", { ascending: false });
  query = applyDateRange(query, "month_start", fromDate, toDate);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as MonthlyProfitReportRow[];
}

export async function getPurchaseSummary(): Promise<PurchaseSummaryReportRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("v_purchase_summary").select("*").order("purchase_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PurchaseSummaryReportRow[];
}

export function useDailySales(fromDate?: string, toDate?: string) {
  return useQuery({ queryKey: ["reports", "daily-sales", fromDate, toDate] as const, staleTime: 120_000, queryFn: () => getDailySales(fromDate, toDate) });
}

export function useCustomerDebt() {
  return useQuery({ queryKey: ["reports", "customer-debt"] as const, staleTime: 120_000, queryFn: getCustomerDebt });
}

export function useProductProfitability() {
  return useQuery({ queryKey: ["reports", "product-profitability"] as const, staleTime: 120_000, queryFn: getProductProfitability });
}

export function useTopProducts(limit = 20) {
  return useQuery({ queryKey: ["reports", "top-products", limit] as const, staleTime: 120_000, queryFn: () => getTopProducts(limit) });
}

export function useMonthlyProfit(fromDate?: string, toDate?: string) {
  return useQuery({ queryKey: ["reports", "monthly-profit", fromDate, toDate] as const, staleTime: 120_000, queryFn: () => getMonthlyProfit(fromDate, toDate) });
}

export function usePurchaseSummary() {
  return useQuery({ queryKey: ["reports", "purchase-summary"] as const, staleTime: 120_000, queryFn: getPurchaseSummary });
}
