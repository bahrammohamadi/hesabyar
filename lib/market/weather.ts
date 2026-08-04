/**
 * آب‌وهوا — open-meteo.
 *
 * چرا این منبع؟ آزمایش شد: بدون کلید، بدون ثبت‌نام، HTTP 200 و
 * پاسخ کامل (دما، رطوبت، باد، بیشینه/کمینه روز). سرویس‌های دیگر
 * (OpenWeather و مشابه) همگی کلید و سقف رایگان محدود دارند.
 */

export interface IranCity {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

/**
 * شهرهای ایران.
 *
 * مختصات داخل کد است نه از سرویس geocoding: انتخاب شهر نباید به یک
 * درخواست شبکه‌ی اضافه وابسته باشد، و این فهرست سال‌ها ثابت می‌ماند.
 * مرتب بر اساس جمعیت تا پرکاربردترها بالا باشند.
 */
export const IRAN_CITIES: IranCity[] = [
  { id: "tehran", name: "تهران", lat: 35.6892, lon: 51.389 },
  { id: "mashhad", name: "مشهد", lat: 36.2605, lon: 59.6168 },
  { id: "isfahan", name: "اصفهان", lat: 32.6539, lon: 51.666 },
  { id: "karaj", name: "کرج", lat: 35.8355, lon: 50.9915 },
  { id: "shiraz", name: "شیراز", lat: 29.5918, lon: 52.5837 },
  { id: "tabriz", name: "تبریز", lat: 38.0962, lon: 46.2738 },
  { id: "qom", name: "قم", lat: 34.6416, lon: 50.8746 },
  { id: "ahvaz", name: "اهواز", lat: 31.3183, lon: 48.6706 },
  { id: "kermanshah", name: "کرمانشاه", lat: 34.3277, lon: 47.0778 },
  { id: "urmia", name: "ارومیه", lat: 37.5527, lon: 45.0761 },
  { id: "rasht", name: "رشت", lat: 37.2808, lon: 49.5832 },
  { id: "zahedan", name: "زاهدان", lat: 29.4963, lon: 60.8629 },
  { id: "hamedan", name: "همدان", lat: 34.7992, lon: 48.5146 },
  { id: "kerman", name: "کرمان", lat: 30.2839, lon: 57.0834 },
  { id: "yazd", name: "یزد", lat: 31.8974, lon: 54.3569 },
  { id: "ardabil", name: "اردبیل", lat: 38.2498, lon: 48.2933 },
  { id: "bandar-abbas", name: "بندرعباس", lat: 27.1865, lon: 56.2808 },
  { id: "arak", name: "اراک", lat: 34.0917, lon: 49.6892 },
  { id: "eslamshahr", name: "اسلامشهر", lat: 35.5522, lon: 51.235 },
  { id: "zanjan", name: "زنجان", lat: 36.6736, lon: 48.4787 },
  { id: "sanandaj", name: "سنندج", lat: 35.3219, lon: 46.9862 },
  { id: "qazvin", name: "قزوین", lat: 36.2688, lon: 50.0041 },
  { id: "khorramabad", name: "خرم‌آباد", lat: 33.4878, lon: 48.3558 },
  { id: "gorgan", name: "گرگان", lat: 36.8427, lon: 54.4436 },
  { id: "sari", name: "ساری", lat: 36.5633, lon: 53.06 },
  { id: "shahrekord", name: "شهرکرد", lat: 32.3256, lon: 50.8644 },
  { id: "birjand", name: "بیرجند", lat: 32.8663, lon: 59.2211 },
  { id: "bushehr", name: "بوشهر", lat: 28.9234, lon: 50.82 },
  { id: "bojnord", name: "بجنورد", lat: 37.4747, lon: 57.329 },
  { id: "ilam", name: "ایلام", lat: 33.6374, lon: 46.4227 },
  { id: "semnan", name: "سمنان", lat: 35.5729, lon: 53.3971 },
  { id: "yasuj", name: "یاسوج", lat: 30.6682, lon: 51.5877 },
  { id: "kish", name: "کیش", lat: 26.5578, lon: 53.9807 },
  { id: "chabahar", name: "چابهار", lat: 25.2919, lon: 60.643 },
  { id: "tabas", name: "طبس", lat: 33.5959, lon: 56.9244 },
  { id: "maragheh", name: "مراغه", lat: 37.3833, lon: 46.2333 },
];

export const DEFAULT_CITY_ID = "tehran";

export function findCity(id: string | null | undefined): IranCity {
  return IRAN_CITIES.find((c) => c.id === id) ?? IRAN_CITIES[0];
}

export interface WeatherNow {
  cityId: string;
  cityName: string;
  temperature: number;
  humidity: number | null;
  windSpeed: number | null;
  max: number | null;
  min: number | null;
  code: number;
  label: string;
  /** نام آیکون lucide که UI رندر می‌کند. */
  icon: WeatherIcon;
  isNight: boolean;
}

export type WeatherIcon =
  | "sun"
  | "moon"
  | "cloud-sun"
  | "cloud-moon"
  | "cloud"
  | "cloud-fog"
  | "cloud-drizzle"
  | "cloud-rain"
  | "cloud-snow"
  | "cloud-lightning";

/**
 * کد WMO → متن فارسی و آیکون.
 *
 * open-meteo کد عددی استاندارد WMO می‌دهد. جدول کامل ۲۸ حالت دارد؛
 * همه پوشش داده شده تا هیچ‌وقت «نامشخص» نبینیم.
 * https://open-meteo.com/en/docs
 */
const WMO: Record<number, { label: string; icon: WeatherIcon; nightIcon?: WeatherIcon }> = {
  0: { label: "صاف", icon: "sun", nightIcon: "moon" },
  1: { label: "کمی ابری", icon: "cloud-sun", nightIcon: "cloud-moon" },
  2: { label: "نیمه‌ابری", icon: "cloud-sun", nightIcon: "cloud-moon" },
  3: { label: "ابری", icon: "cloud" },
  45: { label: "مه", icon: "cloud-fog" },
  48: { label: "مه یخ‌زده", icon: "cloud-fog" },
  51: { label: "نم‌نم باران", icon: "cloud-drizzle" },
  53: { label: "نم‌نم باران", icon: "cloud-drizzle" },
  55: { label: "نم‌نم شدید", icon: "cloud-drizzle" },
  56: { label: "نم‌نم یخ‌زده", icon: "cloud-drizzle" },
  57: { label: "نم‌نم یخ‌زده", icon: "cloud-drizzle" },
  61: { label: "باران سبک", icon: "cloud-rain" },
  63: { label: "باران", icon: "cloud-rain" },
  65: { label: "باران شدید", icon: "cloud-rain" },
  66: { label: "باران یخ‌زده", icon: "cloud-rain" },
  67: { label: "باران یخ‌زده شدید", icon: "cloud-rain" },
  71: { label: "برف سبک", icon: "cloud-snow" },
  73: { label: "برف", icon: "cloud-snow" },
  75: { label: "برف سنگین", icon: "cloud-snow" },
  77: { label: "دانه‌ی برف", icon: "cloud-snow" },
  80: { label: "رگبار سبک", icon: "cloud-rain" },
  81: { label: "رگبار", icon: "cloud-rain" },
  82: { label: "رگبار شدید", icon: "cloud-rain" },
  85: { label: "بارش برف", icon: "cloud-snow" },
  86: { label: "بارش برف سنگین", icon: "cloud-snow" },
  95: { label: "رعد و برق", icon: "cloud-lightning" },
  96: { label: "رعد و برق با تگرگ", icon: "cloud-lightning" },
  99: { label: "رعد و برق شدید", icon: "cloud-lightning" },
};

export function describeWeather(code: number, isNight: boolean) {
  const entry = WMO[code] ?? { label: "نامشخص", icon: "cloud" as WeatherIcon };
  const icon = isNight && entry.nightIcon ? entry.nightIcon : entry.icon;
  return { label: entry.label, icon };
}

/**
 * آیا در ساعت شب هستیم؟
 *
 * open-meteo `is_day` هم می‌دهد ولی فقط در حالت current؛ ساده‌تر و
 * بدون درخواست اضافه، از ساعت محلی خود پاسخ استفاده می‌شود.
 */
export function isNightAt(localTime: string): boolean {
  const hour = Number(localTime.slice(11, 13));
  if (!Number.isFinite(hour)) return false;
  return hour < 6 || hour >= 19;
}
