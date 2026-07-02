"use client";

import { MoreVertical, Package } from "lucide-react";
import type { PanelInstance } from "@/src/core/panel-manager/types";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import { useProductEntity, useProductStock, type ProductVariantEntity } from "@/src/core/services/product-service";
import { Badge, DataTable, EmptyState, IconButton, PanelShell, Section, Spinner, Tabs, type Column } from "@/src/shared/ui";
import { Money, PersianDate, toPersianDigits } from "@/src/shared/format";

function stockTone(stock: number) {
  if (stock <= 0) return "danger" as const;
  if (stock <= 3) return "warning" as const;
  return "success" as const;
}

export function ProductPanel({ panel }: { panel: PanelInstance }) {
  const { closeTop } = usePanelManager();
  const productId = panel.entityId;
  const productQuery = useProductEntity(productId);
  const stockQuery = useProductStock(productId);

  if (!productId) {
    return (
      <PanelShell title="کالای جدید" subtitle="حالت ایجاد در مرحله بعد فعال می‌شود" icon={<Package size={20} />} onClose={closeTop}>
        <EmptyState title="حالت ایجاد هنوز فعال نیست" description="این زیرمرحله فقط view-mode است." />
      </PanelShell>
    );
  }

  if (productQuery.isLoading) {
    return <PanelShell title="در حال بارگذاری کالا" icon={<Package size={20} />} onClose={closeTop}><Spinner /></PanelShell>;
  }

  if (productQuery.error) {
    return <PanelShell title="خطا" icon={<Package size={20} />} onClose={closeTop}><EmptyState title="خطا در دریافت کالا" description={(productQuery.error as Error).message} /></PanelShell>;
  }

  const product = productQuery.data;
  if (!product) {
    return <PanelShell title="کالا یافت نشد" icon={<Package size={20} />} onClose={closeTop}><EmptyState title="موجودیت یافت نشد" /></PanelShell>;
  }

  const stockByVariant = new Map((stockQuery.data ?? []).map((row) => [row.product_variant_id, row.current_stock]));
  const totalStock = (stockQuery.data ?? []).reduce((sum, row) => sum + row.current_stock, 0);

  const variantColumns: Column<ProductVariantEntity>[] = [
    { key: "sku", header: "SKU", render: (row) => <span className="font-mono" dir="ltr">{row.sku ?? "—"}</span> },
    { key: "barcode", header: "بارکد", render: (row) => <span className="font-mono" dir="ltr">{row.barcode ?? "—"}</span> },
    { key: "attrs", header: "تنوع", render: (row) => [row.color, row.size].filter(Boolean).join(" / ") || "ساده" },
    {
      key: "stock",
      header: "موجودی",
      align: "center",
      render: (row) => {
        const stock = stockByVariant.get(row.id) ?? row.stock_qty ?? 0;
        return <Badge tone={stockTone(stock)}>{toPersianDigits(stock)}</Badge>;
      },
    },
    { key: "purchase", header: "خرید", align: "left", render: (row) => <Money value={row.purchase_price ?? 0} /> },
    { key: "sale", header: "فروش", align: "left", render: (row) => <Money value={row.sale_price ?? 0} /> },
  ];

  return (
    <PanelShell
      title={product.name}
      subtitle={product.code ? `کد: ${product.code}` : "کالا"}
      icon={<Package size={20} />}
      onClose={closeTop}
      actions={<IconButton aria-label="گزینه‌های کالا"><MoreVertical size={18} /></IconButton>}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={product.is_active ? "success" : "neutral"}>{product.is_active ? "فعال" : "غیرفعال"}</Badge>
          {product.code && <Badge tone="primary">{product.code}</Badge>}
          <Badge tone={stockTone(totalStock)}>موجودی کل: {toPersianDigits(totalStock)}</Badge>
        </div>

        <Tabs
          items={[
            {
              value: "summary",
              label: "خلاصه",
              content: (
                <div className="space-y-4">
                  <Section title="اطلاعات کالا">
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div><dt className="text-muted-foreground">نام</dt><dd className="font-bold text-slate-800">{product.name}</dd></div>
                      <div><dt className="text-muted-foreground">کد</dt><dd className="font-mono" dir="ltr">{product.code ?? "—"}</dd></div>
                      <div><dt className="text-muted-foreground">فصل</dt><dd>{product.season ?? "—"}</dd></div>
                      <div><dt className="text-muted-foreground">جنس</dt><dd>{product.material ?? "—"}</dd></div>
                      <div><dt className="text-muted-foreground">دسته</dt><dd>{product.category?.name ?? "—"}</dd></div>
                      <div><dt className="text-muted-foreground">برند</dt><dd>{product.brand?.name ?? "—"}</dd></div>
                    </dl>
                  </Section>
                  <Section title="قیمت‌های پایه">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border p-3"><div className="text-sm text-muted-foreground">خرید پایه</div><Money value={product.base_purchase_price} /></div>
                      <div className="rounded-xl border border-border p-3"><div className="text-sm text-muted-foreground">فروش پایه</div><Money value={product.base_sale_price} /></div>
                    </div>
                  </Section>
                </div>
              ),
            },
            {
              value: "variants",
              label: "واریانت‌ها",
              content: (
                <DataTable
                  rows={product.variants}
                  columns={variantColumns}
                  keyExtractor={(row) => row.id}
                  empty={<EmptyState title="واریانتی برای این کالا ثبت نشده" />}
                />
              ),
            },
            {
              value: "stock",
              label: "موجودی",
              content: stockQuery.isLoading ? (
                <Spinner />
              ) : stockQuery.error ? (
                <EmptyState title="خطا در دریافت موجودی" description={(stockQuery.error as Error).message} />
              ) : (
                <Section title="خلاصه موجودی" description="بر اساس v_product_stock و SUM(stock_movements.qty)">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-border p-3"><div className="text-sm text-muted-foreground">موجودی کل</div><Badge tone={stockTone(totalStock)}>{toPersianDigits(totalStock)}</Badge></div>
                    <div className="rounded-xl border border-border p-3"><div className="text-sm text-muted-foreground">تعداد واریانت</div><strong>{toPersianDigits(product.variants.length)}</strong></div>
                    <div className="rounded-xl border border-border p-3"><div className="text-sm text-muted-foreground">آخرین حرکت</div><PersianDate value={stockQuery.data?.[0]?.last_movement_at ?? null} /></div>
                  </div>
                </Section>
              ),
            },
          ]}
        />
      </div>
    </PanelShell>
  );
}
