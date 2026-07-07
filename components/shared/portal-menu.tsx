"use client";

import { useLayoutEffect, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

export function PortalMenu({ anchorRef, open, onClose, children }: { anchorRef: RefObject<HTMLElement>; open: boolean; onClose: () => void; children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [style, setStyle] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 208 });
  useLayoutEffect(() => setMounted(true), []);
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const width = 208;
    const gap = 8;
    const top = Math.min(window.innerHeight - gap, rect.bottom + gap);
    const left = Math.min(Math.max(gap, rect.left + rect.width - width), window.innerWidth - width - gap);
    setStyle({ top, left, width });
  }, [anchorRef, open]);
  if (!open || !mounted) return null;
  return createPortal(
    <>
      <button className="fixed inset-0 z-[1250] bg-transparent" onClick={onClose} aria-label="بستن منو" />
      <div className="fixed z-[1260] rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl" style={{ top: style.top, left: style.left, width: style.width }} dir="rtl">
        {children}
      </div>
    </>,
    document.body
  );
}
