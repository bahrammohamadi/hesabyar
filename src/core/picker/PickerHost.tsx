"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { globalSearch, type GlobalSearchResult } from "@/src/core/services/search-service";
import { Badge, EmptyState, Input, Spinner } from "@/src/shared/ui";
import { usePicker } from "./usePicker";

function useDebouncedValue(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function PickerHost() {
  const { activePicker, closePicker } = usePicker();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debouncedQuery = useDebouncedValue(query, 250);

  useEffect(() => {
    if (!activePicker) return;
    setQuery(activePicker.options?.initialQuery ?? "");
    setResults([]);
    setActiveIndex(0);
    setError(null);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }, [activePicker]);

  useEffect(() => {
    if (!activePicker) return;
    let cancelled = false;
    async function run() {
      if (!debouncedQuery.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await globalSearch(debouncedQuery, activePicker?.options?.limit ?? 20);
        const filtered = activePicker?.type === "all" ? data : data.filter((item) => item.result_type === activePicker?.type);
        if (!cancelled) {
          setResults(filtered);
          setActiveIndex(0);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message || "خطا در جستجو");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [activePicker, debouncedQuery]);

  const title = activePicker?.options?.title ?? "انتخاب سریع";
  const placeholder = activePicker?.options?.placeholder ?? "جستجوی مشتری، کالا یا سند...";

  const typeLabel = useMemo(() => ({ contact: "مشتری", product: "کالا", document: "سند", all: "همه" }[activePicker?.type ?? "all"]), [activePicker?.type]);

  if (!activePicker) return null;

  function selectItem(item: GlobalSearchResult) {
    activePicker?.onSelect(item);
    closePicker();
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center bg-slate-950/35 p-3 pt-[10vh] backdrop-blur-sm" dir="rtl">
      <div className="w-full max-w-2xl overflow-hidden rounded-[24px] border border-white/70 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <div className="font-extrabold text-slate-800">{title}</div>
            <div className="text-xs text-slate-500">نوع: {typeLabel}</div>
          </div>
          <button onClick={closePicker} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="بستن انتخابگر">
            <X size={20} />
          </button>
        </div>
        <div className="relative border-b border-slate-100 p-3">
          <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") closePicker();
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((idx) => Math.min(idx + 1, Math.max(results.length - 1, 0)));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((idx) => Math.max(idx - 1, 0));
              }
              if (event.key === "Enter" && results[activeIndex]) {
                event.preventDefault();
                selectItem(results[activeIndex]);
              }
            }}
            className="pr-10"
            placeholder={placeholder}
          />
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {loading && <Spinner label="در حال جستجو..." />}
          {error && <div className="m-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
          {!loading && !error && query.trim() && results.length === 0 && <EmptyState title="نتیجه‌ای یافت نشد" description="عبارت دیگری را امتحان کنید." />}
          {!query.trim() && <EmptyState title="جستجوی سریع" description="برای شروع، عبارت جستجو را وارد کنید." />}
          {results.map((item, index) => (
            <button
              key={`${item.result_type}-${item.id}-${index}`}
              type="button"
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectItem(item)}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-right transition",
                index === activeIndex ? "bg-primary/10 text-primary" : "hover:bg-slate-50"
              )}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-extrabold">{item.title}</span>
                {item.subtitle && <span className="mt-0.5 block truncate text-xs text-slate-500">{item.subtitle}</span>}
              </span>
              <Badge tone={item.result_type === "contact" ? "primary" : item.result_type === "product" ? "success" : "info"}>{item.result_type}</Badge>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
