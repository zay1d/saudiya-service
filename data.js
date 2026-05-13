// ===== Contact (used by CTAs across the app) =====
// Direct Telegram link used by category-level CTAs (Vizalar, Mexmonxonalar,
// Transferlar, Aloqa). The Umra package detail screen uses the API form below
// instead so the admin gets a structured notification.
// TODO: replace with the manager's @username
const CONTACT_URL = "https://t.me/";
const CONTACT_LABEL = "Biz bilan bog‘laning";

// ===== Backend API =====
// Used by the lead form on Umra package detail screens. After buying a real
// domain, change the host here only.
const API_URL = "https://167-86-125-229.nip.io/api";

// ===== Categories (home list + bottom tab bar) =====
// `homeIcon` is the large symbol shown on the home menu rows.
// `icon` is the smaller icon used inside the bottom tab bar.
const CATEGORIES = [
  { id: "umra",     homeIcon: "h-kaaba",     icon: "n-pkg",      title: "Umra paketlari",       short: "Paket",    subtitle: "VIP · Comfort · Standart · Ekonom" },
  { id: "visa",     homeIcon: "h-passport",  icon: "n-visa",     title: "Vizalar",              short: "Viza",     subtitle: "Umra · Turistik · Biznes" },
  { id: "hotels",   homeIcon: "h-hotel",     icon: "n-hotel",    title: "Mexmonxonalar",        short: "Otel",     subtitle: "Makka va Madina · Haram yaqinida" },
  { id: "transfer", homeIcon: "h-transport", icon: "n-transfer", title: "Transferlar",          short: "Transfer", subtitle: "Aeroport · Makka · Madina" },
  { id: "contact",  homeIcon: "h-chat",      icon: "n-chat",     title: "Biz bilan bog‘laning", short: "Aloqa",    subtitle: "Maslahatchi bilan suhbat · 24/7" },
];

// ===== Umra packages =====
// Content matches the client's original brief 1:1 (no invented hotel
// names, no invented prices). Pricing & dates are intentionally left
// open — "Biz bilan bog'laning" is the single CTA everywhere.
const UMRA_PACKAGES = [
  {
    id: "vip",
    tier: "Birinchi sinf",
    title: "VIP",
    days: "Xohlagan kun",
    cardSub: "5★ · Haramga piyoda · 5–6 kishilik guruh",
    headline: "VIP\nUmra",
    lede: "Maksimal qulaylik, minimal tashvish — barchasi siz uchun.",
    highlight: true,
    features: [
      { icon: "i-hotel",    title: "Mexmonxona",  desc: "Makka va Madinadagi Haramga piyoda chiqishingiz mumkin bo‘lgan 5 yulduzli mehmonxonalar", value: "5★" },
      { icon: "i-plane",    title: "Aviabilet",   desc: "Business klass yoki siz istagan holatda",                                                  value: "Business" },
      { icon: "i-car",      title: "Transport",   desc: "Train / GMC / Kia Carnival",                                                                value: "Premium" },
      { icon: "i-star",     title: "Xizmat",      desc: "To‘liq VIP xizmat va doimiy kuzatuv",                                                       value: "VIP" },
      { icon: "i-calendar", title: "Sana",        desc: "Siz xohlagan kun tartibida",                                                                value: "Ixtiyoriy" },
      { icon: "i-utensils", title: "Ovqatlanish", desc: "BB / HB ko‘rinishida",                                                                       value: "BB/HB" },
      { icon: "i-people",   title: "Guruh",       desc: "Kichik yopiq guruh bilan tashkil etiladi",                                                  value: "5–6 kishi" },
    ],
  },
  {
    id: "comfort",
    tier: "Comfort",
    title: "Comfort",
    days: "11 / 14 kun",
    cardSub: "Haramdan ~500 m · 20–30 kishilik guruh",
    headline: "Comfort\nUmra",
    lede: "Qulaylik va sifat uyg‘unligi — eng maqbul tanlov.",
    features: [
      { icon: "i-hotel",    title: "Mexmonxona",  desc: "Masjid ul-Haramdan ~500 m masofadagi qulay mehmonxonalar", value: "~500 m" },
      { icon: "i-plane",    title: "Aviabilet",   desc: "Standart tarif",                                            value: "Standart" },
      { icon: "i-bus",      title: "Transport",   desc: "Avtobus / Train / Kia Carnival",                            value: "Mixed" },
      { icon: "i-star",     title: "Xizmat",      desc: "Tartibli tashkilot va doimiy kuzatuv",                      value: "Standart" },
      { icon: "i-calendar", title: "Dastur",      desc: "11 yoki 14 kunlik paketlar",                                value: "11/14 kun" },
      { icon: "i-utensils", title: "Ovqatlanish", desc: "BB / HB ko‘rinishida",                                       value: "BB/HB" },
      { icon: "i-people",   title: "Guruh",       desc: "O‘rta hajmdagi guruh bilan amalga oshiriladi",              value: "20–30 kishi" },
    ],
  },
  {
    id: "standard",
    tier: "Standart",
    title: "Standart",
    days: "14 kun",
    cardSub: "Haramdan ~1–2 km · 3 + 11 kun",
    headline: "Standart\nUmra",
    lede: "Eng muvozanatli variant — narx va sifat uyg‘unligi.",
    features: [
      { icon: "i-hotel",    title: "Mexmonxona",  desc: "Makka va Madinadagi Haramdan ~1–2 km masofada", value: "~1–2 km" },
      { icon: "i-calendar", title: "Dastur",      desc: "3 kun Makka · 11 kun Madina",                  value: "14 kun" },
      { icon: "i-plane",    title: "Aviabilet",   desc: "Standart tarif",                               value: "Standart" },
      { icon: "i-utensils", title: "Ovqatlanish", desc: "Madinada 3 mahal · Makkada 2 mahal",            value: "BB/HB" },
      { icon: "i-bus",      title: "Transport",   desc: "Avtobus xizmati",                              value: "Avtobus" },
      { icon: "i-guide",    title: "Rahbar",      desc: "Guruh bilan ellikboshi (rahbar) xizmati",      value: "Ellikboshi" },
    ],
  },
  {
    id: "ekonom",
    tier: "Ekonom",
    title: "Ekonom",
    days: "14 kun",
    cardSub: "Haramdan 3–7 km · 12 + 2 kun · 40–50 kishi",
    headline: "Ekonom\nUmra",
    lede: "Eng maqbul narx — baraka va imkoniyat bir joyda.",
    features: [
      { icon: "i-hotel",    title: "Mexmonxona",  desc: "Haramdan 3–7 km uzoqlikdagi qulay mehmonxonalar", value: "3–7 km" },
      { icon: "i-bed",      title: "Joylashuv",   desc: "4–5 kishilik xonalar",                            value: "4–5 kishi" },
      { icon: "i-calendar", title: "Dastur",      desc: "12 kun Makka · 2 kun Madina",                    value: "14 kun" },
      { icon: "i-utensils", title: "Ovqatlanish", desc: "Makkada 3 mahal · Madinada 2 mahal",              value: "BB/HB" },
      { icon: "i-plane",    title: "Aviabilet",   desc: "Oddiy tarif",                                    value: "Econom" },
      { icon: "i-bus",      title: "Transport",   desc: "Avtobus xizmati",                                value: "Avtobus" },
      { icon: "i-guide",    title: "Rahbar",      desc: "Ellikboshi (rahbar) xizmati",                    value: "Ellikboshi" },
      { icon: "i-people",   title: "Guruh",       desc: "Katta guruh bilan tashkil etiladi",              value: "40–50 kishi" },
    ],
  },
];

// ===== Visas =====
// Loaded at runtime from `${API_URL}/content`. The hardcoded list below is
// used only as a fallback if the API is unreachable (e.g. offline preview).
const VISAS_FALLBACK = [
  { id: "umra",           icon: "i-mosque",    emoji: "🕋", title: "Umra vizasi",            tagline: "Faqat ibodat uchun eng qulay variant", short: "1 marta · 90 kun",            price: 185, currency: "USD", features: ["1 marta kirasiz", "90 kungacha bemalol yurasiz"], warnings: [], highlight: "Umra qilish uchun ideal" },
  { id: "tourist_multi",  icon: "i-globe",     emoji: "🌍", title: "Turist vizasi (Multi)",  tagline: "Eng erkin va qulay viza",              short: "1 yil · multi · 90 kun jami", price: 320, currency: "USD", features: ["1 yil davomida ishlaydi", "Xohlagancha kirib-chiqasiz"], warnings: ["Jami 90 kun ichida bo‘lish mumkin"], highlight: "Ko‘p qatnab turadiganlar uchun TOP variant" },
  { id: "tourist_single", icon: "i-stamp",     emoji: "✈️", title: "Turist vizasi (Single)", tagline: "Eng oddiy va arzon variant",           short: "1 marta · 90 kun",            price: 140, currency: "USD", features: ["1 marta kirasiz", "90 kungacha qolasiz"], warnings: ["Chiqib ketsangiz — viza yopiladi", "Qayta kirish uchun yangi viza olish kerak"], highlight: "Bir martalik safar uchun mos" },
  { id: "business",       icon: "i-briefcase", emoji: "💼", title: "Biznes vizasi",          tagline: "Ish, uchrashuv va hamkorlik uchun",    short: "1 yil · multi · 90 kun/kirish", price: 280, currency: "USD", features: ["1 yil amal qiladi", "Xohlagancha kirib-chiqish mumkin", "Har bir kirishda 90 kungacha qolish mumkin"], warnings: [], highlight: "Ish bilan qatnaydiganlar uchun eng to‘g‘ri tanlov" },
];

// Live data, populated by app.js after the /api/content fetch.
let VISAS = VISAS_FALLBACK.slice();
