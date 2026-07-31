#!/usr/bin/env node
/**
 * مهاجرت رنگ‌های هاردکد پالت Tailwind به توکن‌های معنایی پروژه.
 *
 * چرا لازم است:
 *   ۶۸۴ کلاس رنگ خام (slate-400، rose-600، …) در پنل بود. سه پیامد داشت:
 *    ۱. دارک‌مود می‌شکست — این رنگ‌ها ثابت‌اند و به .dark واکنش نمی‌دهند.
 *    ۲. تعویض تم روی آن‌ها اثر نداشت.
 *    ۳. کنتراست ناکافی: text-slate-400 روی سفید فقط ۲.۵۶ می‌دهد
 *       در حالی که WCAG AA حداقل ۴.۵ می‌خواهد.
 *
 * نگاشت بر پایه‌ی «نقش» انتخاب شده، نه شباهت رنگی:
 *   slate 400 و 500 → muted-foreground  (متن کم‌اهمیت)
 *   slate 700 و 800 → foreground        (متن اصلی)
 *   slate 50 و 100  → muted             (سطح فرعی)
 *   emerald         → success
 *   rose و red      → destructive
 *   amber و yellow  → warning
 *   blue و sky      → info
 *
 * اجرا:  node scripts/migrate-palette.mjs [--dry]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const DRY = process.argv.includes("--dry");

/** نگاشت دقیق کلاس‌ها. ترتیب مهم است: طولانی‌ترها اول. */
const MAP = [
  // ── خاکستری‌ها ─────────────────────────────────────────────
  ["text-slate-900", "text-foreground"],
  ["text-slate-800", "text-foreground"],
  ["text-slate-700", "text-foreground"],
  ["text-slate-600", "text-muted-foreground"],
  ["text-slate-500", "text-muted-foreground"],
  // slate-400 روی سفید فقط ۲.۵۶ کنتراست دارد → به توکن استاندارد
  ["text-slate-400", "text-muted-foreground"],
  ["text-slate-300", "text-muted-foreground"],
  ["text-gray-900", "text-foreground"],
  ["text-gray-800", "text-foreground"],
  ["text-gray-700", "text-foreground"],
  ["text-gray-600", "text-muted-foreground"],
  ["text-gray-500", "text-muted-foreground"],
  ["text-gray-400", "text-muted-foreground"],

  ["bg-slate-50", "bg-muted"],
  ["bg-slate-100", "bg-muted"],
  ["bg-slate-200", "bg-muted"],
  ["bg-slate-800", "bg-foreground"],
  ["bg-gray-50", "bg-muted"],
  ["bg-gray-100", "bg-muted"],

  ["border-slate-100", "border-border"],
  ["border-slate-200", "border-border"],
  ["border-slate-300", "border-border"],
  ["border-gray-100", "border-border"],
  ["border-gray-200", "border-border"],
  ["divide-slate-100", "divide-border"],
  ["divide-slate-200", "divide-border"],
  ["placeholder-slate-400", "placeholder-muted-foreground"],
  ["ring-slate-200", "ring-border"],

  // ── سبز / موفقیت ───────────────────────────────────────────
  ["text-emerald-800", "text-success-onSoft"],
  ["text-emerald-700", "text-success-onSoft"],
  // emerald-600 روی سفید ۳.۷۶ می‌دهد → توکن تیره‌تر
  ["text-emerald-600", "text-success-onSoft"],
  ["text-emerald-500", "text-success-onSoft"],
  ["text-green-700", "text-success-onSoft"],
  ["text-green-600", "text-success-onSoft"],
  ["bg-emerald-50", "bg-success-soft"],
  ["bg-emerald-100", "bg-success-soft"],
  ["bg-emerald-600", "bg-success"],
  ["bg-emerald-700", "bg-success"],
  ["bg-green-50", "bg-success-soft"],
  ["bg-green-100", "bg-success-soft"],
  ["border-emerald-200", "border-success/25"],
  ["border-emerald-100", "border-success/20"],

  // ── قرمز / خطر ─────────────────────────────────────────────
  ["text-rose-800", "text-destructive"],
  ["text-rose-700", "text-destructive"],
  ["text-rose-600", "text-destructive"],
  ["text-rose-500", "text-destructive"],
  ["text-rose-400", "text-destructive"],
  ["text-red-700", "text-destructive"],
  ["text-red-600", "text-destructive"],
  ["text-red-500", "text-destructive"],
  ["bg-rose-50", "bg-destructive/10"],
  ["bg-rose-100", "bg-destructive/15"],
  ["bg-red-50", "bg-destructive/10"],
  ["bg-red-100", "bg-destructive/15"],
  ["border-rose-100", "border-destructive/20"],
  ["border-rose-200", "border-destructive/25"],
  ["border-red-200", "border-destructive/25"],

  // ── زرد / هشدار ────────────────────────────────────────────
  ["text-amber-800", "text-warning-onSoft"],
  ["text-amber-700", "text-warning-onSoft"],
  ["text-amber-600", "text-warning-onSoft"],
  ["text-yellow-800", "text-warning-onSoft"],
  ["text-yellow-600", "text-warning-onSoft"],
  ["text-orange-600", "text-warning-onSoft"],
  ["bg-amber-50", "bg-warning-soft"],
  ["bg-amber-100", "bg-warning-soft"],
  ["bg-yellow-50", "bg-warning-soft"],
  ["bg-yellow-100", "bg-warning-soft"],
  ["border-amber-200", "border-warning/30"],

  // ── آبی / اطلاع ────────────────────────────────────────────
  ["text-blue-800", "text-info-onSoft"],
  ["text-blue-700", "text-info-onSoft"],
  ["text-blue-600", "text-info-onSoft"],
  ["text-sky-600", "text-info-onSoft"],
  ["text-cyan-600", "text-info-onSoft"],
  ["bg-blue-50", "bg-info-soft"],
  ["bg-blue-100", "bg-info-soft"],
  ["bg-sky-50", "bg-info-soft"],
  ["border-blue-200", "border-info/25"],

  // ── بنفش → از accent استفاده می‌کنیم ───────────────────────
  ["text-violet-700", "text-primary"],
  ["text-violet-600", "text-primary"],
  ["text-purple-600", "text-primary"],
  ["bg-violet-50", "bg-primary/10"],
  ["bg-violet-100", "bg-primary/15"],
  ["bg-purple-50", "bg-primary/10"],
];

/*
  فایل‌هایی که نگاشت «تونالیته» دارند (هر رنگ معنای متفاوتی می‌دهد).
  جایگزینی خودکار همه را یکسان می‌کند و تمایز بصری از بین می‌رود،
  پس دستی بازنویسی می‌شوند.
*/
const SKIP = new Set([
  "src/shared/ui/StatCard.tsx",
  "src/shared/ui/Badge.tsx",
]);

const files = execSync(
  `grep -rlE "\\b(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\\b" "app/(app)" components src 2>/dev/null || true`,
  { encoding: "utf8" }
)
  .split("\n")
  .filter((f) => f && /\.(tsx?|jsx?)$/.test(f) && !SKIP.has(f));

let totalChanges = 0;
let changedFiles = 0;

for (const file of files) {
  const original = readFileSync(file, "utf8");
  let content = original;
  let fileChanges = 0;

  for (const [from, to] of MAP) {
    // مرز کلمه در دو طرف تا "text-slate-4000" یا "-text-slate-400" تصادفی عوض نشود
    const re = new RegExp(`(?<![\\w-])${from}(?![\\w-])`, "g");
    const found = content.match(re);
    if (found) {
      content = content.replace(re, to);
      fileChanges += found.length;
    }
  }

  if (fileChanges > 0) {
    if (!DRY) writeFileSync(file, content, "utf8");
    console.log(`  ${String(fileChanges).padStart(3)} × ${file}`);
    totalChanges += fileChanges;
    changedFiles++;
  }
}

console.log(`\n${DRY ? "[dry-run] " : ""}${totalChanges} جایگزینی در ${changedFiles} فایل`);
