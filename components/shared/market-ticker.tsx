"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  GripVertical,
  Moon,
  Plus,
  RefreshCw,
  Settings2,
  Sun,
  TrendingDown,
  TrendingUp,
  Wind,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { toFaDigits } from "@/lib/utils/format";
import { TGJU_SYMBOLS, type MarketQuote } from "@/lib/market/providers";
import { IRAN_CITIES, type WeatherIcon, type WeatherNow } from "@/lib/market/weather";
import { loadPrefs, savePrefs, moveItem, PREFS_EVENT, type TickerPrefs } from "@/lib/market/preferences";
import { formatChange, formatQuoteValue, formatTemp, unitLabel } from "@/lib/market/format";

/**
 * نوار قیمت و آب‌وهوا در هدر.
 *
 * تصمیم‌های چیدمانی:
 *   • ارتفاع کم و اسکرول افقی به‌جای شکستن خط — نوار نباید ارتفاع
 *     هدر را در موبایل دو برابر کند.
 *   • بدون انیمیشن روان خودکار (marquee): در محیط کاری، متن متحرک
 *     مزاحم است و خواندن عدد را سخت می‌کند. کاربر خودش اسکرول می‌کند.
 *   • هر کاشی یک واحد مستقل است تا شخصی‌سازی معنا داشته باشد.
 */

const WEATHER_ICONS: Record<WeatherIcon, typeof Sun> = {
  sun: Sun,
  moon: Moon,
  "cloud-sun": CloudSun,
  "cloud-moon": CloudMoon,
  cloud: Cloud,
  "cloud-fog": CloudFog,
  "cloud-drizzle": CloudDrizzle,
  "cloud-rain": CloudRain,
  "cloud-snow": CloudSnow,
  "cloud-lightning": CloudLightning,
};

export function MarketTicker() {
  const [prefs, setPrefs] = useState<TickerPrefs | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  /*
    تنظیمات بعد از mount خوانده می‌شود.

    🔴 اگر مستقیم در useState اولیه خوانده شود، رندر سرور (که
    localStorage ندارد) با رندر کلاینت فرق می‌کند و React خطای
    hydration mismatch می‌دهد. `null` یعنی «هنوز نمی‌دانیم».
  */
  useEffect(() => {
    setPrefs(loadPrefs());
    function onPrefs(event: Event) {
      const detail = (event as CustomEvent<TickerPrefs>).detail;
      if (detail) setPrefs(detail);
    }
    window.addEventListener(PREFS_EVENT, onPrefs);
    return () => window.removeEventListener(PREFS_EVENT, onPrefs);
  }, []);

  const enabled = prefs?.enabled ?? false;

  const marketQuery = useQuery({
    queryKey: ["market-quotes"],
    enabled,
    queryFn: async () => {
      const res = await fetch("/api/market");
      const json = await res.json();
      return json as { quotes: MarketQuote[]; updatedAt: string | null; stale: boolean; error?: string };
    },
    // سرور ۹۰ ثانیه کش دارد؛ زودتر پرسیدن فقط همان کش را برمی‌گرداند.
    refetchInterval: 120_000,
    staleTime: 90_000,
    // خطای شبکه نباید نوار را حذف کند؛ داده‌ی قبلی می‌ماند.
    retry: 1,
  });

  const weatherQuery = useQuery({
    queryKey: ["weather", prefs?.cityId],
    enabled: enabled && !!prefs?.showWeather && !!prefs?.cityId,
    queryFn: async () => {
      const res = await fetch(`/api/weather?city=${encodeURIComponent(prefs!.cityId)}`);
      const json = await res.json();
      return json as { weather: WeatherNow | null; stale: boolean };
    },
    refetchInterval: 15 * 60_000,
    staleTime: 10 * 60_000,
    retry: 1,
  });

  const update = useCallback((next: TickerPrefs) => {
    setPrefs(next);
    savePrefs(next);
  }, []);

  const visibleQuotes = useMemo(() => {
    const all = marketQuery.data?.quotes ?? [];
    if (!prefs) return [];
    const byId = new Map(all.map((q) => [q.id, q]));
    // ترتیب از تنظیمات کاربر می‌آید، نه از ترتیب پاسخ سرور.
    return prefs.quoteIds.map((id) => byId.get(id)).filter((q): q is MarketQuote => !!q);
  }, [marketQuery.data, prefs]);

  // پیش از خواندن تنظیمات چیزی رندر نمی‌شود تا پرش نداشته باشیم.
  if (!prefs) return null;

  if (!prefs.enabled) {
    return (
      <>
        <div className="flex justify-end border-b border-border bg-muted/30 px-3 py-1 sm:px-5 lg:px-6">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="inline-flex min-h-7 items-center gap-1 rounded-lg px-2 text-2xs font-bold text-muted-foreground transition hover:bg-muted hover:text-primary"
          >
            <Settings2 size={12} aria-hidden />
            نمایش نوار قیمت‌ها
          </button>
        </div>
        {settingsOpen && (
          <TickerSettings prefs={prefs} onChange={update} onClose={() => setSettingsOpen(false)} />
        )}
      </>
    );
  }

  const weather = weatherQuery.data?.weather ?? null;
  const isLoading = marketQuery.isLoading && visibleQuotes.length === 0;
  const failed = !isLoading && visibleQuotes.length === 0 && prefs.quoteIds.length > 0;

  return (
    <>
      <div className="border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 px-3 py-1.5 sm:px-5 lg:px-6">
          {/*
            اسکرول افقی با پنهان‌کردن نوار اسکرول. در RTL جهت طبیعی
            راست‌به‌چپ است و مرورگر خودش مدیریت می‌کند.

            🔴 tabIndex و role از axe آمد: در موبایل محتوا از عرض
            بیرون می‌زند (۶۵۹px در ظرف ۳۳۰px) و بدون فوکوس‌پذیری،
            کاربر صفحه‌کلید هیچ راهی برای دیدن قیمت‌های پنهان نداشت
            (تخلف serious/scrollable-region-focusable).

            در دسکتاپ و تبلت محتوا جا می‌شود و اسکرولی در کار نیست،
            پس این ویژگی‌ها فقط جایی که لازم است اثر دارند.
          */}
          <div
            className="ticker-scroll flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label="قیمت‌های بازار و آب‌وهوا"
          >
            {prefs.showWeather && weather && <WeatherTile weather={weather} />}

            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-6 w-24 shrink-0 animate-pulse rounded-lg bg-muted" />
              ))}

            {visibleQuotes.map((quote) => (
              <QuoteTile key={quote.id} quote={quote} />
            ))}

            {failed && (
              <span className="shrink-0 text-2xs text-muted-foreground">
                قیمت‌ها در دسترس نیست
              </span>
            )}

            {!isLoading && prefs.quoteIds.length === 0 && !prefs.showWeather && (
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-2xs font-bold text-primary transition hover:bg-primary/10"
              >
                <Plus size={12} aria-hidden />
                افزودن قیمت
              </button>
            )}
          </div>

          {/* نشانگر داده‌ی کهنه — صادق بودن درباره‌ی تازگی داده */}
          {marketQuery.data?.stale && visibleQuotes.length > 0 && (
            <span
              className="hidden shrink-0 text-2xs text-warning sm:inline"
              title="آخرین به‌روزرسانی ناموفق بود؛ عدد نمایش‌داده‌شده قدیمی است."
            >
              قدیمی
            </span>
          )}

          <button
            type="button"
            onClick={() => marketQuery.refetch()}
            aria-label="به‌روزرسانی قیمت‌ها"
            className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-primary sm:flex"
          >
            <RefreshCw size={13} className={cn(marketQuery.isFetching && "animate-spin")} aria-hidden />
          </button>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="تنظیمات نوار قیمت‌ها"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-primary"
          >
            <Settings2 size={13} aria-hidden />
          </button>
        </div>
      </div>

      {settingsOpen && (
        <TickerSettings prefs={prefs} onChange={update} onClose={() => setSettingsOpen(false)} />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

function QuoteTile({ quote }: { quote: MarketQuote }) {
  const up = quote.changePercent > 0;
  const down = quote.changePercent < 0;

  /*
    🔴 بازار ارز و طلای ایران شب‌ها و تعطیلات بسته است.

    اندازه‌گیری واقعی: در ساعت ۱۰ صبح ۱۳ مرداد، دلار و سکه هنوز
    ts دیروز داشتند (dp=0)، در حالی که بیت‌کوین و انس همان دقیقه
    به‌روز بودند.

    اگر این تفاوت را نشان ندهیم، کاربر عدد پایانی دیروز را «لحظه‌ای»
    فرض می‌کند — برای کسی که می‌خواهد بر مبنایش قیمت‌گذاری کند
    گمراه‌کننده است.
  */
  const closedMarket = !quote.isToday;
  const dayLabel = quote.updatedAt ? quote.updatedAt.slice(0, 10) : null;

  return (
    <div
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-card px-2 py-1 shadow-sm"
      title={
        `${quote.label} — ${formatQuoteValue(quote.value, quote.unit, false)} ${unitLabel(quote.unit)}` +
        (closedMarket && dayLabel ? ` (آخرین نرخ ${dayLabel}، بازار بسته است)` : "")
      }
    >
      <span className="text-2xs font-bold text-muted-foreground">{quote.label}</span>
      <span className="text-2xs font-black tabular-nums text-foreground">
        {formatQuoteValue(quote.value, quote.unit, true)}
      </span>
      {quote.changePercent !== 0 ? (
        <span
          className={cn(
            "inline-flex items-center gap-0.5 text-2xs font-bold tabular-nums",
            up && "text-success-onSoft",
            down && "text-destructive-text"
          )}
        >
          {up ? <TrendingUp size={10} aria-hidden /> : <TrendingDown size={10} aria-hidden />}
          {formatChange(quote.changePercent)}
        </span>
      ) : closedMarket ? (
        /* نقطه‌ی کم‌رنگ: بدون شلوغ‌کردن نوار، تفاوت را اعلام می‌کند. */
        <span className="text-2xs text-muted-foreground/70" aria-label="بازار بسته است">
          ●
        </span>
      ) : null}
    </div>
  );
}

function WeatherTile({ weather }: { weather: WeatherNow }) {
  const Icon = WEATHER_ICONS[weather.icon] ?? Cloud;
  return (
    <div
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-card px-2 py-1 shadow-sm"
      title={`${weather.cityName} — ${weather.label}${weather.humidity !== null ? ` • رطوبت ${toFaDigits(weather.humidity)}٪` : ""}${weather.windSpeed !== null ? ` • باد ${toFaDigits(weather.windSpeed)} km/h` : ""}`}
    >
      <Icon size={13} className="text-primary" aria-hidden />
      <span className="text-2xs font-bold text-muted-foreground">{weather.cityName}</span>
      <span className="text-2xs font-black tabular-nums text-foreground">{formatTemp(weather.temperature)}</span>
      {weather.max !== null && weather.min !== null && (
        <span className="hidden text-2xs tabular-nums text-muted-foreground sm:inline">
          {formatTemp(weather.max)}/{formatTemp(weather.min)}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* پنجره‌ی تنظیمات                                                     */
/* ------------------------------------------------------------------ */

function TickerSettings({
  prefs,
  onChange,
  onClose,
}: {
  prefs: TickerPrefs;
  onChange: (next: TickerPrefs) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  /*
    Escape می‌بندد، با stopPropagation.

    این پنجره ممکن است در حالی باز شود که یک پنل کشویی هم باز است؛
    بدون stopPropagation یک Escape هر دو را می‌بست — همان الگویی که
    در DatePicker و Modal رعایت شده.
  */
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const selected = prefs.quoteIds;
  const available = TGJU_SYMBOLS.filter((s) => !selected.includes(s.id));

  function toggleQuote(id: string) {
    onChange({
      ...prefs,
      quoteIds: selected.includes(id) ? selected.filter((q) => q !== id) : [...selected, id],
    });
  }

  function move(index: number, direction: -1 | 1) {
    onChange({ ...prefs, quoteIds: moveItem(selected, index, index + direction) });
  }

  const labelOf = (id: string) => TGJU_SYMBOLS.find((s) => s.id === id)?.label ?? id;

  return (
    <div
      className="fixed inset-0 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4"
      style={{ zIndex: "var(--z-picker)" }}
    >
      <button className="fixed inset-0 bg-foreground/30 backdrop-blur-[2px]" onClick={onClose} aria-label="بستن" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="تنظیمات نوار قیمت‌ها"
        className="relative my-auto w-full max-w-lg rounded-2xl border border-border bg-card p-4 shadow-2xl sm:p-5"
        dir="rtl"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-extrabold text-foreground">تنظیمات نوار قیمت‌ها</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-destructive"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className="space-y-4">
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3">
            <span className="text-sm font-bold text-foreground">نمایش نوار</span>
            <input
              type="checkbox"
              checked={prefs.enabled}
              onChange={(e) => onChange({ ...prefs, enabled: e.target.checked })}
              className="h-4 w-4"
            />
          </label>

          <div className="rounded-xl border border-border p-3">
            <label className="flex min-h-9 items-center justify-between gap-3">
              <span className="text-sm font-bold text-foreground">آب‌وهوا</span>
              <input
                type="checkbox"
                checked={prefs.showWeather}
                onChange={(e) => onChange({ ...prefs, showWeather: e.target.checked })}
                className="h-4 w-4"
              />
            </label>
            {prefs.showWeather && (
              <div className="mt-2">
                <label className="mb-1 block text-2xs font-bold text-muted-foreground" htmlFor="ticker-city">
                  شهر
                </label>
                <div className="relative">
                  <select
                    id="ticker-city"
                    value={prefs.cityId}
                    onChange={(e) => onChange({ ...prefs, cityId: e.target.value })}
                    className="input h-10 min-h-10 w-full appearance-none pl-8 text-sm"
                  >
                    {IRAN_CITIES.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={15}
                    aria-hidden
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border p-3">
            <div className="mb-2 text-2xs font-bold text-muted-foreground">
              قیمت‌های انتخاب‌شده {selected.length > 0 && `(${toFaDigits(selected.length)})`}
            </div>
            {selected.length === 0 ? (
              <p className="py-3 text-center text-2xs text-muted-foreground">
                هیچ قیمتی انتخاب نشده. از فهرست پایین اضافه کنید.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {selected.map((id, index) => (
                  <li
                    key={id}
                    className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-muted/40 px-2"
                  >
                    <GripVertical size={13} className="shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">{labelOf(id)}</span>
                    {/*
                      جابه‌جایی با دکمه، نه drag-and-drop.
                      کشیدن با ماوس روی موبایل و با صفحه‌کلید عملاً
                      کار نمی‌کند؛ دو دکمه هم دسترس‌پذیر است هم ساده.
                    */}
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={`انتقال ${labelOf(id)} به راست`}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-card hover:text-primary disabled:opacity-30"
                    >
                      →
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === selected.length - 1}
                      aria-label={`انتقال ${labelOf(id)} به چپ`}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-card hover:text-primary disabled:opacity-30"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleQuote(id)}
                      aria-label={`حذف ${labelOf(id)}`}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X size={13} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {available.length > 0 && (
              <>
                <div className="mb-2 mt-3 text-2xs font-bold text-muted-foreground">افزودن</div>
                <div className="flex flex-wrap gap-1.5">
                  {available.map((sym) => (
                    <button
                      key={sym.id}
                      type="button"
                      onClick={() => toggleQuote(sym.id)}
                      className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-muted px-2 text-2xs font-bold text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                    >
                      <Plus size={11} aria-hidden />
                      {sym.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <p className="text-2xs leading-relaxed text-muted-foreground">
            قیمت‌ها از tgju.org و آب‌وهوا از open-meteo دریافت می‌شود. این اعداد جنبه‌ی اطلاع‌رسانی
            دارند و مبنای محاسبات حسابداری شما نیستند.
          </p>
        </div>
      </div>
    </div>
  );
}
