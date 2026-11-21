/* Shared building blocks for every page: the sliding carousel, device
   frames, the hero stage, the lightbox and the scroll/tilt effects.
   Exposed as window.SC; each page script (app.js, wip.js) builds on it. */
(() => {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  async function getJSON(url, headers) {
    const res = await fetch(url, headers ? { headers } : undefined);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.json();
  }

  const ICON = {
    home: '<svg viewBox="0 0 16 16"><path d="M6.906.664a1.749 1.749 0 0 1 2.187 0l5.25 4.2c.415.332.657.835.657 1.367v7.019A1.75 1.75 0 0 1 13.25 15h-3.5a.75.75 0 0 1-.75-.75V9H7v5.25a.75.75 0 0 1-.75.75h-3.5A1.75 1.75 0 0 1 1 13.25V6.23c0-.531.242-1.034.657-1.366l5.25-4.2Z"/></svg>',
    globe: '<svg viewBox="0 0 16 16"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM5.78 8.75a9.64 9.64 0 0 0 1.363 4.177c.255.426.542.832.857 1.215.245-.296.551-.705.857-1.215A9.64 9.64 0 0 0 10.22 8.75Zm4.44-1.5a9.64 9.64 0 0 0-1.363-4.177c-.307-.51-.612-.919-.857-1.215a9.927 9.927 0 0 0-.857 1.215A9.64 9.64 0 0 0 5.78 7.25Zm-5.944 1.5H1.543a6.507 6.507 0 0 0 4.666 5.5c-.123-.181-.24-.365-.352-.552-.715-1.192-1.437-2.874-1.581-4.948Zm-2.733-1.5h2.733c.144-2.074.866-3.756 1.58-4.948.12-.197.237-.381.353-.552a6.507 6.507 0 0 0-4.666 5.5Zm10.181 1.5c-.144 2.074-.866 3.756-1.58 4.948-.12.197-.237.381-.353.552a6.507 6.507 0 0 0 4.666-5.5Zm2.733-1.5a6.507 6.507 0 0 0-4.666-5.5c.123.181.24.365.353.552.714 1.192 1.436 2.874 1.58 4.948Z"/></svg>',
    repo: '<svg viewBox="0 0 16 16"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>',
    arrow: '<svg viewBox="0 0 16 16"><path d="M8.22 2.97a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l2.97-2.97H3.75a.75.75 0 0 1 0-1.5h7.44L8.22 4.03a.75.75 0 0 1 0-1.06Z"/></svg>',
  };

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
  const isOnScreen = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };
  document.addEventListener("visibilitychange", () => {
    carousels.forEach((c, el) => c.setVisible(!document.hidden && isOnScreen(el)));
  });

  /* ---------------- Device frames ----------------
     window  — desktop or web app: macOS window chrome, 16:10 screenshots
     tv      — TV app: bezel and stand, 16:9 screenshots
     menubar — menu bar app: a desktop with a live HTML mock-up of the panel
     android / ios — phone apps: a handset around a portrait screenshot */
  const DESK_W = 540; // design width of the menubar scene; scaled to fit
  const deskObserver = new ResizeObserver((entries) => entries.forEach((e) => {
    e.target.style.setProperty("--k", e.contentRect.width / DESK_W);
  }));
  const fitDesks = (root) => root.querySelectorAll(".desk").forEach((d) => deskObserver.observe(d));
  const PHONES = new Set(["android", "ios"]);
  const isPhone = (kind) => PHONES.has(kind);

  function frame(kind, inner, title = "") {
    if (kind === "tv") {
      return `<div class="tv"><div class="tv-bezel"><div class="tv-screen">${inner}</div></div><div class="tv-stand" aria-hidden="true"></div></div>`;
    }
    if (kind === "menubar") return `<div class="desk">${inner}</div>`;
    if (isPhone(kind)) {
      return `<div class="phone ${kind}"><div class="phone-screen">${inner}</div><i class="cam" aria-hidden="true"></i></div>`;
    }
    return `<div class="window"><div class="window-bar"><span class="lights"><i></i><i></i><i></i></span><span class="window-title">${esc(title)}</span></div><div class="screen">${inner}</div></div>`;
  }

  // Live HTML stand-ins for apps that are best shown as UI rather than a
  // screenshot. Pages register them by name; a shot "component:<name>" uses one.
  const COMPONENTS = {};
  function shotHTML(s) {
    if (s.component) return COMPONENTS[s.component]?.() ?? "";
    return `<img src="${esc(s.src)}" alt="${esc(s.caption)}" draggable="false" decoding="async">`;
  }
  const isImage = (s) => !s.component;
  // [src, caption] pairs from the JSON files → slide objects.
  const toShots = (list) => (list || []).map(([src, caption]) =>
    src.startsWith("component:") ? { component: src.slice(10), caption } : { src, caption });

  /* ---------------- Hero stage ----------------
     Slides from every project, interleaved so consecutive slides come from
     different apps. Each slide carries its own device frame. */
  function renderHero(projects, interval) {
    const slides = [];
    const max = Math.max(0, ...projects.map((p) => p.shots.length));
    for (let k = 0; k < max; k++) {
      projects.forEach((p) => { if (p.shots[k]) slides.push({ ...p.shots[k], project: p }); });
    }
    const stage = $("hero-stage");
    if (!slides.length) { stage.hidden = true; return; }

    stage.style.setProperty("--dur", `${interval}ms`);
    const bars = $("hero-bars");
    // One progress bar per project, active while that project is showing.
    bars.innerHTML = projects.map((p) => `<button style="--bar-color:${p.accent}" aria-label="Show ${esc(p.title || p.name)}"></button>`).join("");
    const barBtns = [...bars.children];
    const view = $("hero-carousel");

    let lastProject = null;
    const carousel = new Carousel(view, slides, {
      interval,
      // Each slide is a whole device, so apps keep their own frame as they pass by.
      render: (s) => {
        const kind = s.frame || s.project.frame;
        return `<div class="scene${isPhone(kind) ? " phone-scene" : ""}" style="--pa:${s.project.accent}">${frame(kind, shotHTML(s), `${s.project.title || s.project.name} — ${s.caption}`)}</div>`;
      },
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
          $("hero-caption").innerHTML = `${p.icon ? `<img src="${esc(p.icon)}" alt=""${p.iconLight ? ' class="on-light"' : ""}>` : ""}<div><div class="t">${esc(p.title || p.name)}</div><div class="s">${esc(p.tagline)}</div></div>`;
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

  /* ---------------- Device with its own carousel ----------------
     Used by the project sections: one device, its screenshots sliding by,
     optional thumbnails underneath. Returns the wrapper element. */
  function deviceCarousel(host, { kind, shots, title, project, interval, thumbs = true }) {
    const wrap = document.createElement("div");
    wrap.className = "device-wrap";
    const thumbHTML = thumbs && shots.length > 1
      ? `<div class="p-thumbs ${esc(kind || "window")}">${shots.map((s) => `<button aria-label="${esc(s.caption)}">${isImage(s) ? `<img src="${esc(s.src)}" alt="" loading="lazy">` : esc(s.caption)}</button>`).join("")}</div>`
      : "";
    wrap.innerHTML = `<div class="device">${frame(kind, '<div class="p-carousel"></div>', title)}</div>${thumbHTML}`;
    host.appendChild(wrap);

    const view = wrap.querySelector(".p-carousel");
    const titleEl = wrap.querySelector(".window-title");
    const thumbBtns = [...wrap.querySelectorAll(".p-thumbs button")];
    fitDesks(wrap);
    const carousel = new Carousel(view, shots, {
      interval,
      onChange: (i, s) => {
        if (titleEl) titleEl.textContent = `${title} — ${s.caption}`;
        view.classList.toggle("zoomable", isImage(s));
        wrap.dispatchEvent(new CustomEvent("slide", { detail: { i, s } }));
        const on = thumbBtns[i];
        if (!on) return;
        thumbBtns.forEach((t) => t.classList.remove("on"));
        void on.offsetWidth; // restart the progress underline
        on.classList.add("on");
      },
    });
    thumbBtns.forEach((t, k) => t.addEventListener("click", () => carousel.go(k)));
    const images = shots.filter(isImage).map((s) => ({ ...s, project }));
    onTap(view, () => {
      const k = shots.filter(isImage).indexOf(shots[carousel.i]);
      if (k >= 0) openLightbox(images, k);
    });
    wrap.addEventListener("mouseenter", () => { carousel.setPaused(true); wrap.classList.add("paused"); });
    wrap.addEventListener("mouseleave", () => { carousel.setPaused(false); wrap.classList.remove("paused"); });
    watch(view, carousel);
    return { wrap, carousel };
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

  // Soft highlight that follows the pointer across cards.
  function glowCards(selector) {
    document.querySelectorAll(selector).forEach((card) => card.addEventListener("pointermove", (e) => {
      const b = card.getBoundingClientRect();
      card.style.setProperty("--x", `${e.clientX - b.left}px`);
      card.style.setProperty("--y", `${e.clientY - b.top}px`);
    }));
  }

  // Highlight the nav link of the section in view.
  function scrollSpy(sections) {
    const links = [...document.querySelectorAll("#nav-links a")];
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${e.target.id}`));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    document.querySelectorAll(sections).forEach((s) => spy.observe(s));
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
      onChange: (i, s) => {
        const name = s.project?.title || s.project?.name || "";
        $("lb-caption").textContent = `${name} — ${s.caption}  ·  ${i + 1} / ${slides.length}`;
      },
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

  /* ---------------- Page boot ---------------- */
  if ($("year")) $("year").textContent = new Date().getFullYear();
  requestAnimationFrame(() => document.querySelectorAll(".hero .reveal").forEach((el) => el.classList.add("in")));

  window.SC = {
    reduceMotion, $, esc, getJSON, ICON, COMPONENTS, Carousel, swipe, onTap, watch, fitDesks,
    frame, isPhone, shotHTML, isImage, toShots, renderHero, deviceCarousel,
    tilt, reveals, glowCards, scrollSpy, countUp, openLightbox,
  };
})();
