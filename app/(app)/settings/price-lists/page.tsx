"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Tags, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { PageHeader, Spinner, EmptyState } from "@/components/shared/ui";
import { ProductSelector, type SelectableVariant } from "@/components/shared/product-selector";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { EntityLink } from "@/components/shared/entity-link";
import { formatToman, rialToToman, toEnDigits, toFaDigits, toJalali, tomanToRial } from "@/lib/utils/format";

type PriceList = { id: string; name: string; type: string; discount_percent: number; created_at: string };

export default function PriceListsPage() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState("sale");
  const [discount, setDiscount] = useState("0");
  const [selectedListId, setSelectedListId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingVariant, setPendingVariant] = useState<SelectableVariant | null>(null);
  const [customPrice, setCustomPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: lists, isLoading } = useQuery({
    queryKey: ["price-lists", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("price_lists").select("id,name,type,discount_percent,created_at").eq("is_active", true).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PriceList[];
    },
  });

  const selectedList = useMemo(() => lists?.find((list) => list.id === selectedListId) ?? lists?.[0] ?? null, [lists, selectedListId]);

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["price-list-items", selectedList?.id],
    enabled: !!selectedList?.id,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("price_list_items")
        .select("id,price,variant_id,variant:product_variants(id,color,size,sku,barcode,sale_price,product:products(id,name,code))")
        .eq("price_list_id", selectedList!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function addList() {
    if (!orgId || !name.trim()) return;
    setSaving(true); setError(null);
    const supabase = createClient();
    try {
      const { data, error } = await supabase.from("price_lists").insert({
        org_id: orgId,
        name: name.trim(),
        type,
        discount_percent: Number(toEnDigits(discount)) || 0,
      }).select("id").single();
      if (error) throw error;
      setName(""); setDiscount("0"); setSelectedListId(data.id);
      qc.invalidateQueries({ queryKey: ["price-lists"] });
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function removeList(id: string) {
    if (!confirm("لیست قیمت غیرفعال شود؟")) return;
    const supabase = createClient();
    await supabase.from("price_lists").update({ is_active: false }).eq("id", id);
    if (selectedListId === id) setSelectedListId("");
    qc.invalidateQueries({ queryKey: ["price-lists"] });
  }

  async function saveItem() {
    if (!orgId || !selectedList || !pendingVariant) return;
    const price = customPrice ? tomanToRial(Number(toEnDigits(customPrice)) || 0) : null;
    const supabase = createClient();
    const existing = (items ?? []).find((item: any) => item.variant_id === pendingVariant.variant_id);
    try {
      if (existing) {
        const { error } = await supabase.from("price_list_items").update({ price }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("price_list_items").insert({
          org_id: orgId,
          price_list_id: selectedList.id,
          variant_id: pendingVariant.variant_id,
          price,
        });
        if (error) throw error;
      }
      setPendingVariant(null); setCustomPrice("");
      qc.invalidateQueries({ queryKey: ["price-list-items", selectedList.id] });
    } catch (e) { setError((e as Error).message); }
  }

  async function removeItem(id: string) {
    const supabase = createClient();
    await supabase.from("price_list_items").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["price-list-items", selectedList?.id] });
  }

  return (
    <div>
      <PageHeader title="لیست قیمت‌ها" subtitle="تعریف چند لیست قیمت، تخفیف گروهی و قیمت اختصاصی برای کالاها" />

      <div className="card p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div><label className="label">نام لیست</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label className="label">نوع</label><select className="input" value={type} onChange={(e) => setType(e.target.value)}><option value="sale">فروش</option><option value="purchase">خرید</option><option value="vip">VIP</option></select></div>
          <div><label className="label">درصد تخفیف عمومی</label><input className="input" inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
          <div className="flex items-end"><button onClick={addList} disabled={saving} className="btn-primary w-full"><Plus size={16}/> افزودن لیست</button></div>
        </div>
        {error && <div className="rounded-xl bg-rose-50 text-rose-700 text-sm p-3 mt-3">{error}</div>}
      </div>

      {isLoading ? <Spinner /> : !lists?.length ? <EmptyState icon={Tags} title="لیست قیمتی ثبت نشده" /> : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            {lists.map((list) => (
              <button key={list.id} onClick={() => setSelectedListId(list.id)} className={`card p-4 w-full text-right transition ${selectedList?.id === list.id ? "border-primary/40 bg-primary/[0.06]" : "hover:border-primary/20"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-800">{list.name}</div>
                    <div className="text-xs text-slate-400 mt-1">نوع: {list.type} • تخفیف عمومی: {toFaDigits(list.discount_percent ?? 0)}٪ • ایجاد: {toJalali(list.created_at)}</div>
                  </div>
                  <span onClick={(e) => { e.stopPropagation(); removeList(list.id); }} className="text-slate-400 hover:text-rose-600"><Trash2 size={17}/></span>
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-2 card p-4">
            {!selectedList ? <EmptyState title="یک لیست قیمت انتخاب کنید" /> : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-bold text-slate-800">{selectedList.name}</h2>
                    <p className="text-xs text-slate-400 mt-1">اگر قیمت اختصاصی وارد نشود، تخفیف عمومی لیست روی قیمت فروش کالا اعمال می‌شود.</p>
                  </div>
                  <button onClick={() => setPickerOpen(true)} className="btn-primary"><Plus size={16}/> افزودن کالا</button>
                </div>

                {pendingVariant && (
                  <div className="rounded-2xl bg-slate-50 p-3 mb-4">
                    <div className="font-medium text-slate-800">{pendingVariant.product_name}</div>
                    <div className="text-xs text-slate-400 mt-1">قیمت فعلی: {formatToman(pendingVariant.sale_price)} • {[pendingVariant.color, pendingVariant.size].filter(Boolean).join(" / ") || "ساده"}</div>
                    <div className="flex gap-2 mt-3"><input className="input" inputMode="numeric" placeholder="قیمت اختصاصی (تومان)" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} /><button onClick={saveItem} className="btn-primary">ذخیره</button><button onClick={() => setPendingVariant(null)} className="btn-secondary">لغو</button></div>
                  </div>
                )}

                {itemsLoading ? <Spinner /> : !items?.length ? <EmptyState title="کالایی در این لیست نیست" /> : (
                  <div className="space-y-2">
                    {items.map((item: any) => {
                      const variant = item.variant;
                      const product = variant?.product;
                      const finalPrice = item.price ?? Math.max(0, Math.round((variant?.sale_price ?? 0) * (100 - (selectedList.discount_percent ?? 0)) / 100));
                      return (
                        <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2"><EntityLink type="product" id={product?.id}>{product?.name ?? "کالا"}</EntityLink><EntityActionMenu type="product" id={product?.id} label={product?.name ?? "کالا"} /></div>
                            <div className="text-xs text-slate-400 mt-1">{[variant?.color, variant?.size].filter(Boolean).join(" / ") || variant?.sku || "ساده"}</div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-left"><div className="font-bold text-primary">{formatToman(finalPrice, false)}</div><div className="text-xs text-slate-400">{item.price ? "قیمت اختصاصی" : "با تخفیف عمومی"}</div></div>
                            <button onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-rose-600"><Trash2 size={16}/></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <ProductSelector open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={(variant) => { setPendingVariant(variant); setCustomPrice(String(rialToToman(variant.sale_price))); setPickerOpen(false); }} />
    </div>
  );
}
