// ===== Contact (used by CTAs across the app) =====
// Direct Telegram link used by category-level CTAs (Vizalar, Mexmonxonalar,
// Transferlar, Aloqa). The Umra package detail screen uses the API form below
// instead so the admin gets a structured notification.
const CONTACT_URL = "https://t.me/saudia_servicer";
const CONTACT_LABEL = "Biz bilan bog‘laning";

// Full contact card shown on the Aloqa screen. Phone uses tel:, the rest
// open in a new tab. Order matters — first two render as "primary" cards.
const CONTACTS = [
  { kind: "phone",     label: "Telefon",            value: "+966 50 390 1777", href: "tel:+966503901777",                  icon: "i-phone",     primary: true  },
  { kind: "telegram",  label: "Telegram",           value: "@saudia_servicer", href: "https://t.me/saudia_servicer",       icon: "i-telegram",  primary: true  },
  { kind: "b2b",       label: "B2B kanal",          value: "t.me/saudiaservicer", href: "https://t.me/saudiaservicer",     icon: "i-broadcast", primary: false },
  { kind: "news",      label: "Yangiliklar kanali", value: "Makka xabarlari",  href: "https://t.me/makka_xabarlari",       icon: "i-broadcast", primary: false },
  { kind: "instagram", label: "Instagram",          value: "@saudia_servicer", href: "https://www.instagram.com/saudia_servicer", icon: "i-instagram", primary: false },
];

// ===== Backend API =====
// When served from the production domain, hit the API on the same origin
// (cleaner, no CORS preflights). When previewed from Pages / local file
// fall back to the absolute production URL.
const API_URL = (() => {
  const h = (typeof window !== "undefined" && window.location && window.location.hostname) || "";
  if (h === "saudihizmat.fyi" || h === "www.saudihizmat.fyi") return "/api";
  return "https://saudihizmat.fyi/api";
})();

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
      { icon: "i-calendar", title: "Dastur",      desc: "3 kun Madina · 11 kun Makka",                  value: "14 kun" },
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
// Icons are owned by the frontend (see VISA_ICONS) so an admin price tweak
// can't accidentally change a card's design.
const VISA_ICONS = {
  umra:           "i-kaaba",
  tourist_multi:  "i-luggage",
  tourist_single: "i-bag",
  business:       "i-briefcase",
};

const VISAS_FALLBACK = [
  { id: "umra",           emoji: "🕋", title: "Umra vizasi",            tagline: "Faqat ibodat uchun eng qulay variant", short: "1 marta · 90 kun",            price: 185, currency: "USD", features: ["1 marta kirasiz", "90 kungacha bemalol yurasiz"], warnings: [], highlight: "Umra qilish uchun ideal" },
  { id: "tourist_multi",  emoji: "🌍", title: "Turist vizasi (Multi)",  tagline: "Eng erkin va qulay viza",              short: "1 yil · multi · 90 kun jami", price: 320, currency: "USD", features: ["1 yil davomida ishlaydi", "Xohlagancha kirib-chiqasiz"], warnings: ["Jami 90 kun ichida bo‘lish mumkin"], highlight: "Ko‘p qatnab turadiganlar uchun TOP variant" },
  { id: "tourist_single", emoji: "✈️", title: "Turist vizasi (Single)", tagline: "Eng oddiy va arzon variant",           short: "1 marta · 90 kun",            price: 140, currency: "USD", features: ["1 marta kirasiz", "90 kungacha qolasiz"], warnings: ["Chiqib ketsangiz — viza yopiladi", "Qayta kirish uchun yangi viza olish kerak"], highlight: "Bir martalik safar uchun mos" },
  { id: "business",       emoji: "💼", title: "Biznes vizasi",          tagline: "Ish, uchrashuv va hamkorlik uchun",    short: "1 yil · multi · 90 kun/kirish", price: 280, currency: "USD", features: ["1 yil amal qiladi", "Xohlagancha kirib-chiqish mumkin", "Har bir kirishda 90 kungacha qolish mumkin"], warnings: [], highlight: "Ish bilan qatnaydiganlar uchun eng to‘g‘ri tanlov" },
];

// Live data, populated by app.js after the /api/content fetch.
let VISAS = VISAS_FALLBACK.slice();

// ===== Transfers =====
// Icons are frontend-owned just like visas.
const TRANSFER_ICONS = {
  bus:   "i-bus",
  gmc:   "i-car",
  train: "i-train",
};

const TRANSFERS_FALLBACK = [
  {
    id: "bus",
    title: "Avtobus",
    tagline: "47 / 49 / 50 o‘rinli · Ekonom va Standart tariflar",
    short: "2025 / 2026 / 2027 yil avtobuslar",
    features: [
      "Aeroportdan kutib olish / kuzatish",
      "Makka ↔ Madina transfer",
      "Ziyoratlar (2 marta)",
    ],
    extras: [
      "Toif safari",
      "Masjid Rajihiy",
      "Miqot ziyoratlari",
      "Maxsus ziyoratlar (buyurtma asosida)",
    ],
  },
  {
    id: "gmc",
    title: "GMC / Kia Carnival",
    tagline: "VIP / Comfort · oilaviy va kichik guruhlar (4–7 kishi)",
    short: "Premium transfer xizmati",
    features: [
      "Aeroport VIP kutib olish / kuzatish",
      "Makka ↔ Madina komfort transfer",
      "Shaxsiy ziyorat (individual marshrut)",
      "Tajribali haydovchi",
    ],
    extras: [
      "Tez va xavfsiz harakat",
      "Toza va yangi avtomobillar",
      "To‘liq qulaylik va maxfiylik",
    ],
  },
  {
    id: "train",
    title: "Haramain tezkor poyezd",
    tagline: "Eng tez va qulay transfer · Makka ↔ Madina (~2.5 soat)",
    short: "Zamonaviy va komfort vagonlar",
    features: [
      "Bilet bron qilish",
      "Vokzalga yetkazib qo‘yish",
      "Bagaj bilan yordam",
      "Vokzaldan mehmonxonaga transfer (qo‘shimcha)",
    ],
    extras: [
      "Tirbandliksiz va tez",
      "Aniq vaqt bo‘yicha harakat",
    ],
  },
];

let TRANSFERS = TRANSFERS_FALLBACK.slice();

// Cities offered in the route picker.
const ROUTE_CITIES = [
  { id: "makka",  title: "Makka" },
  { id: "madina", title: "Madina" },
  { id: "jidda",  title: "Jidda" },
];

// ===== Hotels =====
// HOTEL_SEGMENTS is keyed by city — Makka is tiered (VIP/Comfort/Standart/Ekonom);
// Madina is shown as a single unlabeled list plus the Ekonom contact prompt.
// A segment may instead be { contact: true, note } — it renders a
// "biz bilan bog'laning" block instead of a list (used for Ekonom in both cities).
// A segment with no `label` skips its section heading on the screen.
// Empty list segments render a "Tez orada joylanadi" stub.
const _EKONOM_SEG = {
  id: "ekonom", label: "Ekonom", contact: true,
  note: "Makka va Madinadagi ekonom mexmonxonalar uchun biz bilan bog‘laning",
};
const HOTEL_SEGMENTS = {
  makka: [
    { id: "vip",      label: "VIP" },
    { id: "comfort",  label: "Comfort" },
    { id: "standart", label: "Standart" },
    _EKONOM_SEG,
  ],
  madina: [
    { id: "list" },   // single flat list, no section heading
    _EKONOM_SEG,
  ],
};

const HOTELS_FALLBACK = {
  makka: {
    vip: [
      "Dar tavhid intercontinental",
      "Makkah towers",
      "Fermont / Fermont Gold",
      "Swiss al makka",
      "Swiss al Maqom",
      "Raffless",
      "Mowenpick Hojar",
      "Pulman Zam zam",
      "Reyhan al Marwa",
      "Hyatt Regency Jabal omer",
      "Jumaira Jabal omer",
      "Conrad Jabal omer",
      "Hilton Suits Jabal omer",
      "Rotana Jabal omer",
    ],
    comfort: [
      "Adress Jabal omer",
      "Marriot Jabal omer",
      "Double Tree Jabal omer",
      "Hilton convention",
      "Anjum hotel",
      "Tilal Jabal Kaba hotel",
      "Sheraton Makka hotel",
      "Prestage hotel",
      "Shohada hotel",
      "Courtyard by Marriot",
      "Makarem Um Quro",
    ],
    standart: [
      "Infinity hotel Ajyad",
      "Nawazi hotel Ajyad",
      "Emar Elit Ajyad",
      "Reyhan al mashaer ajyad",
      "Snood Ajyad",
      "Batoul Ajyad",
      "Lamar hotels",
      "Kiswa tower",
      "Al Farabi Hotel",
      "Ramada Tayser",
      "Ramada al Qosr",
    ],
    ekonom: [],
  },
  madina: {
    list: [
      "Intercontinental Dar al Hijra",
      "International Dar Al Iyman",
      "Anwar Al Madinah Mowenpick",
      "Hotel Oberai",
      "Pulman Zam zam Madina",
      "Panusuala Worth",
      "Dar Taqva Madina",
      "Makareem Suit Hotel",
      "Madina Hilton",
      "Rotana al Manakha",
      "Sofitel Hotel",
      "Novotel Madina",
      "Hotel Emar",
      "Concorde Hotel",
      "Al Aqeem Madina",
      "Maden Hotels 4x",
    ],
    ekonom: [],
  },
};

let HOTELS = HOTELS_FALLBACK;
