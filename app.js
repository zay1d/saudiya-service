(function () {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    if (tg.setHeaderColor)     tg.setHeaderColor("#2a1f15");
    if (tg.setBackgroundColor) tg.setBackgroundColor("#2a1f15");

    // Push UI below the notch + Telegram's overlaid controls when fullscreen.
    // Reads Telegram's safe-area insets; stays 0 in browser / older clients.
    const applySafeArea = () => {
      const sa = tg.safeAreaInset || {};
      const csa = tg.contentSafeAreaInset || {};
      const top = (sa.top || 0) + (csa.top || 0);
      document.documentElement.style.setProperty("--tg-top", top + "px");
    };

    // Request true fullscreen (Bot API 8.0+) so the app covers the whole
    // screen even when launched from the in-chat menu button, not just from
    // the Main Mini App entry.
    if (tg.isVersionAtLeast && tg.isVersionAtLeast("8.0") && typeof tg.requestFullscreen === "function") {
      try { tg.requestFullscreen(); } catch (e) { /* unsupported surface */ }
      if (typeof tg.onEvent === "function") {
        tg.onEvent("fullscreenChanged", applySafeArea);
        tg.onEvent("safeAreaChanged", applySafeArea);
        tg.onEvent("contentSafeAreaChanged", applySafeArea);
      }
    }
    applySafeArea();
  }

  const appEl     = document.getElementById("app");
  const contentEl = document.getElementById("content");
  const navEl     = document.getElementById("bottom-nav");

  const state = {
    screen: "home",          // "home" | "category" | "package" | "visa"
    activeCategory: null,
    activePackage: null,
    activeVisa: null,
    hotelsView: null,        // null (root) | "list" | "purchase"
    hotelsCity: null,        // null | "makka" | "madina"
  };

  // ---------- analytics tracking ----------
  // Lightweight, privacy-respecting: only event + optional string, never PII.
  // Admins are filtered out server-side via ADMIN_CHAT_IDS, so their
  // testing doesn't skew the numbers. Failures are swallowed — tracking must
  // never crash UX.
  async function track(event, data) {
    if (!tg || !tg.initData) return;
    try {
      await fetch(`${API_URL}/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, data: data || "", init_data: tg.initData }),
        keepalive: true,
      });
    } catch (_) { /* swallow */ }
  }
  const trackOpen     = ()    => track("open");
  const trackCategory = (id)  => track("category", id);
  const trackLocation = (url) => track("location", url);
  const trackContact  = (kind) => track("contact", kind);

  // ---------- content fetch ----------

  let BOT_USERNAME = "";

  async function fetchContent() {
    try {
      const r = await fetch(`${API_URL}/content`, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (Array.isArray(data.visas) && data.visas.length > 0) {
        VISAS = data.visas;
      }
      if (Array.isArray(data.transfers) && data.transfers.length > 0) {
        TRANSFERS = data.transfers;
      }
      if (data.bot && data.bot.username) {
        BOT_USERNAME = data.bot.username;
      }
    } catch (e) {
      console.warn("content fetch failed, using fallback", e);
    }
  }

  // ---------- helpers ----------

  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  function setScreen(name) {
    state.screen = name;
    appEl.dataset.screen = name;
    appEl.dataset.category = state.activeCategory || "";
    window.scrollTo(0, 0);
  }

  // Resolve the SVG icon for a visa. Frontend owns icon mapping so admin
  // price edits (via bot commands) can never accidentally change the design.
  function visaIcon(v) {
    return (VISA_ICONS && VISA_ICONS[v.id]) || v.icon || "i-passport";
  }

  // ---------- views ----------

  function viewHome() {
    return `
      <div class="brand">
        <img class="mark" src="assets/saudia-service-logo.png" alt="Saudia Service" />
        <div class="wordmark">SAUDIA&nbsp;&nbsp;SERVICE</div>
        <div class="hairline"></div>
        <div class="arabic">Umra &amp; Hajj — bismillah</div>
      </div>

      <nav class="menu" aria-label="Asosiy menyu">
        ${CATEGORIES.map((c) => `
          <button class="row" data-action="open-category" data-id="${c.id}">
            <span class="num"><svg width="26" height="26"><use href="#${c.homeIcon}"/></svg></span>
            <span class="label">
              <p class="t">${esc(c.title)}</p>
              <p class="d">${esc(c.subtitle)}</p>
            </span>
            <span class="chev"><svg width="14" height="14"><use href="#i-chev"/></svg></span>
          </button>
        `).join("")}
      </nav>

      <div class="home-foot">
        <div class="small">Toshkent · Madina · Makka</div>
      </div>
    `;
  }

  function viewTopbar(title) {
    return `
      <div class="topbar">
        <button class="iconbtn" data-action="go-back" aria-label="Orqaga">
          <svg width="20" height="20"><use href="#i-back"/></svg>
        </button>
        <span class="title">${esc(title)}</span>
        <span></span>
      </div>
    `;
  }

  function viewCategory(catId) {
    const cat = CATEGORIES.find((c) => c.id === catId);
    let body = "";
    switch (catId) {
      case "umra":     body = viewUmraList(); break;
      case "visa":
        if (state.activeVisa) {
          return viewVisaDetail(state.activeVisa);
        }
        body = viewVisaList();
        break;
      case "hotels":
        if (state.hotelsView === "purchase") {
          body = viewHotelsPurchase();
        } else if (state.hotelsView === "list" && state.hotelsCity) {
          body = viewHotelsList(state.hotelsCity);
        } else if (state.hotelsView === "list") {
          body = viewHotelsCities();
        } else {
          body = viewHotelsRoot();
        }
        break;
      case "transfer": body = viewTransferPlaceholder(); break;
      case "contact":  body = viewContact(); break;
    }
    return viewTopbar(cat.title) + body;
  }

  function viewUmraList() {
    return `
      <div class="crumb"><b>Asosiy</b><span class="sep">/</span>Umra paketlari</div>

      <div class="page-title">
        <h1>To‘rt yo‘nalish</h1>
        <div class="meta">Har bir yo‘nalish — tartibga solingan ziyorat, shaxsiy hamrohlik</div>
      </div>

      <div class="pkg-list">
        ${UMRA_PACKAGES.map((p) => `
          <button class="pkg-row ${p.highlight ? "vip" : (p.id === "ekonom" ? "eco" : p.id === "standard" ? "std" : "")}"
                  data-action="open-package" data-id="${p.id}">
            <div>
              <p class="tier">${esc(p.tier)}</p>
              <h3>${esc(p.title)}</h3>
              <p class="sub">${esc(p.cardSub)}</p>
            </div>
            <div class="right">
              <div class="days">${esc(p.days)}</div>
            </div>
            <div class="more">Tafsilot</div>
          </button>
        `).join("")}
      </div>
    `;
  }

  function viewVisaList() {
    return `
      <div class="crumb"><b>Asosiy</b><span class="sep">/</span>Vizalar</div>

      <div class="page-title">
        <h1>Saudiya viza<br/>xizmatlari</h1>
        <div class="meta">Hujjatlarni biz tayyorlaymiz · ${VISAS.length} ta turi</div>
      </div>

      <div class="pkg-list">
        ${VISAS.map((v) => `
          <button class="pkg-row visa-row" data-action="open-visa" data-id="${esc(v.id)}">
            <span class="vrow-ico"><svg width="30" height="30"><use href="#${esc(visaIcon(v))}"/></svg></span>
            <div>
              <p class="tier">${esc(v.short || "")}</p>
              <h3>${esc(v.title)}</h3>
              <p class="sub">${esc(v.tagline || "")}</p>
            </div>
            <div class="right">
              <div class="days">${esc(v.currency || "USD")}</div>
              <div class="visa-price">${v.price ? `$${v.price}` : "—"}</div>
            </div>
            <div class="more">Tafsilot</div>
          </button>
        `).join("")}
      </div>

      <div class="info-note">
        <div class="eyebrow">ESLATMA</div>
        <p class="t">Pasportingiz amal qilish muddati safardan kamida 6 oy keyin tugashi kerak.</p>
      </div>
    `;
  }

  function viewVisaDetail(visaId) {
    const v = VISAS.find((x) => x.id === visaId);
    if (!v) return viewVisaList();

    const featRows = (v.features || []).map((line) => `
      <div class="feat">
        <span class="ico"><svg width="20" height="20"><use href="#i-check"/></svg></span>
        <div><p class="ft">${esc(line)}</p></div>
      </div>
    `).join("");

    const warnRows = (v.warnings || []).length
      ? `<div class="warn-list">
           ${(v.warnings || []).map((w) => `
             <div class="warn">
               <span class="ico"><svg width="18" height="18"><use href="#i-warn"/></svg></span>
               <span>${esc(w)}</span>
             </div>
           `).join("")}
         </div>`
      : "";

    return viewTopbar(v.title) + `
      <div class="pkg-detail">
        <div class="detail-head">
          <div class="crumb"><b>Asosiy</b><span class="sep">/</span>Vizalar<span class="sep">/</span>${esc(v.title)}</div>
          <div class="title-row">
            <svg class="title-icon" width="36" height="36"><use href="#${esc(visaIcon(v))}"/></svg>
            <h1>${esc(v.title)}</h1>
          </div>
          <div class="hairline"></div>
          <p class="lede">${esc(v.tagline || "")}</p>
        </div>

        <div class="feat-list">${featRows}</div>

        ${warnRows}

        ${v.highlight ? `<div class="pkg-note">${esc(v.highlight)}</div>` : ""}

        <div class="visa-price-block">
          <div class="lbl">Narx</div>
          <div class="v">${v.price ? `$${v.price}` : "—"}<em>${esc(v.currency || "USD")}</em></div>
        </div>

        <div class="cta-wrap">
          <button class="cta" type="button" data-action="buy-visa" data-visa-id="${esc(v.id)}">
            <span class="cta-eyebrow">Pasport rasmini yuborish · botda</span>
            <span class="cta-main">Xarid qilish</span>
          </button>
        </div>
      </div>
    `;
  }

  // Open Telegram chat with the bot, passing a deep-link payload so
  // the bot can identify which visa the user is buying. Some Telegram
  // clients don't auto-close the Mini App, so we force it.
  function buyVisa(visaId) {
    if (!BOT_USERNAME) {
      alert("Botga ulanish vaqtincha mavjud emas. Birozdan keyin qayta urinib ko‘ring.");
      return;
    }
    const link = `https://t.me/${BOT_USERNAME}?start=visa_${encodeURIComponent(visaId)}`;
    if (tg && typeof tg.openTelegramLink === "function") {
      tg.openTelegramLink(link);
      setTimeout(() => {
        if (tg && typeof tg.close === "function") tg.close();
      }, 250);
    } else {
      window.location.href = link;
    }
  }

  // Root: two big buttons — "Mexmonxonalar ro'yxati" / "Xarid qilish"
  function viewHotelsRoot() {
    return `
      <div class="crumb"><b>Asosiy</b><span class="sep">/</span>Mexmonxonalar</div>
      <div class="page-title">
        <h1>Mexmonxonalar</h1>
        <div class="meta">Makka va Madina · Haram yaqinida</div>
      </div>

      <div class="big-choice">
        <button class="choice-card" type="button" data-action="hotels-open-list">
          <span class="ico"><svg width="28" height="28"><use href="#i-hotel"/></svg></span>
          <span class="label">
            <p class="t">Mexmonxonalar ro‘yxati</p>
            <p class="d">Makka va Madina bo‘yicha</p>
          </span>
          <span class="chev"><svg width="14" height="14"><use href="#i-chev"/></svg></span>
        </button>
        <button class="choice-card" type="button" data-action="hotels-open-purchase">
          <span class="ico"><svg width="28" height="28"><use href="#i-bag"/></svg></span>
          <span class="label">
            <p class="t">Xarid qilish</p>
            <p class="d">Maslahatchi orqali bron</p>
          </span>
          <span class="chev"><svg width="14" height="14"><use href="#i-chev"/></svg></span>
        </button>
      </div>
    `;
  }

  // City picker: two big buttons — MAKKA / MADINA
  function viewHotelsCities() {
    const card = (id, label, desc) => `
      <button class="choice-card" type="button" data-action="hotels-pick-city" data-city="${id}">
        <span class="ico"><svg width="28" height="28"><use href="#i-mosque"/></svg></span>
        <span class="label">
          <p class="t">${esc(label)}</p>
          <p class="d">${esc(desc)}</p>
        </span>
        <span class="chev"><svg width="14" height="14"><use href="#i-chev"/></svg></span>
      </button>
    `;
    return `
      <div class="crumb"><b>Asosiy</b><span class="sep">/</span>Mexmonxonalar<span class="sep">/</span>Ro‘yxat</div>
      <div class="page-title">
        <h1>Shahar tanlang</h1>
        <div class="meta">Mexmonxonalar Haramga yaqinligi bo‘yicha tanlangan</div>
      </div>

      <div class="big-choice">
        ${card("makka",  "MAKKA",  "Masjid al-Haram yaqinida")}
        ${card("madina", "MADINA", "Masjid an-Nabawiy yaqinida")}
      </div>
    `;
  }

  // Hotel list for one city, grouped into sections (VIP / Comfort / …).
  // Each section is a flat list of hotels. A "contact" segment (Ekonom)
  // renders a "biz bilan bog'laning" block instead of a list.
  function viewHotelsList(city) {
    const cityLabel = city === "makka" ? "Makka" : "Madina";
    const cityData = (HOTELS && HOTELS[city]) || {};
    const segments = (HOTEL_SEGMENTS && HOTEL_SEGMENTS[city]) || [];
    const heading = (seg) => seg.label ? `<p class="section-label">${esc(seg.label)}</p>` : "";

    const sections = segments.map((seg) => {
      if (seg.contact) {
        return `
          <section class="hotel-section">
            ${heading(seg)}
            <div class="hotel-contact">
              <p>${esc(seg.note || "")}</p>
              <a class="cta cta-simple" href="${CONTACT_URL}" target="_blank" rel="noopener">${CONTACT_LABEL}</a>
            </div>
          </section>
        `;
      }

      const items = Array.isArray(cityData[seg.id]) ? cityData[seg.id] : [];
      if (items.length === 0) {
        return `
          <section class="hotel-section">
            ${heading(seg)}
            <div class="hotel-empty">Tez orada joylanadi</div>
          </section>
        `;
      }

      const rows = items.map((h) => {
        const name = typeof h === "string" ? h : (h && h.name) || "";
        const stars = (h && h.stars) ? `<span class="stars">${"★".repeat(h.stars)}</span>` : "";
        return `<div class="hotel-row"><span class="hr-name">${esc(name)}</span>${stars}</div>`;
      }).join("");

      return `
        <section class="hotel-section">
          ${heading(seg)}
          <div class="hotel-frame">${rows}</div>
        </section>
      `;
    }).join("");

    const meta = city === "makka"
      ? "Toifa bo‘yicha taqsimlangan"
      : "Masjidi Nabawiy yaqinida";

    return `
      <div class="crumb"><b>Asosiy</b><span class="sep">/</span>Mexmonxonalar<span class="sep">/</span>${esc(cityLabel)}</div>
      <div class="page-title">
        <h1>${esc(cityLabel)}</h1>
        <div class="meta">${esc(meta)}</div>
      </div>
      ${sections}
    `;
  }

  // Purchase tab — opens the hotel booking modal.
  function viewHotelsPurchase() {
    return `
      <div class="crumb"><b>Asosiy</b><span class="sep">/</span>Mexmonxonalar<span class="sep">/</span>Xarid qilish</div>
      <div class="page-title">
        <h1>Xarid qilish</h1>
        <div class="meta">Bron arizasini qoldiring — menejer bog‘lanadi</div>
      </div>
      <div class="placeholder">
        <p>Quyidagi tugma orqali shahar, sana va kishilar sonini kiriting.<br/>Aniq taklif va narx menejer orqali yetkaziladi.</p>
      </div>
      <div class="cta-wrap">
        <button class="cta" type="button" data-action="open-hotel-order">
          <span class="cta-eyebrow">Mexmonxona bron qilish</span>
          <span class="cta-main">Buyurtma berish</span>
        </button>
      </div>
    `;
  }

  function viewTransferPlaceholder() {
    return `
      <div class="crumb"><b>Asosiy</b><span class="sep">/</span>Transferlar</div>
      <div class="page-title">
        <h1>Transferlar</h1>
        <div class="meta">Aeroport · Makka · Madina yo‘nalishlari</div>
      </div>

      <div class="transfer-list">
        ${TRANSFERS.map((t) => `
          <div class="transfer-card">
            <div class="transfer-head">
              <span class="vrow-ico"><svg width="30" height="30"><use href="#${esc(TRANSFER_ICONS[t.id] || "i-car")}"/></svg></span>
              <div>
                <p class="tier">${esc(t.short || "")}</p>
                <h3>${esc(t.title)}</h3>
                <p class="sub">${esc(t.tagline || "")}</p>
              </div>
            </div>

            <div class="transfer-feats">
              ${(t.features || []).map((f) => `
                <div class="transfer-feat">
                  <span class="ico"><svg width="16" height="16"><use href="#i-check"/></svg></span>
                  <span>${esc(f)}</span>
                </div>
              `).join("")}
            </div>

            ${(t.extras || []).length ? `
              <div class="transfer-extras">
                <div class="eyebrow">Qo‘shimcha</div>
                ${(t.extras || []).map((e) => `
                  <div class="transfer-extra">${esc(e)}</div>
                `).join("")}
              </div>` : ""}
          </div>
        `).join("")}
      </div>

      <div class="cta-wrap">
        <button class="cta" type="button" data-action="open-transfer-order">
          <span class="cta-eyebrow">Yo‘nalish va sana bilan</span>
          <span class="cta-main">Transferga buyurtma bering</span>
        </button>
      </div>
    `;
  }

  function viewContact() {
    const primary = CONTACTS.filter((c) => c.primary);
    const extras  = CONTACTS.filter((c) => !c.primary);

    const card = (c) => {
      if (c.kind === "phone") {
        return `
          <button class="contact-card primary"
                  type="button"
                  data-action="tap-phone"
                  data-num="${esc(c.value)}">
            <span class="ico"><svg width="22" height="22"><use href="#${c.icon}"/></svg></span>
            <div class="ct-body">
              <p class="ct-eyebrow">${esc(c.label)}</p>
              <p class="ct-main">${esc(c.value)}</p>
            </div>
            <span class="ct-chev"><svg width="14" height="14"><use href="#i-chev"/></svg></span>
          </button>
        `;
      }
      return `
        <a class="contact-card${c.primary ? " primary" : ""}"
           href="${esc(c.href)}"
           target="_blank" rel="noopener">
          <span class="ico"><svg width="22" height="22"><use href="#${c.icon}"/></svg></span>
          <div class="ct-body">
            <p class="ct-eyebrow">${esc(c.label)}</p>
            <p class="ct-main">${esc(c.value)}</p>
          </div>
          <span class="ct-chev"><svg width="14" height="14"><use href="#i-chev"/></svg></span>
        </a>
      `;
    };

    return `
      <div class="crumb"><b>Asosiy</b><span class="sep">/</span>Aloqa</div>
      <div class="page-title">
        <h1>Biz bilan<br/>bog‘laning</h1>
        <div class="meta">Maslahatchi bilan suhbat · 24/7</div>
      </div>

      <div class="contact-list">${primary.map(card).join("")}</div>

      <p class="section-label">Boshqa kanallar</p>
      <div class="contact-list">${extras.map(card).join("")}</div>
    `;
  }

  function viewPackageDetail(pkgId) {
    const pkg = UMRA_PACKAGES.find((p) => p.id === pkgId);
    if (!pkg) return viewUmraList();

    const feats = pkg.features.map((f) => `
      <div class="feat">
        <span class="ico"><svg width="22" height="22"><use href="#${f.icon}"/></svg></span>
        <div>
          <p class="ft">${esc(f.title)}</p>
          <p class="fd">${esc(f.desc)}</p>
        </div>
        <div class="fv">${esc(f.value)}</div>
      </div>
    `).join("");

    return viewTopbar(pkg.title) + `
      <div class="detail-head">
        <div class="crumb"><b>Asosiy</b><span class="sep">/</span>Umra paketlari<span class="sep">/</span>${esc(pkg.title)}</div>
        <h1>${esc(pkg.headline).replace(/\n/g, "<br/>")}</h1>
        <div class="hairline"></div>
        <p class="lede">${esc(pkg.lede)}</p>
      </div>

      <div class="feat-list">${feats}</div>

      <div class="cta-wrap">${ctaStacked(pkg)}</div>
    `;
  }

  // Simple single-line CTA used on category screens (Vizalar/Otel/Transfer/Aloqa).
  // Opens a Telegram chat directly.
  function ctaButton() {
    return `<a class="cta cta-simple" href="${CONTACT_URL}" target="_blank" rel="noopener">${CONTACT_LABEL}</a>`;
  }

  // Two-line stacked CTA on the Umra package detail screen.
  // Opens the in-app lead form (so admin gets a structured notification).
  function ctaStacked(pkg) {
    return `
      <button class="cta" type="button" data-action="open-lead" data-pkg-id="${esc(pkg.id)}">
        <span class="cta-eyebrow">Narxlar va mavjud sanalar bo‘yicha</span>
        <span class="cta-main">${CONTACT_LABEL}</span>
      </button>
    `;
  }

  function renderBottomNav() {
    if (state.screen === "home") {
      navEl.classList.add("hidden");
      navEl.innerHTML = "";
      return;
    }
    navEl.classList.remove("hidden");
    navEl.innerHTML = CATEGORIES.map((c) => `
      <button class="tab ${c.id === state.activeCategory ? "active" : ""}" data-action="switch-tab" data-id="${c.id}">
        <svg width="20" height="20"><use href="#${c.icon}"/></svg>
        <span class="lbl">${esc(c.short)}</span>
      </button>
    `).join("");
  }

  // ---------- navigation ----------

  function goHome() {
    state.activeCategory = null;
    state.activePackage = null;
    state.hotelsView = null;
    state.hotelsCity = null;
    contentEl.innerHTML = viewHome();
    setScreen("home");
    renderBottomNav();
  }

  function goCategory(catId) {
    state.activeCategory = catId;
    state.activePackage = null;
    state.activeVisa = null;
    if (catId !== "hotels") { state.hotelsView = null; state.hotelsCity = null; }
    contentEl.innerHTML = viewCategory(catId);
    setScreen("category");
    renderBottomNav();
  }

  function goPackage(pkgId) {
    state.activeCategory = "umra";
    state.activePackage = pkgId;
    state.activeVisa = null;
    contentEl.innerHTML = viewPackageDetail(pkgId);
    setScreen("package");
    renderBottomNav();
  }

  function goVisa(visaId) {
    state.activeCategory = "visa";
    state.activeVisa = visaId;
    state.activePackage = null;
    contentEl.innerHTML = viewVisaDetail(visaId);
    setScreen("visa");
    renderBottomNav();
  }

  // Go back one level: detail → list → home.
  function goBack() {
    if (state.activePackage) {
      goCategory("umra");
    } else if (state.activeVisa) {
      state.activeVisa = null;
      goCategory("visa");
    } else if (state.activeCategory === "hotels" && state.hotelsCity) {
      state.hotelsCity = null;
      goCategory("hotels");
    } else if (state.activeCategory === "hotels" && state.hotelsView) {
      state.hotelsView = null;
      goCategory("hotels");
    } else if (state.activeCategory) {
      goHome();
    }
  }

  // ---------- transfer order modal ----------

  function openTransferModal() {
    renderTransferForm();
    modalEl.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    setTimeout(() => {
      const sel = modalInner.querySelector('select[name="tariff"]');
      if (sel) sel.focus();
    }, 240);
  }

  function renderTransferForm() {
    const tariffOptions = TRANSFERS.map(
      (t) => `<option value="${esc(t.id)}">${esc(t.title)}</option>`
    ).join("");
    const cityOptions = (defaultId) =>
      ROUTE_CITIES.map(
        (c) => `<option value="${esc(c.id)}"${c.id === defaultId ? " selected" : ""}>${esc(c.title)}</option>`
      ).join("");

    modalInner.innerHTML = `
      <div class="modal-head">
        <div class="eyebrow">Transfer · Buyurtma</div>
        <h2 id="lead-title">Transferga buyurtma bering</h2>
        <div class="hairline"></div>
      </div>

      <div class="tabs-switch" role="tablist">
        <button type="button" class="tab-btn active" data-tab="individual" role="tab" aria-selected="true">Individual</button>
        <button type="button" class="tab-btn"        data-tab="group"      role="tab" aria-selected="false">Guruh</button>
      </div>

      <form id="order-form" data-mode="individual" novalidate>
        <div class="field" data-field="tariff">
          <label for="tr-tariff">Tarifni tanlang</label>
          <div class="select-wrap">
            <select id="tr-tariff" name="tariff" required>${tariffOptions}</select>
            <span class="select-caret"><svg width="14" height="14"><use href="#i-chev"/></svg></span>
          </div>
        </div>

        <div class="field" data-field="name">
          <label for="tr-name">Ism va familiya</label>
          <input id="tr-name" name="name" type="text" maxlength="100" required
                 autocomplete="name" placeholder="Familiya Ism" />
          <div class="err">Iltimos, ismingizni kiriting</div>
        </div>

        <div class="field" data-field="phone">
          <label for="tr-phone">Telefon raqam</label>
          <input id="tr-phone" name="phone" type="tel" maxlength="20" required
                 autocomplete="tel" inputmode="tel" placeholder="+998 __ ___ __ __" />
          <div class="err">Telefon raqamingizni to‘liq kiriting</div>
        </div>

        <div class="field group-only" data-field="group_size">
          <label for="tr-size">Kishilar soni</label>
          <input id="tr-size" name="group_size" type="tel" inputmode="numeric" maxlength="4" placeholder="25" />
          <div class="err">2 dan ko‘p sonni kiriting</div>
        </div>

        <div class="field group-only" data-field="organization">
          <label for="tr-org">Tashkilot nomi <span class="opt">(ixtiyoriy)</span></label>
          <input id="tr-org" name="organization" type="text" maxlength="100" placeholder="Masalan: Olmazor Travel" />
        </div>

        <div class="field" data-field="route">
          <label>Yo‘nalish</label>
          <div class="route-grid">
            <div class="route-cell">
              <div class="route-cell__lbl">Qaerdan</div>
              <div class="select-wrap">
                <select name="from_city">${cityOptions("jidda")}</select>
                <span class="select-caret"><svg width="14" height="14"><use href="#i-chev"/></svg></span>
              </div>
            </div>
            <div class="route-arrow">→</div>
            <div class="route-cell">
              <div class="route-cell__lbl">Qayerga</div>
              <div class="select-wrap">
                <select name="to_city">${cityOptions("makka")}</select>
                <span class="select-caret"><svg width="14" height="14"><use href="#i-chev"/></svg></span>
              </div>
            </div>
          </div>
          <div class="err">Boshlang‘ich va manzil shaharlari bir xil bo‘lmasligi kerak</div>
        </div>

        <div class="field" data-field="date">
          <label for="tr-date">Sana</label>
          <input id="tr-date" name="date" type="tel" inputmode="numeric"
                 maxlength="10" placeholder="kk/oo/yyyy" required />
          <div class="err">Sanani to‘g‘ri formatda kiriting (kk/oo/yyyy)</div>
        </div>

        <div class="field" data-field="comment">
          <label for="tr-comment">Qo‘shimcha izoh <span class="opt">(ixtiyoriy)</span></label>
          <textarea id="tr-comment" name="comment" maxlength="500"
                    placeholder="Masalan: 2 nafar bola bilan, ekonom o‘rinli"></textarea>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn-secondary" data-action="close-lead">Bekor</button>
          <button type="submit" class="btn-primary" data-role="submit">Yuborish</button>
        </div>
      </form>
    `;

    const form = modalInner.querySelector("#order-form");
    bindPhoneMask(form.querySelector('input[name="phone"]'));
    bindDateMask(form.querySelector('input[name="date"]'));
    bindTabSwitch(form);
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      submitTransferOrder(form);
    });
  }

  // Toggles between Individual and Guruh modes. The form's data-mode
  // attribute drives CSS (group-only blocks are hidden by default).
  function bindTabSwitch(form) {
    const buttons = modalInner.querySelectorAll(".tab-btn");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.classList.contains("active")) return;
        buttons.forEach((b) => {
          b.classList.remove("active");
          b.setAttribute("aria-selected", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
        form.dataset.mode = btn.dataset.tab;
      });
    });
  }

  // Simple Uzbekistan phone mask: forces +998 prefix and spacing.
  function bindPhoneMask(input) {
    if (!input) return;
    const format = (raw) => {
      let v = String(raw || "").replace(/\D/g, "");
      if (v.startsWith("998")) v = v.slice(3);
      v = v.slice(0, 9);
      let out = "+998";
      if (v.length > 0) out += " " + v.slice(0, 2);
      if (v.length > 2) out += " " + v.slice(2, 5);
      if (v.length > 5) out += " " + v.slice(5, 7);
      if (v.length > 7) out += " " + v.slice(7, 9);
      return out;
    };
    input.addEventListener("focus", () => {
      if (!input.value) input.value = "+998 ";
    });
    input.addEventListener("input", () => {
      input.value = format(input.value);
    });
  }

  // Bank-card style date mask: kk / oo / yyyy
  function bindDateMask(input) {
    if (!input) return;
    input.addEventListener("input", () => {
      const v = input.value.replace(/\D/g, "").slice(0, 8);
      let out = v.slice(0, 2);
      if (v.length > 2) out += "/" + v.slice(2, 4);
      if (v.length > 4) out += "/" + v.slice(4, 8);
      input.value = out;
    });
  }

  function validDate(s) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || "");
    if (!m) return false;
    const d = +m[1], mo = +m[2], y = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2024 || y > 2099) return false;
    const dt = new Date(y, mo - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
  }

  async function submitTransferOrder(form) {
    const tariffSel = form.querySelector('select[name="tariff"]');
    const fromSel = form.querySelector('select[name="from_city"]');
    const toSel = form.querySelector('select[name="to_city"]');
    const nameInput = form.querySelector('input[name="name"]');
    const phoneInput = form.querySelector('input[name="phone"]');
    const dateInput = form.querySelector('input[name="date"]');
    const sizeInput = form.querySelector('input[name="group_size"]');
    const orgInput = form.querySelector('input[name="organization"]');
    const commentInput = form.querySelector('textarea[name="comment"]');
    const submitBtn = form.querySelector('[data-role="submit"]');

    [...form.querySelectorAll(".field")].forEach((f) => f.classList.remove("invalid"));

    const mode = form.dataset.mode === "group" ? "group" : "individual";
    const name = (nameInput.value || "").trim();
    const phone = (phoneInput.value || "").trim();
    const date = (dateInput.value || "").trim();
    const fromCity = fromSel.value;
    const toCity = toSel.value;
    const tariffId = tariffSel.value;
    const tariff = TRANSFERS.find((t) => t.id === tariffId);
    const groupSize = parseInt(sizeInput.value || "0", 10) || 0;
    const organization = (orgInput.value || "").trim();
    const comment = (commentInput.value || "").trim();

    let ok = true;
    if (!name) { form.querySelector('[data-field="name"]').classList.add("invalid"); ok = false; }
    if (phone.replace(/\D/g, "").length < 12) {
      form.querySelector('[data-field="phone"]').classList.add("invalid"); ok = false;
    }
    if (fromCity === toCity) {
      form.querySelector('[data-field="route"]').classList.add("invalid"); ok = false;
    }
    if (!validDate(date)) {
      form.querySelector('[data-field="date"]').classList.add("invalid"); ok = false;
    }
    if (mode === "group" && (groupSize < 2 || groupSize > 500)) {
      form.querySelector('[data-field="group_size"]').classList.add("invalid"); ok = false;
    }
    if (!ok) return;

    submitBtn.disabled = true;
    submitBtn.textContent = "Yuborilmoqda…";

    const initData = (tg && tg.initData) || "";

    const cityTitle = (id) => (ROUTE_CITIES.find((c) => c.id === id) || {}).title || id;

    try {
      const resp = await fetch(`${API_URL}/order-transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, phone, date,
          tariff_id: tariffId,
          tariff_title: tariff ? tariff.title : tariffId,
          from_city: cityTitle(fromCity),
          to_city: cityTitle(toCity),
          booking_type: mode,
          group_size: mode === "group" ? groupSize : 0,
          organization: mode === "group" ? organization : "",
          comment,
          init_data: initData,
        }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${resp.status}`);
      }
      trackContact("transfer");
      renderLeadStatus(
        "success",
        "Ariza qabul qilindi",
        "Menejer tez orada Telegram orqali bog‘lanadi."
      );
    } catch (e) {
      renderLeadStatus(
        "error",
        "Xatolik yuz berdi",
        e && e.message
          ? `${e.message}. Birozdan keyin qayta urinib ko‘ring.`
          : "Tarmoq xatosi. Birozdan keyin qayta urinib ko‘ring."
      );
    }
  }

  // ---------- hotel order modal ----------

  function openHotelOrderModal() {
    renderHotelOrderForm();
    modalEl.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    setTimeout(() => {
      const inp = modalInner.querySelector('input[name="phone"]');
      if (inp) inp.focus();
    }, 240);
  }

  function renderHotelOrderForm() {
    modalInner.innerHTML = `
      <div class="modal-head">
        <div class="eyebrow">Mexmonxona · Buyurtma</div>
        <h2 id="lead-title">Bron arizasi</h2>
        <div class="hairline"></div>
      </div>

      <form id="hotel-form" novalidate>
        <div class="field" data-field="phone">
          <label for="hl-phone">Telefon raqam</label>
          <input id="hl-phone" name="phone" type="tel" maxlength="20" required
                 autocomplete="tel" inputmode="tel" placeholder="+998 __ ___ __ __" />
          <div class="err">Telefon raqamingizni to‘liq kiriting</div>
        </div>

        <div class="field" data-field="city">
          <label for="hl-city">Shahar</label>
          <div class="select-wrap">
            <select id="hl-city" name="city" required>
              <option value="makka" selected>Makka</option>
              <option value="madina">Madina</option>
            </select>
            <span class="select-caret"><svg width="14" height="14"><use href="#i-chev"/></svg></span>
          </div>
        </div>

        <div class="field" data-field="hotel_name">
          <label for="hl-hotel">Mexmonxona nomi</label>
          <input id="hl-hotel" name="hotel_name" type="text" maxlength="120" required
                 placeholder="Masalan: Swiss Al Maqom yoki boshqa" />
          <div class="err">Mexmonxona nomini kiriting</div>
        </div>

        <div class="field" data-field="dates">
          <label>Sana</label>
          <div class="two-col">
            <div class="two-col-cell">
              <div class="two-col-lbl">Kirish</div>
              <input name="check_in" type="tel" inputmode="numeric" maxlength="10" placeholder="kk/oo/yyyy" required />
            </div>
            <div class="two-col-cell">
              <div class="two-col-lbl">Chiqish</div>
              <input name="check_out" type="tel" inputmode="numeric" maxlength="10" placeholder="kk/oo/yyyy" required />
            </div>
          </div>
          <div class="err">Sanani to‘g‘ri kiriting (chiqish sanasi kirishdan keyin bo‘lishi kerak)</div>
        </div>

        <div class="field" data-field="room_type">
          <label for="hl-room">Xona turi</label>
          <div class="select-wrap">
            <select id="hl-room" name="room_type">
              <option value="DBL" selected>DBL — 2 o‘rinli</option>
              <option value="TRPL">TRPL — 3 o‘rinli</option>
              <option value="QDRPL">QDRPL — 4 o‘rinli</option>
            </select>
            <span class="select-caret"><svg width="14" height="14"><use href="#i-chev"/></svg></span>
          </div>
        </div>

        <div class="field" data-field="rooms">
          <label for="hl-rooms">Xonalar soni</label>
          <input id="hl-rooms" name="rooms" type="tel" inputmode="numeric" maxlength="3" placeholder="1" value="1" />
          <div class="err">Kamida 1 ta xona kiriting</div>
        </div>

        <div class="field" data-field="meal">
          <label for="hl-meal">Ovqat turi</label>
          <div class="select-wrap">
            <select id="hl-meal" name="meal">
              <option value="BB (Nonushta)" selected>BB — Nonushta</option>
              <option value="HB (Nonushta + kechki ovqat)">HB — Nonushta + kechki ovqat</option>
            </select>
            <span class="select-caret"><svg width="14" height="14"><use href="#i-chev"/></svg></span>
          </div>
        </div>

        <div class="field" data-field="comment">
          <label for="hl-comment">Qo‘shimcha izoh <span class="opt">(ixtiyoriy)</span></label>
          <textarea id="hl-comment" name="comment" maxlength="500"
                    placeholder="Masalan: Haramga yaqin, oilaviy xona"></textarea>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn-secondary" data-action="close-lead">Bekor</button>
          <button type="submit" class="btn-primary" data-role="submit">Yuborish</button>
        </div>
      </form>
    `;

    const form = modalInner.querySelector("#hotel-form");
    bindPhoneMask(form.querySelector('input[name="phone"]'));
    bindDateMask(form.querySelector('input[name="check_in"]'));
    bindDateMask(form.querySelector('input[name="check_out"]'));
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      submitHotelOrder(form);
    });
  }

  function parseDate(s) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || "");
    if (!m) return null;
    const d = +m[1], mo = +m[2], y = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2024 || y > 2099) return null;
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return dt;
  }

  async function submitHotelOrder(form) {
    const fields = ["hotel_name","phone","city","dates","rooms"];
    fields.forEach((f) => {
      const el = form.querySelector(`[data-field="${f}"]`);
      if (el) el.classList.remove("invalid");
    });

    const hotelName = (form.querySelector('input[name="hotel_name"]').value || "").trim();
    const phone = (form.querySelector('input[name="phone"]').value || "").trim();
    const city = form.querySelector('select[name="city"]').value;
    const checkIn = (form.querySelector('input[name="check_in"]').value || "").trim();
    const checkOut = (form.querySelector('input[name="check_out"]').value || "").trim();
    const roomType = form.querySelector('select[name="room_type"]').value;
    const rooms = parseInt(form.querySelector('input[name="rooms"]').value || "0", 10) || 0;
    const meal = form.querySelector('select[name="meal"]').value;
    const comment = (form.querySelector('textarea[name="comment"]').value || "").trim();
    const submitBtn = form.querySelector('[data-role="submit"]');

    let ok = true;
    if (!hotelName) { form.querySelector('[data-field="hotel_name"]').classList.add("invalid"); ok = false; }
    if (phone.replace(/\D/g, "").length < 12) {
      form.querySelector('[data-field="phone"]').classList.add("invalid"); ok = false;
    }
    const inDate = parseDate(checkIn);
    const outDate = parseDate(checkOut);
    if (!inDate || !outDate || outDate <= inDate) {
      form.querySelector('[data-field="dates"]').classList.add("invalid"); ok = false;
    }
    if (rooms < 1 || rooms > 100) {
      form.querySelector('[data-field="rooms"]').classList.add("invalid"); ok = false;
    }
    if (!ok) return;

    submitBtn.disabled = true;
    submitBtn.textContent = "Yuborilmoqda…";

    const initData = (tg && tg.initData) || "";

    try {
      const resp = await fetch(`${API_URL}/order-hotel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotel_name: hotelName,
          phone,
          city,
          check_in: checkIn,
          check_out: checkOut,
          room_type: roomType,
          rooms,
          meal,
          comment,
          init_data: initData,
        }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${resp.status}`);
      }
      trackContact("hotel");
      renderLeadStatus(
        "success",
        "Ariza qabul qilindi",
        "Menejer tez orada Telegram orqali bog‘lanadi."
      );
    } catch (e) {
      renderLeadStatus(
        "error",
        "Xatolik yuz berdi",
        e && e.message
          ? `${e.message}. Birozdan keyin qayta urinib ko‘ring.`
          : "Tarmoq xatosi. Birozdan keyin qayta urinib ko‘ring."
      );
    }
  }

  // ---------- lead modal ----------

  const modalEl = document.getElementById("lead-modal");
  const modalInner = modalEl.querySelector(".modal");

  function openLeadModal(ref) {
    // ref = { kind: "package" | "visa", id }
    let item, eyebrow;
    if (ref.kind === "package") {
      item = UMRA_PACKAGES.find((p) => p.id === ref.id);
      if (!item) return;
      eyebrow = `Umra · ${item.tier}`;
      item.__title = `${item.title} paketi`;
      item.__leadId = `package:${item.id}`;
      item.__leadTitle = `${item.title} (${item.tier})`;
    } else {
      item = VISAS.find((v) => v.id === ref.id);
      if (!item) return;
      eyebrow = `Viza · ${item.short || ""}`;
      item.__title = item.title;
      item.__leadId = `visa:${item.id}`;
      item.__leadTitle = `${item.title}${item.price ? ` ($${item.price})` : ""}`;
    }
    renderLeadForm(item, eyebrow);
    modalEl.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    setTimeout(() => {
      const input = modalInner.querySelector('input[name="name"]');
      if (input) input.focus();
    }, 240);
  }

  function closeLeadModal() {
    modalEl.classList.add("hidden");
    document.body.style.overflow = "";
  }

  function renderLeadForm(item, eyebrow) {
    modalInner.innerHTML = `
      <div class="modal-head">
        <div class="eyebrow">${esc(eyebrow)}</div>
        <h2 id="lead-title">${esc(item.__title)}</h2>
        <div class="hairline"></div>
      </div>
      <form id="lead-form" novalidate>
        <div class="field" data-field="name">
          <label for="lead-name">Ismingiz</label>
          <input id="lead-name" name="name" type="text" maxlength="100" required
                 autocomplete="given-name" placeholder="Familiya Ism" />
          <div class="err">Iltimos, ismingizni kiriting</div>
        </div>
        <div class="field" data-field="question">
          <label for="lead-question">Qo‘shimcha savol (ixtiyoriy)</label>
          <textarea id="lead-question" name="question" maxlength="2000"
                    placeholder="Masalan: sentyabrda guruh bormi?"></textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" data-action="close-lead">Bekor</button>
          <button type="submit" class="btn-primary" data-role="submit">Yuborish</button>
        </div>
      </form>
    `;
    const form = modalInner.querySelector("#lead-form");
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      submitLead(item, form);
    });
  }

  function renderLeadStatus(kind, title, text) {
    const glyph = kind === "success"
      ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 L10 17.5 L19 7.5"/></svg>'
      : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8 L12 13 M12 16.5 L12.01 16.5"/><circle cx="12" cy="12" r="9"/></svg>';
    modalInner.innerHTML = `
      <div class="modal-status ${kind}">
        <div class="glyph">${glyph}</div>
        <h3>${esc(title)}</h3>
        <p>${esc(text)}</p>
        <div class="modal-actions" style="justify-content:center">
          <button type="button" class="btn-primary" data-action="close-lead">Yopish</button>
        </div>
      </div>
    `;
  }

  async function submitLead(item, form) {
    const nameField = form.querySelector('[data-field="name"]');
    const nameInput = form.querySelector('input[name="name"]');
    const questionInput = form.querySelector('textarea[name="question"]');
    const submitBtn = form.querySelector('[data-role="submit"]');

    const name = (nameInput.value || "").trim();
    const question = (questionInput.value || "").trim();

    nameField.classList.remove("invalid");
    if (!name) {
      nameField.classList.add("invalid");
      nameInput.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Yuborilmoqda…";

    const initData = (tg && tg.initData) || "";

    try {
      const resp = await fetch(`${API_URL}/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          question,
          package_id: item.__leadId,
          package_title: item.__leadTitle,
          init_data: initData,
        }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${resp.status}`);
      }
      trackContact("lead");
      renderLeadStatus(
        "success",
        "Rahmat!",
        "Sizning so‘rovingiz qabul qilindi. Menejer tez orada Telegram orqali bog‘lanadi."
      );
    } catch (e) {
      renderLeadStatus(
        "error",
        "Xatolik yuz berdi",
        e && e.message
          ? `${e.message}. Birozdan keyin qayta urinib ko‘ring.`
          : "Tarmoq xatosi. Birozdan keyin qayta urinib ko‘ring."
      );
    }
  }

  // ---------- events ----------

  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-action]");
    if (!t) return;
    const action = t.dataset.action;
    const id = t.dataset.id;

    switch (action) {
      case "open-category": trackCategory(id); goCategory(id); break;
      case "switch-tab":    trackCategory(id); goCategory(id); break;
      case "open-package":  goPackage(id); break;
      case "open-visa":     goVisa(id); break;
      case "go-back":       goBack(); break;
      case "go-home":       goHome(); break;
      case "open-lead":     openLeadModal({ kind: "package", id: t.dataset.pkgId }); break;
      case "buy-visa":      buyVisa(t.dataset.visaId); break;
      case "open-transfer-order": openTransferModal(); break;
      case "close-lead":    closeLeadModal(); break;
      case "tap-phone":     tapPhone(t.dataset.num); break;
      case "hotels-open-list":     state.hotelsView = "list"; state.hotelsCity = null; goCategory("hotels"); break;
      case "hotels-open-purchase": state.hotelsView = "purchase"; state.hotelsCity = null; goCategory("hotels"); break;
      case "hotels-pick-city":     state.hotelsCity = t.dataset.city; goCategory("hotels"); break;
      case "open-hotel-order":     openHotelOrderModal(); break;
    }
  });

  // Track outbound link / contact card taps so /stats can show top channels.
  document.addEventListener("click", (ev) => {
    const a = ev.target.closest(".contact-card[href], .cta-simple[href]");
    if (a) trackLocation(a.getAttribute("href"));
  });

  // Telegram WebView blocks tel: links on most clients, so the dependable
  // action is to copy the number and show a confirmation. We still attempt
  // a system dial as a no-op on platforms where it fails.
  function tapPhone(displayNum) {
    const dialNum = String(displayNum || "").replace(/[^+\d]/g, "");
    trackLocation("tel:" + dialNum);
    let copied = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(displayNum);
        copied = true;
      } else {
        const ta = document.createElement("textarea");
        ta.value = displayNum;
        ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        copied = document.execCommand("copy");
        document.body.removeChild(ta);
      }
    } catch (_) { /* clipboard not available */ }
    try { window.location.href = "tel:" + dialNum; } catch (_) {}
    showToast(copied ? `Raqam nusxalandi: ${displayNum}` : displayNum);
  }

  let toastTimer = null;
  function showToast(msg) {
    let el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  // close modal on overlay tap (but not when clicking the inner card)
  modalEl.addEventListener("click", (ev) => {
    if (ev.target === modalEl) closeLeadModal();
  });

  // close modal on Escape
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && !modalEl.classList.contains("hidden")) {
      closeLeadModal();
    }
  });

  // ---------- init ----------

  (async function init() {
    // Render fallback immediately so the screen isn't blank during fetch.
    goHome();
    await fetchContent();
    trackOpen();
    // Re-render current screen if it's data-driven.
    if (state.screen === "category" && state.activeCategory === "visa") {
      contentEl.innerHTML = viewCategory("visa");
    } else if (state.screen === "category" && state.activeCategory === "transfer") {
      contentEl.innerHTML = viewCategory("transfer");
    } else if (state.screen === "visa") {
      contentEl.innerHTML = viewVisaDetail(state.activeVisa);
    }
  })();
})();
