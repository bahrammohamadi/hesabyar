"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { PERMISSION_TREE, uniquePermissions, type PermissionTreeItem } from "@/lib/access/permission-tree";
import { toFaDigits } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { hasAll, togglePermissions } from "./users-access.helpers";

/**
 * ویرایشگر درختی مجوزها.
 *
 * 🔴 مشکل نسخه‌ی قبلی: هر ۹ گروه با تمام ۵۱ زیرگزینه هم‌زمان باز
 * بودند. کاربر برای دیدن گروه آخر باید کل صفحه را اسکرول می‌کرد و
 * هیچ نمای کلی‌ای از «چه چیزی انتخاب شده» نداشت.
 *
 * حالا هر گروه جمع‌شده است و کنارش می‌نویسد چند مورد از چند مورد
 * انتخاب شده. گروهی که چیزی از آن انتخاب شده باشد نشانه‌ی رنگی
 * می‌گیرد تا با یک نگاه معلوم باشد.
 */

function TreeCheckbox({
  checked, indeterminate, disabled, onChange, label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate && !checked);
  }, [checked, indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      // بدون aria-label، صفحه‌خوان فقط «checkbox» می‌گوید.
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      className="h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
    />
  );
}

export function PermissionTreeEditor({
  value,
  disabled,
  onChange,
}: {
  value: string[];
  disabled?: boolean;
  onChange: (next: string[]) => void;
}) {
  const effective = value.includes("*") ? uniquePermissions() : value;
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  function renderGroup(group: PermissionTreeItem) {
    const childPermissions = uniquePermissions(group.children ?? []);
    const groupPermissions = Array.from(new Set([...group.permissions, ...childPermissions]));
    const children = group.children ?? [];
    const checkedChildren = children.filter((child) => hasAll(effective, child.permissions)).length;
    const checked = hasAll(effective, groupPermissions);
    const indeterminate = checkedChildren > 0 && !checked;
    const open = openGroup === group.key;

    return (
      <div
        key={group.key}
        className={cn(
          "rounded-xl border transition",
          checked || indeterminate ? "border-primary/30 bg-primary/[0.03]" : "border-border bg-card"
        )}
      >
        <div className="flex items-center gap-2 p-2.5">
          <TreeCheckbox
            checked={checked}
            indeterminate={indeterminate}
            disabled={disabled}
            label={`همه‌ی دسترسی‌های ${group.label}`}
            onChange={(next) => onChange(togglePermissions(effective, groupPermissions, next))}
          />
          <button
            type="button"
            onClick={() => setOpenGroup(open ? null : group.key)}
            aria-expanded={open}
            disabled={children.length === 0}
            className="flex min-w-0 flex-1 items-center justify-between gap-2 text-right disabled:cursor-default"
          >
            <span className="truncate text-sm font-bold text-foreground">{group.label}</span>
            <span className="flex shrink-0 items-center gap-1.5 text-2xs text-muted-foreground">
              {children.length > 0 && (
                <>
                  {toFaDigits(checkedChildren)}/{toFaDigits(children.length)}
                  <ChevronDown
                    size={14}
                    className={cn("transition-transform", open && "rotate-180")}
                  />
                </>
              )}
            </span>
          </button>
        </div>

        {open && children.length > 0 && (
          <div className="border-t border-border p-2.5">
            {group.warning && (
              <div className="mb-2 rounded-lg bg-warning-soft px-2.5 py-1.5 text-2xs leading-5 text-warning-onSoft">
                ⚠️ {group.warning}
              </div>
            )}
            <div className="grid gap-1.5 md:grid-cols-2">
              {children.map((child) => {
                const childChecked = hasAll(effective, child.permissions);
                return (
                  <label
                    key={child.key}
                    className="flex cursor-pointer items-start gap-2 rounded-lg bg-muted px-2.5 py-2 text-sm"
                  >
                    <TreeCheckbox
                      checked={childChecked}
                      disabled={disabled}
                      label={child.label}
                      onChange={(next) =>
                        onChange(togglePermissions(effective, child.permissions, next))
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-foreground">
                        {child.label}
                      </span>
                      {child.warning && (
                        <span className="mt-0.5 block text-2xs leading-5 text-warning-onSoft">
                          ⚠️ {child.warning}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return <div className="space-y-2">{PERMISSION_TREE.map(renderGroup)}</div>;
}
