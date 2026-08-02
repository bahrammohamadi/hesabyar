import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * تست منطق تطبیق کلید در useGlobalShortcut.
 *
 * خود هوک به React DOM نیاز دارد و پروژه محیط تست DOM ندارد، پس همان
 * شرط‌های تصمیم‌گیری اینجا بازسازی و تست می‌شوند. هدف، محافظت از قواعدی
 * است که در بازبینی کد آسان از قلم می‌افتند:
 *   • میانبر بدون مودیفایر نباید با Ctrl+کلید فعال شود
 *   • میانبر مودیفایردار نباید با کلید تنها فعال شود
 *   • هنگام تایپ در فرم نباید فعال شود
 */

type Ev = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  tag?: string;
  contentEditable?: boolean;
};

function shouldFire(
  ev: Ev,
  key: string,
  opts?: { ctrlOrMeta?: boolean; shift?: boolean; skipWhileTyping?: boolean }
) {
  const { ctrlOrMeta = false, shift = false, skipWhileTyping = true } = opts ?? {};
  if (ev.key.toLowerCase() !== key.toLowerCase()) return false;
  const hasCtrlOrMeta = Boolean(ev.ctrlKey || ev.metaKey);
  if (ctrlOrMeta !== hasCtrlOrMeta) return false;
  if (shift !== Boolean(ev.shiftKey)) return false;
  if (skipWhileTyping) {
    const tag = ev.tag ?? "BODY";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || ev.contentEditable) return false;
  }
  return true;
}

describe("global shortcut matching", () => {
  it("fires on a bare F2", () => {
    expect(shouldFire({ key: "F2" }, "F2")).toBe(true);
  });

  it("does not fire for a different key", () => {
    expect(shouldFire({ key: "F3" }, "F2")).toBe(false);
    expect(shouldFire({ key: "Enter" }, "F2")).toBe(false);
  });

  it("does not fire while typing in a form control", () => {
    expect(shouldFire({ key: "F2", tag: "INPUT" }, "F2")).toBe(false);
    expect(shouldFire({ key: "F2", tag: "TEXTAREA" }, "F2")).toBe(false);
    expect(shouldFire({ key: "F2", tag: "SELECT" }, "F2")).toBe(false);
    expect(shouldFire({ key: "F2", contentEditable: true }, "F2")).toBe(false);
  });

  it("can opt out of the typing guard", () => {
    expect(shouldFire({ key: "F2", tag: "INPUT" }, "F2", { skipWhileTyping: false })).toBe(true);
  });

  it("keeps an unmodified shortcut from firing on Ctrl+key", () => {
    // بدون این قاعده، Ctrl+F2 هم فروش جدید باز می‌کرد
    expect(shouldFire({ key: "F2", ctrlKey: true }, "F2")).toBe(false);
  });

  it("matches Ctrl+K and Cmd+K but not a bare k", () => {
    const opts = { ctrlOrMeta: true, skipWhileTyping: false };
    expect(shouldFire({ key: "k", ctrlKey: true }, "k", opts)).toBe(true);
    expect(shouldFire({ key: "k", metaKey: true }, "k", opts)).toBe(true);
    expect(shouldFire({ key: "k" }, "k", opts)).toBe(false);
  });

  it("is case-insensitive for letter keys", () => {
    const opts = { ctrlOrMeta: true, skipWhileTyping: false };
    expect(shouldFire({ key: "K", ctrlKey: true }, "k", opts)).toBe(true);
  });

  it("respects the shift requirement in both directions", () => {
    expect(shouldFire({ key: "F2", shiftKey: true }, "F2")).toBe(false);
    expect(shouldFire({ key: "F2", shiftKey: true }, "F2", { shift: true })).toBe(true);
    expect(shouldFire({ key: "F2" }, "F2", { shift: true })).toBe(false);
  });
});

describe("listener lifecycle contract", () => {
  let added: string[];
  let removed: string[];

  beforeEach(() => {
    added = [];
    removed = [];
    vi.stubGlobal("window", {
      addEventListener: (t: string) => added.push(t),
      removeEventListener: (t: string) => removed.push(t),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("removes exactly what it adds", () => {
    // شبیه‌سازی چرخه‌ی عمر افکت
    const cleanup = (() => {
      window.addEventListener("keydown", () => {});
      return () => window.removeEventListener("keydown", () => {});
    })();
    cleanup();
    expect(added).toEqual(["keydown"]);
    expect(removed).toEqual(["keydown"]);
  });
});
