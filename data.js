// ===== Contact (used by package detail and category CTAs) =====
// TODO: replace with actual personal Telegram (e.g. "https://t.me/yourusername")
const CONTACT_URL = "https://t.me/";
const CONTACT_LABEL = "Biz bilan bog‘laning";

// ===== Tab-bar icons =====
const ICONS = {
  umra:     '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V11l9-6 9 6v10"/><path d="M9 21v-7h6v7"/><path d="M12 3v3"/></svg>',
  visa:     '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  hotels:   '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7"/><path d="M3 18h18"/><path d="M7 12h4v3H7z"/></svg>',
  transfer: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17h2l1.5-5h11L19 17h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>',
  contact:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
};

// ===== Categories (home cards + tab-bar) =====
const CATEGORIES = [
  { id: "umra",     title: "Umra paketlari",       short: "Paketlar",  numeral: "I",   subtitle: "VIP · Comfort · Standard · Ekonom" },
  { id: "visa",     title: "Vizalar",              short: "Vizalar",   numeral: "II",  subtitle: "Umra · Sayohat · Biznes vizalari" },
  { id: "hotels",   title: "Mexmonxonalar",        short: "Mexmonxona",numeral: "III", subtitle: "Makkah va Madinah · 3–5★" },
  { id: "transfer", title: "Transferlar",          short: "Transfer",  numeral: "IV",  subtitle: "Aeroport · Shahar · VIP transport" },
  { id: "contact",  title: "Biz bilan bog‘laning", short: "Aloqa",     numeral: "V",   subtitle: "Maslahat · Buyurtma · Yordam" },
];

// ===== Umra packages =====
const UMRA_PACKAGES = [
  {
    id: "vip",
    tier: "VIP",
    title: "VIP Paket",
    days: "Xohlagan kun",
    subtitle: "Maksimal qulaylik · minimal tashvish",
    highlight: true,
    lines: [
      "🕋 Makkah va Madinadagi Haramga piyoda chiqishingiz mumkin bo‘lgan 5 yulduzli mehmonxonalar",
      "✈️ Aviabiletlar: Business klass yoki siz istagan holatda",
      "🚄 Qulay transport: Train / GMC / Kia Carnival",
      "🤝 To‘liq VIP xizmat va doimiy kuzatuv",
      "📅 Siz xohlagan kun tartibida",
      "🥘 BB / HB ko‘rinishida",
      "👨‍👩‍👧‍👦 5–6 kishilik kichik guruhlar bilan tashkil etiladi",
    ],
    note: "Maksimal qulaylik, minimal tashvish — barchasi siz uchun",
  },
  {
    id: "comfort",
    tier: "Comfort",
    title: "Comfort Paket",
    days: "11 / 14 kun",
    subtitle: "Qulaylik va sifat uyg‘unligi",
    lines: [
      "🕋 Masjid ul-Haramdan uzoq bo‘lmagan (~500 m) qulay mehmonxonalar",
      "✈️ Aviabiletlar: standart tarif",
      "🚐 Transport: Avtobus / Train / Kia Carnival",
      "🤝 Tartibli tashkilot va doimiy kuzatuv",
      "📅 11 / 14 kunlik paketlar",
      "🥘 BB / HB ko‘rinishida",
      "👥 20–30 kishilik guruhlar bilan amalga oshiriladi",
    ],
    note: "Qulaylik va sifat uyg‘unligi — eng maqbul tanlov",
  },
  {
    id: "standard",
    tier: "Standard",
    title: "Standard Paket",
    days: "14 kun",
    subtitle: "Narx va sifat uyg‘unligi",
    lines: [
      "🕋 Makkah va Madinadagi Haramdan ~1–2 km masofadagi mehmonxonalar",
      "🗓 14 kunlik dastur: 3 kun Makkah / 11 kun Madina",
      "✈️ Aviabiletlar: standart tarif",
      "🍽 Madinada 3 mahal · Makkada 2 mahal ovqatlanish",
      "🚐 Transport: avtobus xizmati",
      "👳‍♂️ Guruh bilan ellikboshi (rahbar) xizmati",
      "👥 Guruh bilan tartibli va qulay ziyorat",
    ],
    note: "Eng muvozanatli variant — narx va sifat uyg‘unligi",
  },
  {
    id: "ekonom",
    tier: "Ekonom",
    title: "Ekonom Paket",
    days: "14 kun",
    subtitle: "Eng maqbul narx",
    lines: [
      "🕋 Haramdan 3–7 km uzoqlikdagi qulay mehmonxonalar",
      "🛏 4–5 kishilik joylashuv",
      "🗓 14 kunlik dastur: 12 kun Makkah / 2 kun Madina",
      "🍽 Makkada 3 mahal · Madinada 2 mahal ovqatlanish",
      "✈️ Aviabiletlar: oddiy tarif",
      "🚐 Transport: avtobus xizmati",
      "👳‍♂️ Ellikboshi (rahbar) xizmati",
      "👥 40–50 kishilik guruhlar bilan tashkil etiladi",
    ],
    note: "Eng maqbul narx — baraka va imkoniyat bir joyda",
  },
];

// ===== Visas (placeholder content from design) =====
const VISAS = [
  { badge: "U.", title: "Umra vizasi",    desc: "7–14 ish kuni · Bir martalik kirish" },
  { badge: "T.", title: "Sayohat vizasi", desc: "e-Visa · 30 kunlik turizm" },
  { badge: "B.", title: "Biznes vizasi",  desc: "Korporativ taklif bilan" },
];
