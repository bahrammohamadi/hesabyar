# 0023 — Z-index Layering / Portal Fix

## گام صفر

### z-indexهای فعلی قبل از اصلاح

| لایه | فایل | وضعیت قبلی |
|---|---|---|
| Header | `components/shared/header.tsx` | `z-20` |
| BottomNav | `components/shared/bottom-nav.tsx` | `z-30` |
| Sidebar overlay mobile | `components/shared/sidebar.tsx` | `z-30` |
| Sidebar | `components/shared/sidebar.tsx` | `z-40` |
| MobileFab | `components/shared/mobile-fab.tsx` | `z-40` |
| Modal پایه قدیمی | `components/shared/ui.tsx` | `z-50` |
| GlobalSearch dropdown | `src/shared/layout/GlobalSearchBar.tsx` | `z-[60]` |
| CoreRuntimeDevButton | `src/core/panel-manager/CoreRuntimeDevButton.tsx` | `z-[70]` |
| PanelHost | `src/core/panel-manager/PanelHost.tsx` | wrapper `z-[80]`, panel zIndex inline `90+stackIndex` |
| PickerHost | `src/core/picker/PickerHost.tsx` | `z-[120]` |
| Toast | `src/shared/ui/Toast.tsx` | `z-[150]` |
| ConfirmDialog | `src/shared/ui/ConfirmDialog.tsx` | `z-[170]` |

### مشکل

از نظر عددی PanelHost از Modal قدیمی بالاتر بود، اما overlayهای مختلف inline در React tree رندر می‌شدند. وقتی modalهای قدیمی داخل layoutهایی با overflow/stacking context باز می‌شدند، احتمال تداخل با stacking context وجود داشت.

### تصمیم

برای راه‌حل قطعی‌تر:

1. یک z-index scale رسمی با CSS variables تعریف شد.
2. overlayهای اصلی با React Portal مستقیماً به `document.body` وصل شدند:
   - Modal پایه قدیمی
   - PanelHost
   - PickerHost
   - ConfirmDialog
   - Toast container

این باعث می‌شود پنل‌های جدید از stacking contextهای والد مثل AppShell/Modal/Sidebar فرار کنند و همیشه بالاتر از Modalهای قدیمی باشند.

---

## z-index scale نهایی

```css
--z-base: 0;
--z-header: 30;
--z-sidebar: 40;
--z-modal: 1000;
--z-panel: 1100;
--z-picker: 1200;
--z-confirm: 1300;
--z-toast: 1400;
```

ترتیب منطقی:

```text
header/sidebar < modal قدیمی < panel جدید < picker < confirm < toast
```

---

## تست مورد انتظار

سناریوی اصلی:

```text
dashboard → فروش جدید → انتخاب مشتری → مشتری جدید → ContactPanel
```

باید نتیجه این باشد:

- ContactPanel کاملاً روی PosModal/ContactSelector دیده شود.
- Sidebar زیر Panel باشد.
- Toast بعد از ذخیره بالاتر از همه دیده شود.
- ConfirmDialog اگر باز شود بالاترین لایه تصمیم‌گیری باشد.

---

## نکته

Portal فقط DOM placement را تغییر می‌دهد و React context را حفظ می‌کند؛ پس `useToast`, `useConfirm`, `usePanelManager` همچنان کار می‌کنند.
