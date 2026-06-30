"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Tags, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { PageHeader, Spinner, EmptyState } from "@/components/shared/ui";
import { toEnDigits, toFaDigits, toJalali } from "@/lib/utils/format";

export default function PriceListsPage() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState("sale");
  const [discount, setDiscount] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["price-lists", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("price_lists").select("id,name,type,discount_percent,valid_from,valid_to,is_active,created_at").eq("is_active", true).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function add() {
    if (!orgId || !name.trim()) return;
    setSaving(true); setError(null);
    const supabase = createClient();
    try {
      const { error } = await supabase.from("price_lists").insert({
        org_id: orgId,
        name: name.trim(),
        type,
        discount_percent: Number(toEnDigits(discount)) || 0,
      });
      if (error) throw error;
      setName(""); setDiscount("0");
      qc.invalidateQueries({ queryKey: ["price-lists"] });
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm("لیست قیمت غیرفعال شود؟")) return;
    const supabase = createClient();
    await supabase.from("price_lists").update({ is_active: false }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["price-lists"] });
  }

  return (
    <div>
      <PageHeader title="لیست قیمت‌ها" subtitle="تعریف چند لیست قیمت و تخفیف برای فروشگاه" />
      <div className="card p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div><label className="label">نام لیست</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label className="label">نوع</label><select className="input" value={type} onChange={(e) => setType(e.target.value)}><option value="sale">فروش</option><option value="purchase">خرید</option><option value="vip">VIP</option></select></div>
          <div><label className="label">درصد تخفیف/تعدیل</label><input className="input" inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
          <div className="flex items-end"><button onClick={add} disabled={saving} className="btn-primary w-full"><Plus size={16}/> افزودن</button></div>
        </div>
        {error && <div className="rounded-xl bg-rose-50 text-rose-700 text-sm p-3 mt-3">{error}</div>}
      </div>

      {isLoading ? <Spinner /> : !data?.length ? <EmptyState icon={Tags} title="لیست قیمتی ثبت نشده" /> : (
        <div className="space-y-2">
          {data.map((list: any) => (
            <div key={list.id} className="card p-4 flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-slate-800">{list.name}</div>
                <div className="text-xs text-slate-400 mt-1">نوع: {list.type} • درصد: {toFaDigits(list.discount_percent ?? 0)}٪ • ایجاد: {toJalali(list.created_at)}</div>
              </div>
              <button onClick={() => remove(list.id)} className="text-slate-400 hover:text-rose-600"><Trash2 size={17}/></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
