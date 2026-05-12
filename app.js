(function () {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    if (tg.setHeaderColor)     tg.setHeaderColor("#0f1225");
    if (tg.setBackgroundColor) tg.setBackgroundColor("#0f1225");
  }

  const appEl     = document.getElementById("app");
  const contentEl = document.getElementById("content");
  const tabbarEl  = document.getElementById("tabbar");

  const state = {
    screen: "home",          // "home" | "category" | "package"
    activeCategory: null,
    activePackage: null,
  };

  // ---------- helpers ----------

  const esc = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function setScreen(name) {
    state.screen = name;
    appEl.dataset.screen = name;
    window.scrollTo(0, 0);
  }

  // Split a line into leading emoji/icon + remaining text.
  function splitIcon(line) {
    const idx = line.indexOf(" ");
    if (idx <= 0) return { icon: "·", text: line };
    return { icon: line.slice(0, idx), text: line.slice(idx + 1) };
  }

  // ---------- views ----------

  function viewHome() {
    return `
      <div class="hero">
        <div class="logo-img">
          <img src="assets/saudia-service-logo.png" alt="Saudia Service — Umra & Hajj" />
        </div>
        <div class="arabic">Makkah · Madinah</div>
      </div>

      <div class="cats">
        ${CATEGORIES.map((c) => `
          <button class="cat" data-action="open-category" data-id="${c.id}">
            <div class="ico">${c.numeral}</div>
            <div class="label">
              <div class="t">${esc(c.title)}</div>
              <div class="d">${esc(c.subtitle)}</div>
            </div>
            <div class="chev">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
            </div>
          </button>
        `).join("")}
      </div>
    `;
  }

  function viewCategory(catId) {
    const cat = CATEGORIES.find((c) => c.id === catId);

    let body = "";
    switch (catId) {
      case "umra":     body = viewUmraList(); break;
      case "visa":     body = viewVisaList(); break;
      case "hotels":   body = viewPlaceholder(
        "Tez orada",
        "Mexmonxonalar bo‘yicha ma’lumotlar tez kunda joylanadi.\nAniq taklif uchun biz bilan bog‘laning."
      ); break;
      case "transfer": body = viewPlaceholder(
        "Tez orada",
        "Transfer xizmatlari bo‘yicha ma’lumotlar tez kunda joylanadi.\nAniq taklif uchun biz bilan bog‘laning."
      ); break;
      case "contact":  body = viewContact(); break;
    }

    return `
      <div class="topbar">
        <button class="iconbtn" data-action="go-home" aria-label="Bosh sahifa">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
        </button>
        <div class="title">${esc(cat.title)}</div>
        <div style="width:32px"></div>
      </div>
      ${body}
    `;
  }

  function viewUmraList() {
    return `
      <div class="section-head">
        <div class="eyebrow">Saudia Arabia · Umra</div>
        <h2>Paketni tanlang</h2>
        <p>Har bir paket — siz uchun mukammal<br/>tartibga solingan ziyorat.</p>
      </div>
      <div class="pkg-list">
        ${UMRA_PACKAGES.map((p) => `
          <button class="pkg ${p.highlight ? "vip" : ""}" data-action="open-package" data-id="${p.id}">
            <div class="pkg-head">
              <div class="pkg-tier">${esc(p.tier)}</div>
              <div class="pkg-days">${esc(p.days)}</div>
            </div>
            <h3>${esc(p.title)}</h3>
            <div class="pkg-sub">${esc(p.subtitle)}</div>
            <div class="pkg-row">
              <div class="pkg-cta">Batafsil
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
              </div>
            </div>
          </button>
        `).join("")}
      </div>
    `;
  }

  function viewVisaList() {
    return `
      <div class="section-head">
        <div class="eyebrow">Saudia Arabia · 2026</div>
        <h2>Viza turini tanlang</h2>
        <p>Hujjatlarni biz tayyorlaymiz. Siz faqat<br/>safarga tayyorlik ko‘rasiz.</p>
      </div>
      <div class="visa-list">
        ${VISAS.map((v) => `
          <div class="visa">
            <div class="badge">${esc(v.badge)}</div>
            <div class="meta">
              <div class="n">${esc(v.title)}</div>
              <div class="d">${esc(v.desc)}</div>
            </div>
          </div>
        `).join("")}
      </div>
      <div class="notice">
        <b>Eslatma —</b> Aniq narxlar va shartlar uchun menejer bilan bog‘laning.
      </div>
      <div style="padding:24px 20px 0;">
        ${ctaButton()}
      </div>
    `;
  }

  function viewPlaceholder(title, text) {
    return `
      <div class="placeholder">
        <h3>${esc(title)}</h3>
        <p>${esc(text).replace(/\n/g, "<br/>")}</p>
        <div class="cta-wrap">${ctaButton()}</div>
      </div>
    `;
  }

  function viewContact() {
    return `
      <div class="placeholder">
        <h3>Biz bilan bog‘laning</h3>
        <p>Savol, taklif yoki buyurtma uchun<br/>Telegram orqali yozing — tezda javob beramiz.</p>
        <div class="cta-wrap">
          <a class="cta" href="${CONTACT_URL}" target="_blank" rel="noopener">
            Telegram orqali yozish
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
          </a>
        </div>
      </div>
    `;
  }

  function viewPackageDetail(pkgId) {
    const pkg = UMRA_PACKAGES.find((p) => p.id === pkgId);
    if (!pkg) return viewUmraList();

    const feats = pkg.lines.map((line) => {
      const { icon, text } = splitIcon(line);
      return `
        <div class="feat">
          <div class="fi">${icon}</div>
          <div class="ft">${esc(text)}</div>
        </div>
      `;
    }).join("");

    return `
      <div class="pkg-detail">
        <button class="back" data-action="back-to-umra">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
          ORQAGA
        </button>

        <div class="tier-line">
          <span class="pill">${esc(pkg.tier)}</span>
          <span class="days">${esc(pkg.days)}</span>
        </div>
        <h1 class="pname">${esc(pkg.title)}</h1>
        <div class="pname-sub">${esc(pkg.subtitle)}</div>

        <div class="feats">${feats}</div>

        ${pkg.note ? `<div class="pkg-note">${esc(pkg.note)}</div>` : ""}

        <div class="cta-wrap">${ctaButton()}</div>
      </div>
    `;
  }

  function ctaButton() {
    return `
      <a class="cta" href="${CONTACT_URL}" target="_blank" rel="noopener">
        ${CONTACT_LABEL}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
      </a>
    `;
  }

  function renderTabbar() {
    if (state.screen === "home") {
      tabbarEl.classList.add("hidden");
      tabbarEl.innerHTML = "";
      return;
    }
    tabbarEl.classList.remove("hidden");
    tabbarEl.innerHTML = CATEGORIES.map((c) => `
      <button class="tab ${c.id === state.activeCategory ? "active" : ""}" data-action="switch-tab" data-id="${c.id}">
        ${ICONS[c.id]}
        <span>${esc(c.short)}</span>
      </button>
    `).join("");
  }

  // ---------- navigation ----------

  function goHome() {
    state.activeCategory = null;
    state.activePackage = null;
    contentEl.innerHTML = viewHome();
    setScreen("home");
    renderTabbar();
  }

  function goCategory(catId) {
    state.activeCategory = catId;
    state.activePackage = null;
    contentEl.innerHTML = viewCategory(catId);
    setScreen("category");
    renderTabbar();
  }

  function goPackage(pkgId) {
    state.activeCategory = "umra";
    state.activePackage = pkgId;
    contentEl.innerHTML = viewPackageDetail(pkgId);
    setScreen("package");
    renderTabbar();
  }

  // ---------- events ----------

  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-action]");
    if (!t) return;
    const action = t.dataset.action;
    const id = t.dataset.id;

    switch (action) {
      case "open-category": goCategory(id); break;
      case "switch-tab":    goCategory(id); break;
      case "open-package":  goPackage(id); break;
      case "back-to-umra":  goCategory("umra"); break;
      case "go-home":       goHome(); break;
    }
  });

  // ---------- init ----------
  goHome();
})();
