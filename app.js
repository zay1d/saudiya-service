(function () {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
  }

  const contentEl = document.getElementById("content");
  const navEl = document.getElementById("bottom-nav");

  let state = {
    activeCategory: null, // null = home grid; otherwise category id
    activePackage: null,  // package id when viewing umra package detail
  };

  // ---------- Renderers ----------

  function renderHome() {
    contentEl.innerHTML = `
      <header class="home-header">
        <h1 class="brand">Saudiya Service</h1>
        <p class="tagline">Xizmatlardan birini tanlang</p>
      </header>
      <div class="home-grid">
        ${CATEGORIES.map(
          (c) => `
          <button class="home-card" data-action="open-category" data-id="${c.id}">
            <span class="home-card__title">${c.title}</span>
          </button>`
        ).join("")}
      </div>
    `;
    navEl.classList.add("hidden");
  }

  function renderCategory(categoryId) {
    switch (categoryId) {
      case "umra":
        if (state.activePackage) {
          renderUmraPackageDetail(state.activePackage);
        } else {
          renderUmraList();
        }
        break;
      case "visa":
        renderPlaceholder("Vizalar", "Tez orada — vizalar bo‘yicha ma’lumotlar.");
        break;
      case "hotels":
        renderPlaceholder("Mexmonxonalar", "Tez orada — mehmonxonalar ro‘yxati.");
        break;
      case "transfer":
        renderPlaceholder("Transferlar", "Tez orada — transfer xizmatlari.");
        break;
      case "contact":
        renderContact();
        break;
    }
    renderBottomNav();
  }

  function renderUmraList() {
    contentEl.innerHTML = `
      <header class="page-header">
        <h2>Umra paketlar</h2>
        <p>Sizga mos paketni tanlang</p>
      </header>
      <div class="package-list">
        ${UMRA_PACKAGES.map(
          (p) => `
          <button class="package-card" data-action="open-package" data-id="${p.id}">
            <span class="package-card__emoji">${p.emoji}</span>
            <span class="package-card__title">${p.title}</span>
          </button>`
        ).join("")}
      </div>
    `;
  }

  function renderUmraPackageDetail(packageId) {
    const pkg = UMRA_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) return renderUmraList();

    const body = pkg.lines
      .map((line) => (line === "" ? "<br/>" : `<p>${escapeHtml(line)}</p>`))
      .join("");

    contentEl.innerHTML = `
      <header class="page-header">
        <button class="back-btn" data-action="back-to-umra">← Orqaga</button>
        <h2>${pkg.title} ${pkg.emoji}</h2>
      </header>
      <article class="package-detail">
        ${body}
        <div class="package-detail__cta">
          <p>📅 Narxlar va mavjud sanalar bo‘yicha:</p>
          <a class="contact-btn" href="${CONTACT_URL}" target="_blank" rel="noopener">
            💬 ${CONTACT_LABEL}
          </a>
        </div>
      </article>
    `;
  }

  function renderPlaceholder(title, text) {
    contentEl.innerHTML = `
      <header class="page-header">
        <h2>${title}</h2>
      </header>
      <div class="placeholder">
        <p>${text}</p>
        <a class="contact-btn" href="${CONTACT_URL}" target="_blank" rel="noopener">
          💬 ${CONTACT_LABEL}
        </a>
      </div>
    `;
  }

  function renderContact() {
    contentEl.innerHTML = `
      <header class="page-header">
        <h2>Biz bilan bog‘laning</h2>
      </header>
      <div class="contact-block">
        <a class="contact-btn" href="${CONTACT_URL}" target="_blank" rel="noopener">
          💬 Telegram orqali yozish
        </a>
      </div>
    `;
  }

  function renderBottomNav() {
    navEl.classList.remove("hidden");
    navEl.innerHTML = CATEGORIES.map(
      (c) => `
        <button
          class="nav-btn ${c.id === state.activeCategory ? "is-active" : ""}"
          data-action="switch-category"
          data-id="${c.id}"
        >${c.short}</button>`
    ).join("");
  }

  // ---------- Event handling ----------

  document.addEventListener("click", (e) => {
    const target = e.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    const id = target.dataset.id;

    switch (action) {
      case "open-category":
        state.activeCategory = id;
        state.activePackage = null;
        renderCategory(id);
        break;
      case "switch-category":
        state.activeCategory = id;
        state.activePackage = null;
        renderCategory(id);
        break;
      case "open-package":
        state.activePackage = id;
        renderCategory(state.activeCategory);
        break;
      case "back-to-umra":
        state.activePackage = null;
        renderCategory("umra");
        break;
    }
  });

  // ---------- Utils ----------

  function escapeHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ---------- Init ----------

  renderHome();
})();
