// ===== Contact (used by CTAs across the app) =====
// TODO: replace with actual personal Telegram (e.g. "https://t.me/yourusername")
const CONTACT_URL = "https://t.me/";
const CONTACT_LABEL = "Biz bilan bog‘laning";

// ===== Categories (home list + bottom tab bar) =====
const CATEGORIES = [
  { id: "umra",     numeral: "I.",   title: "Umra paketlari",       short: "Paket",     icon: "n-pkg",      subtitle: "VIP · Comfort · Standart · Ekonom" },
  { id: "visa",     numeral: "II.",  title: "Vizalar",              short: "Viza",      icon: "n-visa",     subtitle: "Umra · Turistik · Biznes" },
  { id: "hotels",   numeral: "III.", title: "Mexmonxonalar",        short: "Otel",      icon: "n-hotel",    subtitle: "Makka va Madina · Haram yaqinida" },
  { id: "transfer", numeral: "IV.",  title: "Transferlar",          short: "Transfer",  icon: "n-transfer", subtitle: "Aeroport · Makka · Madina" },
  { id: "contact",  numeral: "V.",   title: "Biz bilan bog‘laning", short: "Aloqa",     icon: "n-chat",     subtitle: "Maslahatchi bilan suhbat · 24/7" },
];

// ===== Umra packages =====
// Prices/days are placeholders from the design — replace once finalised.
// The detailed `features` array drives the package detail screen
// (line-icon + serif title + sans-serif description + small value).
const UMRA_PACKAGES = [
  {
    id: "vip",
    tier: "Birinchi sinf",
    title: "VIP",
    days: "14 kun",
    price: "$3 850",
    priceUnit: "per kishi",
    cardSub: "Movenpick · 5★ · Haramga 80 metr · individual transfer",
    headline: "VIP\nUmra",
    lede: "Movenpick Towers, qabul, individual rahbarlik va 14 kunlik to‘liq xizmat.",
    highlight: true,
    features: [
      { icon: "i-plane",  title: "Aviabilet",    desc: "Toshkent — Jidda — Toshkent · biznes klass", value: "Biznes" },
      { icon: "i-hotel",  title: "Mexmonxona",   desc: "Movenpick Towers 5★ · Haramga 80 metr",      value: "5★" },
      { icon: "i-bus",    title: "Transfer",     desc: "Mercedes V-Class · individual yo‘nalish",   value: "VIP" },
      { icon: "i-guide",  title: "Murabbiy",     desc: "Shaxsiy diniy maslahatchi · o‘zbek tilida", value: "1 : 6" },
      { icon: "i-meal",   title: "Ovqatlanish",  desc: "Uch mahal · halol · milliy va xalqaro taomlar", value: "3/kun" },
      { icon: "i-mosque", title: "Ziyoratlar",   desc: "Madina, Uhud, Quba — to‘liq dastur",         value: "12" },
      { icon: "i-shield", title: "Sug‘urta",     desc: "Tibbiy sug‘urta · 24/7 yordam",              value: "To‘liq" },
    ],
  },
  {
    id: "comfort",
    tier: "Comfort",
    title: "Comfort",
    days: "12 kun",
    price: "$2 450",
    priceUnit: "per kishi",
    cardSub: "Pullman · 4★ · Haramga 200 metr · kichik guruh",
    headline: "Comfort\nUmra",
    lede: "Pullman ZamZam, kichik guruh, qulay tartibga solingan 12 kunlik safar.",
    features: [
      { icon: "i-plane",  title: "Aviabilet",   desc: "Toshkent — Jidda — Toshkent · standart tarif", value: "Econom" },
      { icon: "i-hotel",  title: "Mexmonxona",  desc: "Pullman ZamZam 4★ · Haramga 200 metr",        value: "4★" },
      { icon: "i-bus",    title: "Transfer",    desc: "Kichik guruh · Kia Carnival / mini-avtobus",  value: "Group" },
      { icon: "i-guide",  title: "Murabbiy",    desc: "Guruh rahbarlari · o‘zbek tilida",             value: "1 : 20" },
      { icon: "i-meal",   title: "Ovqatlanish", desc: "BB / HB · halol",                              value: "2–3/kun" },
      { icon: "i-mosque", title: "Ziyoratlar",  desc: "Madina · klassik dastur",                     value: "8" },
    ],
  },
  {
    id: "standard",
    tier: "Standart",
    title: "Standart",
    days: "10 kun",
    price: "$1 690",
    priceUnit: "per kishi",
    cardSub: "Anjum · 4★ · Haramga 400 metr · umumiy transfer",
    headline: "Standart\nUmra",
    lede: "Anjum mehmonxonasi, guruh transferlari va muvozanatli 10 kunlik dastur.",
    features: [
      { icon: "i-plane",  title: "Aviabilet",   desc: "Toshkent — Jidda — Toshkent · standart tarif", value: "Econom" },
      { icon: "i-hotel",  title: "Mexmonxona",  desc: "Anjum 4★ · Haramga 400 metr",                 value: "4★" },
      { icon: "i-bus",    title: "Transfer",    desc: "Umumiy avtobus xizmati",                       value: "Bus" },
      { icon: "i-guide",  title: "Murabbiy",    desc: "Ellikboshi · o‘zbek tilida",                  value: "1 : 30" },
      { icon: "i-meal",   title: "Ovqatlanish", desc: "Madinada 3 mahal · Makkada 2 mahal",          value: "BB/HB" },
      { icon: "i-clock",  title: "Dastur",      desc: "3 kun Makka · 7 kun Madina",                  value: "10 kun" },
    ],
  },
  {
    id: "ekonom",
    tier: "Ekonom",
    title: "Ekonom",
    days: "9 kun",
    price: "$1 280",
    priceUnit: "per kishi",
    cardSub: "Al Massa · 3★ · shahar markazi · guruh transfer",
    headline: "Ekonom\nUmra",
    lede: "Halol, qulay va eng maqbul narxda — 9 kunlik guruh safari.",
    features: [
      { icon: "i-plane",  title: "Aviabilet",    desc: "Toshkent — Jidda — Toshkent · oddiy tarif",   value: "Econom" },
      { icon: "i-hotel",  title: "Mexmonxona",   desc: "Al Massa 3★ · shahar markazi · 4–5 kishilik xona", value: "3★" },
      { icon: "i-bus",    title: "Transfer",     desc: "Avtobus · katta guruh",                       value: "Bus" },
      { icon: "i-guide",  title: "Murabbiy",     desc: "Ellikboshi · guruh rahbari",                 value: "1 : 45" },
      { icon: "i-meal",   title: "Ovqatlanish",  desc: "Makkada 3 mahal · Madinada 2 mahal",          value: "BB/HB" },
      { icon: "i-clock",  title: "Dastur",       desc: "7 kun Makka · 2 kun Madina",                  value: "9 kun" },
    ],
  },
];

// ===== Visas (placeholder content from design) =====
const VISAS = [
  { icon: "i-passport", title: "Umra vizasi",   desc: "90 kun · ko‘p martali · ziyorat uchun",  price: "$185", priceUnit: "per kishi" },
  { icon: "i-stamp",    title: "Turistik viza", desc: "30 kun · bir martali · sayohat uchun",   price: "$140", priceUnit: "per kishi" },
  { icon: "i-doc",      title: "Biznes viza",   desc: "90 kun · ko‘p martali · ish safari",     price: "$260", priceUnit: "per kishi" },
];
