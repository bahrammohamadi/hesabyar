"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, Palette, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { PageHeader, Spinner } from "@/components/shared/ui";
import { applyTheme, DEFAULT_THEME, THEMES, THEME_STORAGE_KEY, THEME_CHANGE_EVENT, type ThemeId } from "@/lib/theme";

function ThemeSettingsInline() {
  const [selected, setSelected] = useState<ThemeId>(() => {
    if (typeof window === "undefined") return DEFAULT_THEME;
    return (window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null) ?? DEFAULT_THEME;
  });

  function choose(themeId: ThemeId) {
    setSelected(themeId);
    window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
    applyTheme(themeId);
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: themeId }));
  }

  return (
    <div className="rounded-[24px] border border-white/80 bg-white/90 p-5 shadow-sm shadow-slate-900/[0.04] backdrop-blur">
      <div className="mb-4 flex items-center gap-2 font-extrabold text-foreground"><Palette size={18} /> ظاهر برنامه</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {THEMES.map((theme) => (
          <button key={theme.id} type="button" onClick={() => choose(theme.id)} className={`rounded-2xl border p-4 text-right transition hover:shadow-sm ${selected === theme.id ? "border-primary bg-primary/[0.06]" : "border-border bg-white hover:border-primary/20"}`}>
            <div className="mb-3 flex gap-1">{theme.swatches.map((color) => <span key={color} className="h-7 w-7 rounded-full border border-white shadow-sm" style={{ backgroundColor: color }} />)}</div>
            <div className="text-sm font-bold text-foreground">{theme.name}</div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">{theme.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function GeneralSettingsPage() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const orgQuery = useQuery({
    queryKey: ["settings-general-org", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("organizations").select("id,name").eq("id", orgId).single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (orgQuery.data?.name) setName(orgQuery.data.name);
  }, [orgQuery.data?.name]);

  const updateOrg = useMutation({
    mutationFn: async () => {
      if (!orgId) return;
      const supabase = createClient();
      const { error } = await supabase.from("organizations").update({ name: name.trim() }).eq("id", orgId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings-general-org", orgId] }),
  });

  return (
    <div className="space-y-5">
      <PageHeader title="تنظیمات عمومی" subtitle="نام کسب‌وکار، ظاهر برنامه و تنظیمات عمومی" />
      {orgQuery.isLoading ? <Spinner /> : (
        <div className="rounded-[24px] border border-white/80 bg-white/90 p-5 shadow-sm shadow-slate-900/[0.04] backdrop-blur">
          <div className="mb-4 flex items-center gap-2 font-extrabold text-foreground"><Building2 size={18} /> اطلاعات کسب‌وکار</div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div>
              <label className="label">نام سازمان / فروشگاه</label>
              <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="نام کسب‌وکار" />
            </div>
            <button onClick={() => updateOrg.mutate()} disabled={updateOrg.isPending || !name.trim()} className="btn-primary self-end">
              {updateOrg.isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} ذخیره
            </button>
          </div>
          {updateOrg.isSuccess && <div className="mt-3 rounded-xl bg-success-soft p-3 text-sm text-success-onSoft">نام سازمان ذخیره شد.</div>}
          {updateOrg.error && <div className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{(updateOrg.error as Error).message}</div>}
        </div>
      )}
      <ThemeSettingsInline />
      <div className="rounded-[24px] border border-dashed border-border bg-muted/80 p-4 text-sm text-muted-foreground">تنظیمات عمومی فاکتور در مرحله بعد به همین صفحه اضافه می‌شود؛ در این مرحله هیچ منطق فاکتور تغییر نکرده است.</div>
    </div>
  );
}
