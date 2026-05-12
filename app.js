(function () {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    if (tg.setHeaderColor)     tg.setHeaderColor("#2a1f15");
    if (tg.setBackgroundColor) tg.setBackgroundColor("#2a1f15");
  }

  const appEl     = document.getElementById("app");
  const contentEl = document.getElementById("content");
  const navEl     = document.getElementById("bottom-nav");

  const state = {
    screen: "home",          // "home" | "category" | "package"
    activeCategory: null,
    activePackage: null,
  };

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
      case "visa":     body = viewVisaList(); break;
      case "hotels":   body = viewHotelsPlaceholder(); break;
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
        <div class="meta">Hujjatlarni biz tayyorlaymiz · narxlar bo‘yicha bog‘laning</div>
      </div>

      <div class="visa-list">
        ${VISAS.map((v) => `
          <div class="visa">
            <span class="ico"><svg width="22" height="22"><use href="#${v.icon}"/></svg></span>
            <span class="meta">
              <p class="n">${esc(v.title)}</p>
              <p class="d">${esc(v.desc)}</p>
            </span>
          </div>
        `).join("")}
      </div>

      <div class="info-note">
        <div class="eyebrow">ESLATMA</div>
        <p class="t">Pasportingiz amal qilish muddati safardan kamida 6 oy keyin tugashi kerak.</p>
      </div>

      <div class="cta-wrap">${ctaButton()}</div>
    `;
  }

  function viewHotelsPlaceholder() {
    return `
      <div class="crumb"><b>Asosiy</b><span class="sep">/</span>Mexmonxonalar</div>
      <div class="page-title">
        <h1>Mexmonxonalar</h1>
        <div class="meta">Makka va Madina · Haram yaqinida</div>
      </div>
      <div class="placeholder">
        <p>Mehmonxonalar ro‘yxati tez kunda joylanadi.<br/>Aniq variantlar uchun biz bilan bog‘laning.</p>
      </div>
      <div class="cta-wrap">${ctaButton()}</div>
    `;
  }

  function viewTransferPlaceholder() {
    return `
      <div class="crumb"><b>Asosiy</b><span class="sep">/</span>Transferlar</div>
      <div class="page-title">
        <h1>Transferlar</h1>
        <div class="meta">Aeroport · Makka · Madina yo‘nalishlari</div>
      </div>
      <div class="placeholder">
        <p>Transport turlari va shartlari tez kunda joylanadi.<br/>Aniq taklif uchun biz bilan bog‘laning.</p>
      </div>
      <div class="cta-wrap">${ctaButton()}</div>
    `;
  }

  function viewContact() {
    return `
      <div class="crumb"><b>Asosiy</b><span class="sep">/</span>Aloqa</div>
      <div class="page-title">
        <h1>Biz bilan<br/>bog‘laning</h1>
        <div class="meta">Maslahatchi bilan suhbat · 24/7</div>
      </div>
      <div class="placeholder">
        <p>Savol, taklif yoki buyurtma uchun<br/>Telegram orqali yozing — tez orada javob beramiz.</p>
      </div>
      <div class="cta-wrap">${ctaButton()}</div>
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

      <div class="cta-wrap">${ctaStacked()}</div>
    `;
  }

  // Simple single-line CTA used on category screens.
  function ctaButton() {
    return `<a class="cta cta-simple" href="${CONTACT_URL}" target="_blank" rel="noopener">${CONTACT_LABEL}</a>`;
  }

  // Two-line stacked CTA used on the package detail screen.
  function ctaStacked() {
    return `
      <a class="cta" href="${CONTACT_URL}" target="_blank" rel="noopener">
        <span class="cta-eyebrow">Narxlar va mavjud sanalar bo‘yicha</span>
        <span class="cta-main">${CONTACT_LABEL}</span>
      </a>
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
    contentEl.innerHTML = viewHome();
    setScreen("home");
    renderBottomNav();
  }

  function goCategory(catId) {
    state.activeCategory = catId;
    state.activePackage = null;
    contentEl.innerHTML = viewCategory(catId);
    setScreen("category");
    renderBottomNav();
  }

  function goPackage(pkgId) {
    state.activeCategory = "umra";
    state.activePackage = pkgId;
    contentEl.innerHTML = viewPackageDetail(pkgId);
    setScreen("package");
    renderBottomNav();
  }

  // Go back one level: package detail → Umra list → home.
  function goBack() {
    if (state.activePackage) {
      goCategory("umra");
    } else if (state.activeCategory) {
      goHome();
    }
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
      case "go-back":       goBack(); break;
      case "go-home":       goHome(); break;
    }
  });

  // ---------- init ----------
  goHome();
})();
