(() => {
  const USER = "molnarroland";
  const API = "https://api.github.com";
  const HIDDEN = new Set([`${USER}.github.io`.toLowerCase()]);
  const HERO_MS = 4200;
  const PROJECT_MS = 3600;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const LANG_COLORS = {
    Swift: "#F05138", Kotlin: "#A97BFF", Go: "#00ADD8", TypeScript: "#3178C6",
    JavaScript: "#F1E05A", Python: "#3572A5", Java: "#B07219", "C#": "#178600",
    "C++": "#F34B7D", C: "#555555", Rust: "#DEA584", Ruby: "#701516", PHP: "#4F5D95",
    HTML: "#E34C26", CSS: "#663399", Shell: "#89E051", Dart: "#00B4AB", Vue: "#41B883",
  };
  const ICON = {
    home: '<svg viewBox="0 0 16 16"><path d="M6.906.664a1.749 1.749 0 0 1 2.187 0l5.25 4.2c.415.332.657.835.657 1.367v7.019A1.75 1.75 0 0 1 13.25 15h-3.5a.75.75 0 0 1-.75-.75V9H7v5.25a.75.75 0 0 1-.75.75h-3.5A1.75 1.75 0 0 1 1 13.25V6.23c0-.531.242-1.034.657-1.366l5.25-4.2Z"/></svg>',
    globe: '<svg viewBox="0 0 16 16"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM5.78 8.75a9.64 9.64 0 0 0 1.363 4.177c.255.426.542.832.857 1.215.245-.296.551-.705.857-1.215A9.64 9.64 0 0 0 10.22 8.75Zm4.44-1.5a9.64 9.64 0 0 0-1.363-4.177c-.307-.51-.612-.919-.857-1.215a9.927 9.927 0 0 0-.857 1.215A9.64 9.64 0 0 0 5.78 7.25Zm-5.944 1.5H1.543a6.507 6.507 0 0 0 4.666 5.5c-.123-.181-.24-.365-.352-.552-.715-1.192-1.437-2.874-1.581-4.948Zm-2.733-1.5h2.733c.144-2.074.866-3.756 1.58-4.948.12-.197.237-.381.353-.552a6.507 6.507 0 0 0-4.666 5.5Zm10.181 1.5c-.144 2.074-.866 3.756-1.58 4.948-.12.197-.237.381-.353.552a6.507 6.507 0 0 0 4.666-5.5Zm2.733-1.5a6.507 6.507 0 0 0-4.666-5.5c.123.181.24.365.353.552.714 1.192 1.436 2.874 1.58 4.948Z"/></svg>',
    repo: '<svg viewBox="0 0 16 16"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>',
  };

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const ago = (iso) => {
    const d = Math.floor((Date.now() - new Date(iso)) / 864e5);
    if (d < 1) return "today";
    if (d < 2) return "yesterday";
    if (d < 30) return `${d} days ago`;
    if (d < 365) return `${Math.floor(d / 30)} mo ago`;
    return `${Math.floor(d / 365)} yr ago`;
  };
  const norm = (u) => (u || "").replace(/\/+$/, "").toLowerCase();

  async function getJSON(url) {
    const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.json();
  }

  // Live API first, committed snapshot as fallback (rate limits / outages).
  async function loadGitHub() {
    try {
      const [profile, list] = await Promise.all([
        getJSON(`${API}/users/${USER}`),
        getJSON(`${API}/users/${USER}/repos?per_page=100&sort=pushed`),
      ]);
      return { profile, list, source: "Live data from the GitHub API" };
    } catch (err) {
      console.warn("Live GitHub API unavailable, using snapshot:", err);
      const [profile, list] = await Promise.all([getJSON("data/profile.json"), getJSON("data/repos.json")]);
      return { profile, list, source: "Cached GitHub snapshot" };
    }
  }

  /* ---------------- Carousel ----------------
     Slides travel sideways: the incoming slide enters from the side it is
     moving from while the outgoing one leaves the other way. A slide's markup
     is rendered the first time it is needed (plus the one after it), so the
     first paint stays light. Swipe left/right on touch screens. */
  class Carousel {
    constructor(el, slides, { interval, onChange, autoplay = true, render = shotHTML, start = 0 } = {}) {
      Object.assign(this, { el, slides, interval, onChange, render });
      this.i = -1;
      this.timer = null;
      this.paused = !autoplay;
      this.visible = true;
      el.classList.add("carousel");
      el.innerHTML = slides.map(() => '<div class="slide"></div>').join("");
      this.items = [...el.children];
      swipe(el, (dir) => this.step(dir));
      this.go(start);
    }
    ensure(i) {
      const item = this.items[i];
      if (!item.childElementCount) {
        item.innerHTML = this.render(this.slides[i]);
        fitDesks(item);
      }
      return item;
    }
    go(i, dir) {
      const n = this.slides.length;
      i = ((i % n) + n) % n;
      if (i !== this.i) {
        dir ??= i > this.i ? 1 : -1;
        const incoming = this.ensure(i);
        if (n > 1) this.ensure((i + 1) % n);
        const outgoing = this.items[this.i];
        // Park the incoming slide on its entry side without animating, then
        // let both slides transition to their new places.
        incoming.style.transition = "none";
        incoming.style.transform = outgoing ? `translateX(${dir * 100}%)` : "none";
        void incoming.offsetWidth;
        incoming.style.transition = "";
        incoming.style.transform = "";
        if (outgoing) {
          outgoing.classList.remove("on");
          outgoing.style.transform = `translateX(${-dir * 100}%)`;
        }
        incoming.classList.add("on");
        this.i = i;
        this.onChange?.(i, this.slides[i]);
      }
      this.schedule();
    }
    schedule() {
      clearTimeout(this.timer);
      if (this.paused || !this.visible || reduceMotion || this.slides.length < 2) return;
      this.timer = setTimeout(() => this.step(1), this.interval);
    }
    step(dir) { this.go(this.i + dir, dir); }
    next() { this.step(1); }
    prev() { this.step(-1); }
    setPaused(p) { this.paused = p; this.schedule(); }
    setVisible(v) { this.visible = v; this.schedule(); }
  }

  function swipe(el, cb) {
    let x0 = null;
    el.addEventListener("pointerdown", (e) => { x0 = e.clientX; });
    el.addEventListener("pointercancel", () => { x0 = null; });
    el.addEventListener("pointerup", (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) < 40) return;
      cb(dx < 0 ? 1 : -1);
      el.dataset.swiped = "1"; // swallow the click that follows a swipe
      setTimeout(() => delete el.dataset.swiped, 0);
    });
  }
  const onTap = (el, fn) => el.addEventListener("click", (e) => { if (!el.dataset.swiped) fn(e); });

  // Pause any carousel that is scrolled out of view or when the tab is hidden.
  const carousels = new Map();
  const viewObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => carousels.get(e.target)?.setVisible(e.isIntersecting));
  }, { threshold: 0.15 });
  function watch(el, carousel) { carousels.set(el, carousel); viewObserver.observe(el); }
  document.addEventListener("visibilitychange", () => {
    carousels.forEach((c, el) => c.setVisible(!document.hidden && isOnScreen(el)));
  });
  const isOnScreen = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };

  /* ---------------- Device frames ----------------
     window  — desktop app: macOS window chrome, 16:10 screenshots
     tv      — TV app: bezel and stand, 16:9 screenshots
     menubar — menu bar app: a desktop with a live HTML mock-up of the panel */
  const DESK_W = 540; // design width of the menubar scene; scaled to fit
  const deskObserver = new ResizeObserver((entries) => entries.forEach((e) => {
    e.target.style.setProperty("--k", e.contentRect.width / DESK_W);
  }));
  const fitDesks = (root) => root.querySelectorAll(".desk").forEach((d) => deskObserver.observe(d));

  function frame(p, inner, title = p.name) {
    if (p.frame === "tv") {
      return `<div class="tv"><div class="tv-bezel"><div class="tv-screen">${inner}</div></div><div class="tv-stand" aria-hidden="true"></div></div>`;
    }
    if (p.frame === "menubar") return `<div class="desk">${inner}</div>`;
    return `<div class="window"><div class="window-bar"><span class="lights"><i></i><i></i><i></i></span><span class="window-title">${esc(title)}</span></div><div class="screen">${inner}</div></div>`;
  }

  function shotHTML(s) {
    if (s.component) return COMPONENTS[s.component]?.() ?? "";
    return `<img src="${esc(s.src)}" alt="${esc(s.caption)}" draggable="false" decoding="async">`;
  }
  const isImage = (s) => !s.component;

  // Live HTML stand-ins for apps that are best shown as UI rather than a screenshot.
  // Ported from the hero of https://molnarroland.github.io/ClaudeProfileBar/
  const COMPONENTS = {
    "profile-panel": () => {
      const bar = (label, p, w, hot) => `
        <div class="bar">
          <div class="nums"><span class="pct p">${p[0]}%</span><span class="label">${label}</span><span class="pct w${hot ? " hot" : ""}">${w[0]}%</span></div>
          <div class="track"><div class="fill p" style="width:${p[0] / 2}%"></div><div class="fill w" style="width:${w[0] / 2}%"></div></div>
          <div class="resets"><span>${p[1]}</span><span>${w[1]}</span></div>
        </div>`;
      return `
      <div class="cpb desk-inner" role="img" aria-label="Claude Profile Bar's menu bar panel showing Personal and Work usage side by side">
        <div class="menubar">
          <span>Wi‑Fi</span>
          <span class="item"><svg><use href="#i-person"/></svg>42%</span>
          <span>Fri 9:41</span>
        </div>
        <div class="panel">
          <div class="p-head">
            <div class="side">
              <span class="pill personal active"><svg><use href="#i-person"/></svg>Personal<svg class="tick"><use href="#i-check"/></svg></span>
              <svg class="chev"><use href="#i-chevrons"/></svg>
            </div>
            <div class="side"><span class="pill work">Work<svg><use href="#i-briefcase"/></svg></span></div>
          </div>
          ${bar("SESSION", [42, "in 2 hours"], [7, "in 4 hours"])}
          ${bar("WEEK", [18, "in 3 days"], [81, "in 5 days"])}
          ${bar("WEEK, OPUS", [64, "in 3 days"], [97, "in 5 days"], true)}
          <div class="p-foot">
            <svg><use href="#i-gear"/></svg>
            <span class="seg"><span class="on">Both</span><span><svg><use href="#i-window"/></svg></span><span><svg><use href="#i-terminal"/></svg></span></span>
            <span class="right"><svg><use href="#i-refresh"/></svg><span class="quit">Quit</span></span>
          </div>
        </div>
        <div class="legend">
          <span><i class="dot" style="background:var(--personal)"></i>Personal fills left</span>
          <span><i class="dot" style="background:var(--work)"></i>Work fills right</span>
        </div>
      </div>`;
    },
  };

  /* ---------------- Rendering ---------------- */
  function pagesUrl(r) {
    if (!r.has_pages) return null;
    return r.name.toLowerCase() === `${USER}.github.io` ? `https://${USER}.github.io/` : `https://${USER}.github.io/${r.name}/`;
  }

  function linkButtons(r, accentClass = "btn-accent") {
    const pages = pagesUrl(r);
    const home = r.homepage && /^https?:\/\//.test(r.homepage) ? r.homepage : null;
    const out = [];
    if (home) {
      const samePages = pages && norm(pages) === norm(home);
      out.push(`<a class="btn ${accentClass}" href="${esc(home)}"${samePages ? ' title="Hosted on GitHub Pages"' : ""}>${ICON.home}Homepage</a>`);
    }
    if (pages && norm(pages) !== norm(home)) {
      out.push(`<a class="btn ${home ? "" : accentClass}" href="${esc(pages)}">${ICON.globe}GitHub Pages</a>`);
    }
    out.push(`<a class="btn" href="${esc(r.html_url)}">${ICON.repo}Source</a>`);
    return out.join("");
  }

  function chips(r, extra) {
    const c = [];
    if (r.language) c.push(`<span class="chip"><i class="dot" style="background:${LANG_COLORS[r.language] || "#8b949e"}"></i>${esc(r.language)}</span>`);
    if (extra) c.push(`<span class="chip">${esc(extra)}</span>`);
    c.push(`<span class="chip">★ ${r.stargazers_count}</span>`);
    if (r.forks_count) c.push(`<span class="chip">⑂ ${r.forks_count}</span>`);
    if (r.license?.spdx_id && r.license.spdx_id !== "NOASSERTION") c.push(`<span class="chip">${esc(r.license.spdx_id)}</span>`);
    c.push(`<span class="chip">Updated ${esc(ago(r.pushed_at))}</span>`);
    return c.join("");
  }

  function renderProfile(p, repos) {
    const name = p.name || p.login;
    $("name").textContent = name;
    $("nav-name").textContent = name;
    if (p.avatar_url) $("nav-avatar").src = `${p.avatar_url}&s=64`;
    const stars = repos.reduce((n, r) => n + r.stargazers_count, 0);
    const langs = new Set(repos.map((r) => r.language).filter(Boolean)).size;
    const live = repos.filter((r) => r.has_pages).length;
    const latest = repos.reduce((a, r) => (r.pushed_at > a ? r.pushed_at : a), "");
    const stats = [
      [repos.length, "projects"], [live, "live sites"], [langs, "languages"], [stars, "stars"],
      [latest ? ago(latest) : "–", "last push"],
    ];
    $("stats").innerHTML = stats.map(([v, l]) => `<div class="stat"><b data-count="${typeof v === "number" ? v : ""}">${esc(v)}</b><span>${l}</span></div>`).join("");
    countUp();
  }

  function countUp() {
    if (reduceMotion) return;
    document.querySelectorAll("[data-count]").forEach((el) => {
      const target = Number(el.dataset.count);
      if (!el.dataset.count || !target) return;
      const t0 = performance.now();
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / 1200);
        el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  function renderHero(projects) {
    // Interleave shots so consecutive slides come from different apps.
    const slides = [];
    const max = Math.max(...projects.map((p) => p.shots.length));
    for (let k = 0; k < max; k++) {
      projects.forEach((p) => { if (p.shots[k]) slides.push({ ...p.shots[k], project: p }); });
    }
    const stage = $("hero-stage");
    if (!slides.length) { stage.hidden = true; return; }

    stage.style.setProperty("--dur", `${HERO_MS}ms`);
    const bars = $("hero-bars");
    // One progress bar per project, active while that project is showing.
    bars.innerHTML = projects.map((p) => `<button style="--bar-color:${p.accent}" aria-label="Show ${esc(p.name)}"></button>`).join("");
    const barBtns = [...bars.children];
    const view = $("hero-carousel");

    let lastProject = null;
    const carousel = new Carousel(view, slides, {
      interval: HERO_MS,
      // Each slide is a whole device, so apps keep their own frame as they pass by.
      render: (s) => `<div class="scene" style="--pa:${s.project.accent}">${frame(s.project, shotHTML(s), `${s.project.name} — ${s.caption}`)}</div>`,
      onChange: (i, s) => {
        const p = s.project;
        stage.style.setProperty("--stage-accent", p.accent);
        view.classList.toggle("zoomable", isImage(s));
        const pi = projects.indexOf(p);
        barBtns.forEach((b, k) => {
          b.classList.remove("active");
          b.classList.toggle("done", k < pi);
        });
        void bars.offsetWidth;
        barBtns[pi].classList.add("active");
        if (p !== lastProject) {
          $("hero-caption").innerHTML = `${p.icon ? `<img src="${esc(p.icon)}" alt="">` : ""}<div><div class="t">${esc(p.name)}</div><div class="s">${esc(p.tagline)}</div></div>`;
          lastProject = p;
        }
      },
    });
    barBtns.forEach((b, k) => b.addEventListener("click", () => {
      carousel.go(slides.findIndex((s) => s.project === projects[k]));
    }));
    const images = slides.filter(isImage);
    onTap(view, () => {
      const s = slides[carousel.i];
      if (isImage(s)) openLightbox(images, images.indexOf(s));
    });
    stage.addEventListener("mouseenter", () => { carousel.setPaused(true); stage.classList.add("paused"); });
    stage.addEventListener("mouseleave", () => { carousel.setPaused(false); stage.classList.remove("paused"); });
    watch(view, carousel);
    tilt($("hero-viewport"), stage);
  }

  function renderProject(p, r, index) {
    const sec = document.createElement("section");
    sec.className = "project";
    sec.id = p.name;
    sec.style.setProperty("--pa", p.accent);
    sec.style.setProperty("--dur", `${PROJECT_MS}ms`);
    const iconHtml = p.icon
      ? `<img class="p-icon" src="${esc(p.icon)}" alt="" loading="lazy">`
      : `<div class="p-icon fallback">${esc(p.name[0])}</div>`;
    const thumbs = p.shots.length > 1
      ? `<div class="p-thumbs ${esc(p.frame || "window")}">${p.shots.map((s) => `<button aria-label="${esc(s.caption)}">${isImage(s) ? `<img src="${esc(s.src)}" alt="" loading="lazy">` : esc(s.caption)}</button>`).join("")}</div>`
      : "";
    sec.innerHTML = `
      <div class="p-media reveal">
        <div class="device">${frame(p, '<div class="p-carousel"></div>')}</div>
        ${thumbs}
      </div>
      <div class="p-copy reveal">
        <div class="p-head">${iconHtml}<div><div class="p-kicker">${String(index + 1).padStart(2, "0")} · ${esc(p.platform || r.language || "Project")}</div><h2 class="p-name">${esc(r.name)}</h2></div></div>
        <p class="p-tagline">${esc(p.tagline || "")}</p>
        <p class="p-desc">${esc(r.description || "")}</p>
        <div class="chips">${chips(r)}</div>
        <div class="p-links">${linkButtons(r)}</div>
      </div>`;
    $("projects").appendChild(sec);

    const media = sec.querySelector(".p-media");
    if (!p.shots.length) { media.remove(); return; }
    const view = sec.querySelector(".p-carousel");
    const titleEl = sec.querySelector(".window-title");
    const thumbBtns = [...sec.querySelectorAll(".p-thumbs button")];
    fitDesks(sec);
    const carousel = new Carousel(view, p.shots, {
      interval: PROJECT_MS,
      onChange: (i, s) => {
        if (titleEl) titleEl.textContent = `${p.name} — ${s.caption}`;
        view.classList.toggle("zoomable", isImage(s));
        const on = thumbBtns[i];
        if (!on) return;
        thumbBtns.forEach((t) => t.classList.remove("on"));
        void on.offsetWidth; // restart the progress underline
        on.classList.add("on");
      },
    });
    thumbBtns.forEach((t, k) => t.addEventListener("click", () => carousel.go(k)));
    const images = p.shots.filter(isImage).map((s) => ({ ...s, project: p }));
    onTap(view, () => {
      const k = p.shots.filter(isImage).indexOf(p.shots[carousel.i]);
      if (k >= 0) openLightbox(images, k);
    });
    media.addEventListener("mouseenter", () => { carousel.setPaused(true); media.classList.add("paused"); });
    media.addEventListener("mouseleave", () => { carousel.setPaused(false); media.classList.remove("paused"); });
    watch(view, carousel);
    tilt(sec.querySelector(".device"), media, 5);
  }

  function renderMore(repos) {
    if (!repos.length) return;
    $("more").hidden = false;
    $("more-grid").innerHTML = repos.map((r) => `
      <article class="mini reveal">
        <h3>${esc(r.name)}</h3>
        <p>${esc(r.description || "No description yet.")}</p>
        <div class="chips">${chips(r)}</div>
        <div class="p-links">${linkButtons(r)}</div>
      </article>`).join("");
    document.querySelectorAll(".mini").forEach((card) => card.addEventListener("pointermove", (e) => {
      const b = card.getBoundingClientRect();
      card.style.setProperty("--x", `${e.clientX - b.left}px`);
      card.style.setProperty("--y", `${e.clientY - b.top}px`);
    }));
  }

  function renderNavAndMarquee(projects) {
    $("nav-links").innerHTML = projects.map((p) => `<a href="#${esc(p.name)}">${esc(p.name)}</a>`).join("");
    const items = projects.map((p) => `<span style="--c:${p.accent}">${esc(p.name)} — ${esc(p.tagline)}</span>`).join("");
    $("marquee").innerHTML = items + items; // doubled for a seamless loop

    const links = [...$("nav-links").children];
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${e.target.id}`));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    document.querySelectorAll(".project").forEach((s) => spy.observe(s));
  }

  /* ---------------- Effects ---------------- */
  function tilt(el, area, max = 7) {
    if (reduceMotion || matchMedia("(hover: none)").matches) return;
    area.addEventListener("pointermove", (e) => {
      const b = area.getBoundingClientRect();
      const x = (e.clientX - b.left) / b.width - 0.5;
      const y = (e.clientY - b.top) / b.height - 0.5;
      el.style.transform = `rotateY(${x * max}deg) rotateX(${-y * max}deg) translateZ(0)`;
    });
    area.addEventListener("pointerleave", () => { el.style.transform = ""; });
  }

  function reveals() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    document.querySelectorAll(".reveal:not(.in)").forEach((el) => io.observe(el));
  }

  addEventListener("pointermove", (e) => {
    document.documentElement.style.setProperty("--mx", `${e.clientX}px`);
    document.documentElement.style.setProperty("--my", `${e.clientY}px`);
  }, { passive: true });

  /* ---------------- Lightbox ---------------- */
  let lb = null;
  function openLightbox(slides, start) {
    const box = $("lightbox");
    box.hidden = false;
    document.body.style.overflow = "hidden";
    lb = new Carousel($("lb-carousel"), slides, {
      autoplay: false,
      start,
      onChange: (i, s) => { $("lb-caption").textContent = `${s.project?.name ?? ""} — ${s.caption}  ·  ${i + 1} / ${slides.length}`; },
    });
    $("lb-close").focus();
  }
  function closeLightbox() {
    $("lightbox").hidden = true;
    document.body.style.overflow = "";
    lb = null;
  }
  $("lb-close").addEventListener("click", closeLightbox);
  $("lb-prev").addEventListener("click", () => lb?.prev());
  $("lb-next").addEventListener("click", () => lb?.next());
  $("lightbox").addEventListener("click", (e) => { if (e.target.id === "lightbox") closeLightbox(); });
  addEventListener("keydown", (e) => {
    if (!lb) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowRight") lb.next();
    if (e.key === "ArrowLeft") lb.prev();
  });

  /* ---------------- Boot ---------------- */
  $("year").textContent = new Date().getFullYear();
  requestAnimationFrame(() => document.querySelectorAll(".hero .reveal").forEach((el) => el.classList.add("in")));

  Promise.all([loadGitHub(), getJSON("data/showcase.json").catch(() => ({ projects: [] }))])
    .then(([{ profile, list, source }, showcase]) => {
      const repos = list.filter((r) => !r.fork && !HIDDEN.has(r.name.toLowerCase()));
      const byName = new Map(repos.map((r) => [r.name.toLowerCase(), r]));
      const projects = showcase.projects
        .filter((p) => byName.has(p.name.toLowerCase()))
        // "component:<name>" renders a live HTML mock-up instead of a screenshot.
        .map((p) => ({ ...p, shots: (p.shots || []).map(([src, caption]) =>
          src.startsWith("component:") ? { component: src.slice(10), caption } : { src, caption }) }));
      const featured = new Set(projects.map((p) => p.name.toLowerCase()));

      renderProfile(profile, repos);
      renderHero(projects.filter((p) => p.shots.length));
      projects.forEach((p, i) => renderProject(p, byName.get(p.name.toLowerCase()), i));
      renderMore(repos.filter((r) => !featured.has(r.name.toLowerCase())));
      renderNavAndMarquee(projects);
      $("source").textContent = source;
      reveals();
    })
    .catch((err) => {
      console.error(err);
      $("projects").innerHTML = `<p style="text-align:center;padding:80px 0">Couldn't load projects. <a href="https://github.com/${USER}?tab=repositories">View them on GitHub</a>.</p>`;
    });
})();
