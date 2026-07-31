"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debouncedQuery = useDebouncedValue(query, 250);

  useEffect(() => setMounted(true), []);

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

  if (!activePicker || !mounted) return null;

  function selectItem(item: GlobalSearchResult) {
    activePicker?.onSelect(item);
    closePicker();
  }

  return createPortal(
    <div className="fixed inset-0 flex items-start justify-center bg-foreground/35 p-3 pt-[10vh] backdrop-blur-sm" style={{ zIndex: "var(--z-picker)" }} dir="rtl">
      <div className="w-full max-w-2xl overflow-hidden rounded-[24px] border border-white/70 bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <div className="font-extrabold text-foreground">{title}</div>
            <div className="text-xs text-muted-foreground">نوع: {typeLabel}</div>
          </div>
          <button onClick={closePicker} className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted" aria-label="بستن انتخابگر">
            <X size={20} />
          </button>
        </div>
        <div className="relative border-b border-border p-3">
          <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
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
          {error && <div className="m-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
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
                index === activeIndex ? "bg-primary/10 text-primary" : "hover:bg-muted"
              )}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-extrabold">{item.title}</span>
                {item.subtitle && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.subtitle}</span>}
              </span>
              <Badge tone={item.result_type === "contact" ? "primary" : item.result_type === "product" ? "success" : "info"}>{item.result_type}</Badge>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
