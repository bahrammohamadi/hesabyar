"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Package, Search, User } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { globalSearch, type GlobalSearchResult } from "@/src/core/services/search-service";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import type { DocumentType } from "@/src/core/panel-manager/types";
import { Badge, Input, Spinner } from "@/src/shared/ui";

function useDebouncedValue(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function resultIcon(type: GlobalSearchResult["result_type"]) {
  if (type === "contact") return <User size={16} />;
  if (type === "product") return <Package size={16} />;
  return <FileText size={16} />;
}

function resultTone(type: GlobalSearchResult["result_type"]) {
  if (type === "contact") return "primary" as const;
  if (type === "product") return "success" as const;
  return "info" as const;
}

export function GlobalSearchBar() {
  const { openEntity, openDocument } = usePanelManager();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const debouncedQuery = useDebouncedValue(query, 250);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!open || !debouncedQuery.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const rows = await globalSearch(debouncedQuery, 12);
        if (!cancelled) {
          setResults(rows);
          setActiveIndex(0);
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, open]);

  function selectResult(item: GlobalSearchResult) {
    if (item.result_type === "contact") openEntity("contact", item.id, { context: "global-search", title: item.title });
    else if (item.result_type === "product") openEntity("product", item.id, { context: "global-search", title: item.title });
    else {
      const metaDocType = typeof item.meta?.doc_type === "string" ? item.meta.doc_type : "sale";
      const docType: DocumentType = metaDocType === "purchase" ? "purchase" : "sale";
      openDocument(docType, item.id, { context: "global-search", title: item.title });
    }
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className="relative hidden min-w-[280px] max-w-xl flex-1 md:block" dir="rtl">
      <Search className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground" size={17} />
      <Input
        ref={inputRef}
        value={query}
        aria-label="جستجوی سراسری"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
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
            selectResult(results[activeIndex]);
          }
        }}
        className="h-10 min-h-10 rounded-2xl bg-muted pr-9 text-sm"
        placeholder="جستجوی مشتری، کالا، سند...  Ctrl+K"
      />

      {open && (query.trim() || loading) && (
        <div className="absolute right-0 top-12 z-[60] w-full overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          {loading ? (
            <Spinner label="در حال جستجو..." />
          ) : results.length === 0 ? (
            <div className="p-5 text-center text-sm text-muted-foreground">نتیجه‌ای یافت نشد.</div>
          ) : (
            <div className="max-h-96 overflow-y-auto p-2">
              {results.map((item, index) => (
                <button
                  key={`${item.result_type}-${item.id}-${index}`}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectResult(item)}
                  className={cn("flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-right transition", index === activeIndex ? "bg-primary/10" : "hover:bg-muted")}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">{resultIcon(item.result_type)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-extrabold text-foreground">{item.title}</div>
                    {item.subtitle && <div className="mt-0.5 truncate text-xs text-muted-foreground">{item.subtitle}</div>}
                  </div>
                  <Badge tone={resultTone(item.result_type)}>{item.result_type}</Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
