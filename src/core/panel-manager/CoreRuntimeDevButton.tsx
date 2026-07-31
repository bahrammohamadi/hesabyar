"use client";

import { useEffect, useState } from "react";
import { Layers3, Search } from "lucide-react";

import { usePanelManager } from "./panel-manager.store";
import { usePicker } from "@/src/core/picker/usePicker";

export function CoreRuntimeDevButton() {
  const [enabled, setEnabled] = useState(false);
  const { openEntity, stack } = usePanelManager();
  const { openPicker } = usePicker();
  const [lastSelection, setLastSelection] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isEnabled = params.get("core_poc") === "1";
    setEnabled(isEnabled);
    if (isEnabled) console.info("Core Runtime PoC enabled. Use the floating button to test picker → panel stack.");
  }, []);

  if (!enabled) return null;

  return (
    <div className="fixed bottom-28 right-4 z-[70] flex flex-col items-start gap-2 rounded-2xl border border-border bg-white/95 p-3 text-right shadow-xl backdrop-blur" dir="rtl">
      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
        <Layers3 size={15} /> Core Runtime PoC · Stack: {stack.length}
      </div>
      {lastSelection && <div className="max-w-56 truncate text-[11px] text-muted-foreground">آخرین انتخاب: {lastSelection}</div>}
      <button
        className="btn-primary h-10 min-h-10 px-3 py-2 text-xs"
        onClick={() =>
          openPicker(
            "contact",
            (item) => {
              setLastSelection(item.title);
              openEntity("contact", item.id, { context: "picker", title: item.title, props: { selectedFromPicker: item } });
            },
            { title: "انتخاب مشتری برای تست پنل", placeholder: "نام یا شماره مشتری...", limit: 12, initialQuery: "0911" }
          )
        }
      >
        <Search size={14} /> تست Picker → ContactPanel
      </button>
      <button className="btn-secondary h-10 min-h-10 px-3 py-2 text-xs" onClick={() => openEntity("product", undefined, { context: "dev-poc", title: "محصول نمونه" })}>
        باز کردن ProductPanel نمونه
      </button>
    </div>
  );
}
