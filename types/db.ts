// تایپ‌های دیتابیس حساب‌یار — مطابق اسکیمای Supabase

export type Role = "owner" | "manager" | "cashier" | "inventory" | "accountant";
export type ContactType = "customer" | "supplier" | "both";
export type AccountType = "cash" | "bank";
export type TxType = "receipt" | "payment" | "expense" | "transfer" | "income";
export type TxMethod = "cash" | "card" | "transfer" | "cheque";

export interface Organization {
  id: string;
  name: string;
  owner_id: string;
  currency: string;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Branch {
  id: string;
  org_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Membership {
  id: string;
  org_id: string;
  branch_id: string | null;
  user_id: string;
  role: Role;
  is_active: boolean;
}

export interface Category {
  id: string;
  org_id: string;
  branch_id: string | null;
  name: string;
  parent_id: string | null;
  is_active: boolean;
}

export interface Brand {
  id: string;
  org_id: string;
  name: string;
  is_active: boolean;
}

export interface Product {
  id: string;
  org_id: string;
  branch_id: string | null;
  name: string;
  category_id: string | null;
  brand_id: string | null;
  description: string | null;
  image_url: string | null;
  base_purchase_price: number;
  base_sale_price: number;
  low_stock_threshold: number;
  is_active: boolean;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  org_id: string;
  product_id: string;
  color: string | null;
  size: string | null;
  sku: string | null;
  barcode: string | null;
  purchase_price: number | null;
  sale_price: number | null;
  stock_qty: number;
  is_active: boolean;
}

export interface Contact {
  id: string;
  org_id: string;
  branch_id: string | null;
  name: string;
  type: ContactType;
  phone: string | null;
  address: string | null;
  description: string | null;
  credit_limit: number;
  opening_balance: number;
  tags: string[];
  meta: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface Account {
  id: string;
  org_id: string;
  name: string;
  type: AccountType;
  bank_name: string | null;
  account_no: string | null;
  opening_balance: number;
  is_active: boolean;
}

export interface ExpenseCategory {
  id: string;
  org_id: string;
  name: string;
  is_active: boolean;
}

export interface Sale {
  id: string;
  org_id: string;
  branch_id: string | null;
  customer_id: string | null;
  invoice_no: string | null;
  date: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid_cash: number;
  paid_card: number;
  paid_credit: number;
  account_id: string | null;
  status: "draft" | "confirmed" | "cancelled" | "returned";
  note: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  org_id: string;
  type: TxType;
  amount: number;
  date: string;
  account_id: string | null;
  to_account_id: string | null;
  contact_id: string | null;
  expense_category_id: string | null;
  method: TxMethod;
  note: string | null;
  created_at: string;
}

export interface DashboardSummary {
  sales_today: number;
  sales_today_count: number;
  sales_month: number;
  expenses_month: number;
  profit_month: number;
  inventory_value: number;
  low_stock_count: number;
  cash_total: number;
  customers_debt: number;
  suppliers_credit: number;
}

// آیتم سبد فروش (سمت کلاینت)
export interface CartItem {
  variant_id: string;
  product_name: string;
  variant_label: string;
  qty: number;
  unit_price: number; // ریال
  discount: number; // ریال
  cost_price: number; // ریال
  stock_qty: number;
}
