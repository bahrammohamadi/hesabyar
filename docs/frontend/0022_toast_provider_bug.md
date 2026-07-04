# 0022 — رفع خطای `useToast must be used inside ToastProvider`

## 1) ترتیب Providerها قبل از اصلاح

فایل:

```text
components/providers.tsx
```

ترتیب قبلی:

```tsx
<QueryClientProvider>
  <ThemeProvider>
    <PanelManagerProvider>
      <ToastProvider>
        <ConfirmProvider>
          <PickerProvider>
            {children}
            <PickerHost />
            <CoreRuntimeDevButton />
          </PickerProvider>
        </ConfirmProvider>
      </ToastProvider>
    </PanelManagerProvider>
  </ThemeProvider>
</QueryClientProvider>
```

`PanelManagerProvider` در فایل زیر `PanelHost` را رندر می‌کند:

```text
src/core/panel-manager/PanelManagerProvider.tsx
```

ساختار:

```tsx
<PanelManagerStoreProvider>
  {children}
  <PanelHost />
</PanelManagerStoreProvider>
```

یعنی در ترتیب قبلی، `PanelHost` داخل `PanelManagerProvider` بود اما **بیرون از ToastProvider و ConfirmProvider** قرار می‌گرفت.

پس هر Panel که توسط PanelHost رندر می‌شد، از contextهای زیر محروم بود:

```text
ToastProvider
ConfirmProvider
PickerProvider
```

به همین دلیل ContactPanel هنگام استفاده از mutation hookهای `contact-service.ts` که `useToast()` دارند، خطا می‌داد:

```text
useToast must be used inside ToastProvider
```

---

## 2) بررسی Modal/Portal

`components/shared/ui.tsx` Modal فعلی از `ReactDOM.createPortal` یا `createRoot` جداگانه استفاده نمی‌کند.

Modal به صورت معمولی داخل همان React tree رندر می‌شود:

```tsx
return (
  <div className="fixed inset-0 ...">
    ...
  </div>
)
```

پس مشکل از Portal نبود.

---

## 3) بررسی ContactSelector

`ContactSelector` خودش `<ContactPanel />` را مستقیم رندر نمی‌کند.

کد فعلی:

```ts
const result = await openEntityForResult("contact", {...})
```

یعنی فقط stack مرکزی را push می‌کند. پس مشکل از رندر مستقیم ContactPanel داخل Selector نبود.

---

## 4) علت ریشه‌ای دقیق

علت دقیق:

> `PanelHost` خارج از `ToastProvider` و `ConfirmProvider` رندر می‌شد، چون `PanelManagerProvider` بیرون از آن‌ها قرار داشت و PanelHost را sibling بعد از children خودش رندر می‌کند.

---

## 5) اصلاح انجام‌شده

ترتیب Providerها اصلاح شد:

```tsx
<QueryClientProvider>
  <ThemeProvider>
    <ToastProvider>
      <ConfirmProvider>
        <PanelManagerProvider>
          <PickerProvider>
            {children}
            <PickerHost />
            <CoreRuntimeDevButton />
          </PickerProvider>
        </PanelManagerProvider>
      </ConfirmProvider>
    </ToastProvider>
  </ThemeProvider>
</QueryClientProvider>
```

حالا `PanelHost` داخل `PanelManagerProvider` است، و چون کل `PanelManagerProvider` داخل `ToastProvider/ConfirmProvider` قرار دارد، همه Panelها به `useToast` و `useConfirm` دسترسی دارند.

---

## 6) نتیجه مورد انتظار

سناریوی فروش:

1. باز کردن فروش جدید
2. باز کردن ContactSelector
3. کلیک روی «مشتری جدید»
4. باز شدن ContactPanel کامل
5. ذخیره contact
6. نمایش toast موفقیت
7. بازگشت contact ساخته‌شده به جریان فروش

دیگر نباید خطای `useToast must be used inside ToastProvider` رخ دهد.
