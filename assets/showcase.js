/* Showcase layout (index.html). Every app — published, in progress and the
   UI library — is one item in the dock. The selected item's screenshots
   fill a 3D cover-flow stage; its details sit in the panel on the right.
   Reads the same data as the other pages: data/*.json plus the live GitHub
   API with the committed snapshot as fallback. */
(() => {
  const USER = "molnarroland";
  const API = "https://api.github.com";
  const GH = { Accept: "application/vnd.github+json" };
  const SHOT_MS = 5000;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const getJSON = async (url, headers) => {
    const res = await fetch(url, headers ? { headers } : undefined);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.json();
  };
  const ago = (iso) => {
    const d = Math.floor((Date.now() - new Date(iso)) / 864e5);
    if (d < 1) return "today";
    if (d < 2) return "yesterday";
    if (d < 30) return `${d} days ago`;
    if (d < 365) return `${Math.floor(d / 30)} mo ago`;
    return `${Math.floor(d / 365)} yr ago`;
  };
  const norm = (u) => (u || "").replace(/\/+$/, "").toLowerCase();
  const host = (u) => { try { return new URL(u).host; } catch { return u; } };

  const LANG_COLORS = {
    Swift: "#F05138", Kotlin: "#A97BFF", Go: "#00ADD8", TypeScript: "#3178C6",
    JavaScript: "#F1E05A", Python: "#3572A5", Java: "#B07219", "C#": "#178600",
    "C++": "#F34B7D", Rust: "#DEA584", HTML: "#E34C26", CSS: "#663399", Dart: "#00B4AB",
  };
  const ICON = {
    home: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 7 8 2.5 13.5 7v6.5h-3.5V10H6v3.5H2.5Z"/></svg>',
    globe: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2"/><path d="M1.8 8h12.4M8 1.8c1.8 1.8 2.6 3.9 2.6 6.2S9.8 12.4 8 14.2C6.2 12.4 5.4 10.3 5.4 8S6.2 3.6 8 1.8Z"/></svg>',
    code: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5.5 4.5-3.5 3.5 3.5 3.5M10.5 4.5 14 8l-3.5 3.5"/></svg>',
    arrow: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>',
  };
  const GROUPS = [["published", "Published"], ["live", "Live"], ["wip", "In progress"], ["library", "Library"], ["more", "More on GitHub"]];
  const GROUP_LABEL = Object.fromEntries(GROUPS);

  /* ---------------- Theme ---------------- */
  const media = matchMedia("(prefers-color-scheme: dark)");
  const root = document.documentElement;
  const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : media.matches);
  function applyTheme() {
    const dark = isDark();
    document.querySelectorAll("[data-theme-choice]").forEach((b) =>
      b.setAttribute("aria-checked", String(b.dataset.themeChoice === (root.dataset.theme || "system"))));
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      m.dataset.content ??= m.content;
      m.content = root.dataset.theme ? (dark ? "#0b0c10" : "#f4f4f1") : m.dataset.content;
    });
    // Screenshots that exist in a light and a dark version follow the theme.
    document.querySelectorAll("img[data-k]").forEach((img) => {
      if (!img.getAttribute("src")) return;
      const s = current()?.shots[+img.dataset.k];
      if (s) img.src = srcOf(s);
    });
  }
  function setTheme(v) {
    if (v === "system") delete root.dataset.theme; else root.dataset.theme = v;
    try { v === "system" ? localStorage.removeItem("theme") : localStorage.setItem("theme", v); } catch {}
    applyTheme();
  }
  document.querySelectorAll("[data-theme-choice]").forEach((b) => b.addEventListener("click", () => setTheme(b.dataset.themeChoice)));
  media.addEventListener("change", applyTheme);

  /* ---------------- Shots ----------------
     A shot is { light, dark, caption, frame, html?, sub? }. Light/dark pairs
     in a list (name.ext + name-dark.ext, name-day.ext + name-night.ext) are
     merged into one shot that follows the theme. */
  const srcOf = (s) => (isDark() ? s.dark : s.light);
  function mergePairs(list, extra = {}) {
    const srcs = list.map(([s]) => s);
    const used = new Set();
    const out = [];
    for (const [src, cap] of list) {
      if (used.has(src)) continue;
      const has = (s) => s !== src && srcs.includes(s);
      const light = [src.replace(/-dark(\.\w+)$/, "$1"), src.replace(/-night(\.\w+)$/, "-day$1")].find(has) || src;
      const dark = [src.replace(/(\.\w+)$/, "-dark$1"), src.replace(/-day(\.\w+)$/, "-night$1")].find(has) || src;
      used.add(light).add(dark);
      out.push({ light, dark, caption: cap.replace(/\s*·\s*(light|dark|night|day)$/i, ""), ...extra });
    }
    return out;
  }
  const FRAME = { window: "window", tv: "tv", menubar: "desk", android: "phone", ios: "phone" };

  /* ---------------- Data → items ---------------- */
  async function loadGitHub() {
    try {
      const [profile, list] = await Promise.all([
        getJSON(`${API}/users/${USER}`, GH),
        getJSON(`${API}/users/${USER}/repos?per_page=100&sort=pushed`, GH),
      ]);
      return { profile, list };
    } catch (err) {
      console.warn("Live GitHub API unavailable, using snapshot:", err);
      const [profile, list] = await Promise.all([getJSON("data/profile.json"), getJSON("data/repos.json")]);
      return { profile, list };
    }
  }

  const DUBAI_SHOTS = [
    ["fs-dashboard", "FanSUB · Dashboard"], ["fs-assign", "FanSUB · Assign lines"], ["fs-generate", "FanSUB · Generate voices"],
    ["fs-voice", "FanSUB · Voice panel"], ["fs-takes", "FanSUB · Takes inbox"], ["fs-theatre", "FanSUB · Theatre"],
    ["web-booth", "Recording booth in the browser"], ["gd-projects", "GameDUB · Projects"], ["gd-gamefiles", "GameDUB · Game files"],
    ["gd-lines", "GameDUB · Lines"], ["gd-script", "GameDUB · Script"], ["gd-timing", "GameDUB · Timing"],
  ].map(([f, caption]) => ({ dark: `dubai/img/${f}.webp`, light: `dubai/img/light/${f}.webp`, caption, frame: "window", title: caption.split(" · ")[0] }));

  function buildItems({ list }, showcase, mindheim, wip) {
    const repos = list.filter((r) => !r.fork && r.name.toLowerCase() !== `${USER}.github.io`);
    const byName = new Map(repos.map((r) => [r.name.toLowerCase(), r]));
    const items = [];

    for (const p of showcase.projects || []) {
      const r = byName.get(p.name.toLowerCase());
      if (!r) continue;
      const frame = FRAME[p.frame] || "window";
      const real = p.shots.filter(([s]) => !s.startsWith("component:"));
      const shots = real.length
        ? mergePairs(real, { frame, title: r.name })
        : [{ caption: "Menu bar panel", frame: "desk", html: profilePanelMock() }];
      items.push({ id: p.name, name: r.name, group: "published", kind: "published", icon: p.icon, accent: p.accent, platform: p.platform, tagline: p.tagline, repo: r, shots });
    }

    if (mindheim) {
      const m = mindheim;
      const shots = [{ light: m.landing[0], dark: m.landing[0], caption: "mindheim.app", frame: "window", title: "mindheim.app" }];
      m.apps.forEach((a) => (a.shots || []).forEach(([src, cap]) =>
        shots.push({ light: src, dark: src, caption: `${a.title} · ${cap}`, frame: "window", title: host(a.url), sub: a.name })));
      items.push({ id: "Mindheim", name: "Mindheim", group: "live", kind: "mindheim", icon: m.logo, boxed: true, accent: "#8b5cf6", platform: m.card.kicker, tagline: m.card.tagline, data: m, shots });
    }

    items.push({
      id: "DubAI", name: "DubAI", group: "wip", kind: "dubai", icon: "assets/shots/DubAI/fansub.svg", accent: "#f2a93b",
      platform: "2 macOS apps · local AI", tagline: "Your language deserves a dub too.", shots: DUBAI_SHOTS,
    });

    for (const p of wip?.projects || []) {
      const multi = p.devices.length > 1;
      const shots = p.devices.flatMap((d) => mergePairs(d.shots, { frame: FRAME[d.frame] || "window", title: p.title })
        .map((s) => (multi && d.label ? { ...s, caption: `${d.label} · ${s.caption}` } : s)));
      items.push({ id: p.name, name: p.title, group: p.status === "live" ? "live" : "wip", kind: "wip", icon: p.icon, accent: p.accent, platform: p.platform, tagline: p.tagline, data: p, shots });
    }

    const lib = showcase.library;
    if (lib) {
      const [img, cap] = lib.image;
      items.push({ id: "spartan-native", name: lib.name, group: "library", kind: "library", icon: lib.logo, accent: "#8b7bff", platform: lib.kicker, tagline: lib.tagline, data: lib,
        shots: [{ light: img, dark: img, caption: cap, frame: "plain" }] });
    }

    const featured = new Set(items.map((i) => i.id.toLowerCase()));
    repos.filter((r) => !featured.has(r.name.toLowerCase())).forEach((r) => items.push({
      id: r.name, name: r.name, group: "more", kind: "published", accent: LANG_COLORS[r.language] || "#8b949e",
      platform: r.language || "Repository", tagline: r.description || "", repo: r,
      shots: [{ caption: r.name, frame: "card", html: esc(r.name) }],
    }));

    // Every item's index within its own shots, for portrait detection.
    items.forEach((it) => { it.portrait = it.shots.every((s) => s.frame === "phone"); });
    // Same order as the dock, so ↑ ↓ and the tour move left to right along it.
    const rank = (it) => GROUPS.findIndex(([g]) => g === it.group);
    return items.sort((a, b) => rank(a) - rank(b));
  }

  function profilePanelMock() {
    const row = (label, p, w, hot) => `
      <div class="mock-row"><div class="n"><span>${p}%</span><span>${label}</span><span>${w}%</span></div>
      <div class="mock-track"><i class="p" style="width:${p / 2}%"></i><i class="w${hot ? " hot" : ""}" style="width:${w / 2}%"></i></div></div>`;
    return `<div class="mock" role="img" aria-label="Claude Profile Bar's menu bar panel showing Personal and Work usage side by side">
      <div class="mock-bar"><span>Wi‑Fi</span><span>42%</span><span>Fri 9:41</span></div>
      <div class="mock-panel"><div class="mock-head"><span class="mock-pill p">Personal ✓</span><span class="mock-pill w">Work</span></div>
        ${row("SESSION", 42, 7)}${row("WEEK", 18, 81)}${row("WEEK, OPUS", 64, 97, true)}</div></div>`;
  }

  /* ---------------- State ---------------- */
  const S = { items: [], i: -1, k: 0, playing: !reduceMotion, hover: false, timer: null, token: 0 };
  const current = () => S.items[S.i];
  const app = $("app"), track = $("track"), tilt = $("tilt");

  /* ---------------- Dock ---------------- */
  function renderDock() {
    const groups = GROUPS.map(([g, label]) => [label, S.items.map((it, idx) => [it, idx]).filter(([it]) => it.group === g)]).filter(([, l]) => l.length);
    $("dock").innerHTML = groups.map(([label, list], gi) => `
      ${gi ? '<span class="dsep" aria-hidden="true"></span>' : ""}
      <div class="group" role="group" aria-label="${esc(label)}">
        <span class="g-label" aria-hidden="true">${esc(label)}</span>
        <div class="g-items">${list.map(([it, idx]) => `
          <button type="button" class="d-btn" data-idx="${idx}" aria-label="${esc(it.name)} (${esc(label)})">
            ${it.icon ? `<img src="${esc(it.icon)}" alt=""${it.boxed ? ' class="boxed"' : ""}>` : `<span class="ph" style="--c:${esc(it.accent)}">${esc(it.name[0])}</span>`}
            <span class="tip" aria-hidden="true">${esc(it.name)}</span><i class="ind" aria-hidden="true"></i>
          </button>`).join("")}</div>
      </div>`).join("");
  }
  $("dock").addEventListener("click", (e) => {
    const b = e.target.closest(".d-btn");
    if (b) showItem(+b.dataset.idx);
  });

  /* ---------------- Stage ---------------- */
  function frameHTML(s, k, it) {
    const img = `<img data-k="${k}" alt="${esc(`${it.name}: ${s.caption}`)}" decoding="async" draggable="false">`;
    switch (s.frame) {
      case "tv": return `<div class="frame f-tv">${img}</div>`;
      case "phone": return `<div class="frame f-phone">${img}</div>`;
      case "desk": return `<div class="frame f-desk">${s.html}</div>`;
      case "card": return `<div class="frame f-card">${s.html}</div>`;
      case "plain": return `<div class="frame f-plain">${img}</div>`;
      default: return `<div class="frame f-window"><div class="wbar"><i></i><i></i><i></i><span>${esc(s.title || it.name)}</span></div>${img}</div>`;
    }
  }
  function buildSlides() {
    const it = current();
    track.innerHTML = it.shots.map((s, k) => `<div class="slide" data-k="${k}">${frameHTML(s, k, it)}</div>`).join("");
    $("dots").innerHTML = it.shots.length > 1 ? it.shots.map((s, k) =>
      `<button type="button" data-k="${k}" aria-label="Screenshot ${k + 1}: ${esc(s.caption)}"></button>`).join("") : "";
  }
  // Cover flow: the current shot faces you, its neighbours turn away and
  // step back into the scene.
  function layout() {
    const it = current();
    const step = it.portrait ? 17 : 30; // cqw
    [...track.children].forEach((el, k) => {
      const o = k - S.k, a = Math.abs(o), s = Math.sign(o);
      const x = o === 0 ? 0 : s * (step + (a - 1) * step * 0.5);
      const z = -a * 240;
      const ry = -s * Math.min(a, 1) * 44;
      el.style.transform = `translate(-50%, -50%) translateX(${x}cqw) translateZ(${z}px) rotateY(${ry}deg)`;
      el.style.opacity = a > 2 ? 0 : a === 2 ? 0.5 : 1;
      el.style.zIndex = 20 - a;
      el.style.pointerEvents = a > 2 ? "none" : "";
      el.classList.toggle("is-center", o === 0);
      el.setAttribute("aria-hidden", String(o !== 0));
      // Load images only when they come near the front.
      const img = el.querySelector("img");
      if (img && a <= 2 && !img.getAttribute("src")) img.src = srcOf(it.shots[k]);
    });
  }

  async function showItem(idx, k = 0) {
    const n = S.items.length;
    idx = ((idx % n) + n) % n;
    if (idx === S.i) return go(k);
    const dir = S.i < 0 ? 0 : idx > S.i ? 1 : -1;
    const token = ++S.token;
    let out;
    if (S.i >= 0 && !reduceMotion) {
      out = track.animate(
        [{ transform: "none", opacity: 1 }, { transform: `translateX(${-dir * 16}%) rotateY(${dir * 30}deg) translateZ(-420px)`, opacity: 0 }],
        { duration: 320, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" });
      await out.finished.catch(() => {});
      if (token !== S.token) return;
    }
    S.i = idx;
    S.k = Math.min(k, current().shots.length - 1);
    const it = current();
    app.style.setProperty("--accent", it.accent || "#7aa2ff");
    buildSlides();
    track.classList.add("no-anim");
    layout();
    void track.offsetWidth;
    track.classList.remove("no-anim");
    out?.cancel();
    if (!reduceMotion && dir !== 0) {
      track.animate(
        [{ transform: `translateX(${dir * 16}%) rotateY(${-dir * 30}deg) translateZ(-420px)`, opacity: 0 }, { transform: "none", opacity: 1 }],
        { duration: 620, easing: "cubic-bezier(.2,.8,.2,1)" });
    }
    document.querySelectorAll(".d-btn").forEach((b) => b.setAttribute("aria-current", String(+b.dataset.idx === idx)));
    document.querySelector(`.d-btn[data-idx="${idx}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
    renderDetails(it);
    updateUI();
    schedule();
  }

  function go(k) {
    const n = current().shots.length;
    S.k = ((k % n) + n) % n;
    layout();
    updateUI();
    schedule();
  }

  function updateUI() {
    const it = current(), s = it.shots[S.k], n = it.shots.length;
    $("cap-text").textContent = s.caption;
    $("cap-count").textContent = n > 1 ? `${S.k + 1} / ${n}` : "";
    $("dots").querySelectorAll("button").forEach((b) => b.setAttribute("aria-current", String(+b.dataset.k === S.k)));
    $("prev").disabled = $("next").disabled = n < 2;
    $("live").textContent = `${it.name}, ${n > 1 ? `screenshot ${S.k + 1} of ${n}: ` : ""}${s.caption}`;
    history.replaceState(null, "", `#${encodeURIComponent(it.id)}${S.k ? `/${S.k + 1}` : ""}`);
    if (it.kind === "mindheim") updateMindheimSub(it);
  }

  /* ---------------- Tour (autoplay) ----------------
     Moves through every screenshot, then on to the next app. Pauses while
     you read the details or use the dock, and when the tab is hidden. */
  function schedule() {
    clearTimeout(S.timer);
    const bar = $("progress");
    bar.classList.remove("run");
    if (!S.playing || S.hover || S.offscreen || document.hidden || S.i < 0) return;
    void bar.offsetWidth;
    bar.style.setProperty("--dur", `${SHOT_MS}ms`);
    bar.classList.add("run");
    S.timer = setTimeout(() => {
      if (S.k < current().shots.length - 1) go(S.k + 1); else showItem(S.i + 1);
    }, SHOT_MS);
  }
  function setPlaying(p) {
    S.playing = p;
    const b = $("play");
    b.setAttribute("aria-pressed", String(p));
    b.setAttribute("aria-label", p ? "Pause the tour" : "Play the tour");
    b.title = b.getAttribute("aria-label");
    schedule();
  }
  $("play").addEventListener("click", () => setPlaying(!S.playing));
  [$("details"), document.querySelector(".dock")].forEach((el) => {
    el.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") { S.hover = true; schedule(); } });
    el.addEventListener("pointerleave", () => { S.hover = false; schedule(); });
    el.addEventListener("focusin", () => { S.hover = true; schedule(); });
    el.addEventListener("focusout", () => { S.hover = false; schedule(); });
  });
  document.addEventListener("visibilitychange", schedule);
  // On small screens the page scrolls: pause while the viewer is mostly out of view.
  new IntersectionObserver(([e]) => { S.offscreen = !e.isIntersecting; schedule(); }, { threshold: 0.5 }).observe($("viewer"));

  /* ---------------- Viewer interaction ---------------- */
  $("prev").addEventListener("click", () => go(S.k - 1));
  $("next").addEventListener("click", () => go(S.k + 1));
  $("dots").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) go(+b.dataset.k); });

  function setImmersive(on) {
    app.classList.toggle("immersive", on);
    $("focus").setAttribute("aria-pressed", String(on));
    $("focus").setAttribute("aria-label", on ? "Show the details panel" : "Hide the details panel");
  }
  $("focus").addEventListener("click", () => setImmersive(!app.classList.contains("immersive")));

  let swiped = false;
  track.addEventListener("click", (e) => {
    if (swiped) return;
    const slide = e.target.closest(".slide");
    if (!slide) return;
    const k = +slide.dataset.k;
    if (k === S.k) { if (matchMedia("(min-width: 901px)").matches) setImmersive(!app.classList.contains("immersive")); }
    else go(k);
  });
  // Swipe on touch screens.
  let x0 = null;
  $("stage").addEventListener("pointerdown", (e) => { x0 = e.clientX; swiped = false; });
  $("stage").addEventListener("pointerup", (e) => {
    if (x0 == null) return;
    const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) { swiped = true; go(S.k + (dx < 0 ? 1 : -1)); setTimeout(() => { swiped = false; }, 0); }
  });
  // Sideways trackpad scroll moves between shots.
  let wheelAt = 0;
  $("stage").addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 20) return;
    e.preventDefault();
    if (Date.now() - wheelAt < 450) return;
    wheelAt = Date.now();
    go(S.k + (e.deltaX > 0 ? 1 : -1));
  }, { passive: false });
  // The whole scene leans slightly towards the pointer.
  if (finePointer && !reduceMotion) {
    $("viewer").addEventListener("pointermove", (e) => {
      const r = $("viewer").getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5, dy = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.transform = `rotateY(${dx * 7}deg) rotateX(${-dy * 5}deg)`;
    });
    $("viewer").addEventListener("pointerleave", () => { tilt.style.transform = ""; });
  }

  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || S.i < 0) return;
    const inDetails = $("details").contains(document.activeElement);
    if (e.key === "ArrowRight") { e.preventDefault(); go(S.k + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(S.k - 1); }
    else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !inDetails && matchMedia("(min-width: 901px)").matches) {
      e.preventDefault(); showItem(S.i + (e.key === "ArrowDown" ? 1 : -1));
    } else if (e.key === "Escape" && app.classList.contains("immersive")) setImmersive(false);
  });

  /* ---------------- Details ---------------- */
  function linkButtons(r) {
    const pages = r.has_pages ? `https://${USER}.github.io/${r.name}/` : null;
    const home = r.homepage && /^https?:\/\//.test(r.homepage) ? r.homepage : null;
    const out = [];
    if (home) out.push(`<a class="btn btn-primary" href="${esc(home)}">${ICON.home}Homepage</a>`);
    if (pages && norm(pages) !== norm(home)) out.push(`<a class="btn${home ? "" : " btn-primary"}" href="${esc(pages)}">${ICON.globe}GitHub Pages</a>`);
    out.push(`<a class="btn" href="${esc(r.html_url)}">${ICON.code}Source</a>`);
    return out.join("");
  }
  const jumpChip = (id, label, icon, boxed) => {
    const idx = S.items.findIndex((x) => x.id === id);
    return idx < 0 ? "" : `<button type="button" class="chip-btn" data-jump="${idx}">${icon ? `<img src="${esc(icon)}" alt=""${boxed ? ' class="boxed"' : ""}>` : ""}${esc(label)}</button>`;
  };

  function renderDetails(it) {
    const head = `
      <div class="d-head">
        ${it.icon ? `<img class="d-icon${it.boxed ? " boxed" : ""}" src="${esc(it.icon)}" alt="" width="64" height="64">` : ""}
        <div><span class="badge ${it.group}">${esc(GROUP_LABEL[it.group])}</span><h2 class="d-name">${esc(it.name)}</h2></div>
      </div>
      <span class="d-plat">${esc(it.platform || "")}</span>
      ${it.tagline ? `<p class="d-tagline">${esc(it.tagline)}</p>` : ""}`;
    let body = "";

    if (it.kind === "published") {
      const r = it.repo;
      const lib = S.items.find((x) => x.kind === "library");
      const facts = [
        r.language && ["Language", `<i class="dot" style="background:${LANG_COLORS[r.language] || "#8b949e"}"></i>${esc(r.language)}`],
        ["Stars", `★ ${r.stargazers_count}`],
        ["Licence", esc(r.license?.spdx_id && r.license.spdx_id !== "NOASSERTION" ? r.license.spdx_id : "—")],
        ["Updated", esc(ago(r.pushed_at))],
      ].filter(Boolean);
      body = `
        ${it.group === "published" && r.description ? `<p class="d-desc">${esc(r.description)}</p>` : ""}
        <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
        ${lib && lib.data.usedBy.includes(it.id) ? `<p class="d-label">Built with</p><div class="chips">${jumpChip(lib.id, lib.name, lib.icon)}</div>` : ""}
        <div class="links">${linkButtons(r)}</div>`;
    } else if (it.kind === "mindheim") {
      const m = it.data;
      body = `
        <p class="d-desc">${esc(m.card.description)}</p>
        <p class="d-label">The apps</p>
        <div class="chips" id="mh-apps">${m.apps.map((a) =>
          `<button type="button" class="chip-btn" data-sub="${esc(a.name)}"><img class="boxed" src="${esc(a.icon)}" alt="">${esc(a.title)}</button>`).join("")}</div>
        <div id="mh-sub"></div>
        <div class="links">
          <a class="btn btn-primary" href="mindheim.html">Explore the apps ${ICON.arrow}</a>
          <a class="btn" href="${esc(m.site)}">${ICON.globe}mindheim.app</a>
        </div>`;
    } else if (it.kind === "dubai") {
      body = `
        <p class="d-desc"><b>FanSUB</b> turns a series episode into a finished fan dub on one Mac. It separates the voices from the music, sorts every line by character, lets the cast record from home in any browser, and AI voices that run on the Mac speak the lines nobody has recorded yet.</p>
        <p class="d-desc"><b>GameDUB</b>, its sister app, opens a game's folder, finds the voice files and text tables, and times every spoken line, ready to dub.</p>
        <p class="d-label">Built with</p>
        <ul class="tags"><li>macOS 26 · Apple silicon</li><li>Swift 6</li><li>Runs on device</li><li>Browser recording booth</li></ul>
        <div class="links">
          <a class="btn btn-primary" href="dubai/">Explore DubAI ${ICON.arrow}</a>
          <a class="btn" href="dubai/#gamedub">GameDUB</a>
          <a class="btn" href="dubai/scenarios.html">Who it's for</a>
        </div>`;
    } else if (it.kind === "wip") {
      const p = it.data;
      body = `
        <p class="d-desc">${esc(p.description)}</p>
        ${p.highlights?.length ? `<p class="d-label">Highlights</p><ul class="hl">${p.highlights.map(([t, d]) => `<li><b>${esc(t)}</b>${esc(d)}</li>`).join("")}</ul>` : ""}
        ${p.stack?.length ? `<p class="d-label">Built with</p><ul class="tags">${p.stack.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
        <div class="links"><a class="btn btn-primary" href="in-progress.html#${esc(p.name)}">More about ${esc(p.title)} ${ICON.arrow}</a></div>`;
    } else if (it.kind === "library") {
      const lib = it.data;
      body = `
        <p class="d-desc">${esc(lib.description)}</p>
        <p class="d-label">Powers the UI of</p>
        <div class="chips">${lib.usedBy.map((n) => { const x = S.items.find((y) => y.id === n); return x ? jumpChip(x.id, x.name, x.icon) : ""; }).join("")}</div>
        <div class="links">
          <a class="btn btn-primary" href="${esc(lib.homepage)}">${ICON.home}Homepage</a>
          <a class="btn" href="https://github.com/${esc(lib.org)}">${ICON.code}GitHub</a>
          ${lib.npm ? `<a class="btn" href="${esc(lib.npm)}">npm</a>` : ""}
        </div>
        <p class="d-label">Repositories and packages</p>
        <div class="repos" id="lib-repos"><p class="d-desc">Loading…</p></div>`;
      libraryRepos(lib).then((html) => { const el = $("lib-repos"); if (el) el.innerHTML = html; });
    }

    const d = $("details");
    d.innerHTML = head + body + `<p class="d-foot">${S.i + 1} of ${S.items.length} · ${esc(GROUP_LABEL[it.group])}</p>`;
    [...d.children].forEach((c, i) => c.style.setProperty("--i", i));
    d.scrollTop = 0;
  }

  $("details").addEventListener("click", (e) => {
    const j = e.target.closest("[data-jump]");
    if (j) return showItem(+j.dataset.jump);
    const s = e.target.closest("[data-sub]");
    if (s) {
      const k = current().shots.findIndex((x) => x.sub === s.dataset.sub);
      if (k >= 0) go(k);
    }
  });

  function updateMindheimSub(it) {
    const sub = it.shots[S.k].sub;
    document.querySelectorAll("#mh-apps [data-sub]").forEach((b) => b.setAttribute("aria-current", String(b.dataset.sub === sub)));
    const box = $("mh-sub");
    if (!box) return;
    const a = it.data.apps.find((x) => x.name === sub);
    box.innerHTML = a ? `
      <div class="sub-card">
        <img src="${esc(a.icon)}" alt="">
        <h4>${esc(a.title)}</h4>
        <p>${esc(a.subject)} · grades ${esc(a.grades)}</p>
        <p class="sub-tag">${esc(a.tagline)}</p>
        <a href="${esc(a.url)}">${esc(host(a.url))} →</a>
      </div>` : "";
  }

  let libCache = null;
  async function libraryRepos(lib) {
    if (libCache) return libCache;
    const fallback = lib.repos.map((r) => ({ ...r, html_url: `https://github.com/${lib.org}/${r.name}` }));
    const hidden = new Set((lib.hidden || []).map((n) => n.toLowerCase()));
    let repos = fallback;
    try {
      const list = await getJSON(`${API}/orgs/${lib.org}/repos?per_page=100&sort=pushed`, GH);
      const known = new Map(fallback.map((r) => [r.name.toLowerCase(), r]));
      const live = list.filter((r) => !r.fork && !r.archived && !r.private && !hidden.has(r.name.toLowerCase())).map((r) => ({
        name: r.name, description: r.description || known.get(r.name.toLowerCase())?.description || "",
        homepage: r.homepage || (r.has_pages ? `https://${lib.org.toLowerCase()}.github.io/${r.name}/` : ""),
        language: r.language, html_url: r.html_url,
      }));
      if (live.length) repos = live;
    } catch (err) { console.warn("Spartan-Native repos unavailable, using snapshot:", err); }
    const pkgs = (name) => (lib.packages || []).filter((k) => k.repo.toLowerCase() === name.toLowerCase()).map((k) => `
      <div class="repo"><h4>${esc(k.name)}</h4><p>${esc(k.description)}</p>
        <div class="r-links"><span>npm package</span><a href="${esc(k.npm)}">npm</a><a href="https://github.com/${esc(lib.org)}/${esc(k.repo)}/tree/main/${esc(k.path)}">Source</a></div></div>`).join("");
    libCache = repos.map((r) => `
      <div class="repo"><h4>${esc(r.name)}</h4><p>${esc(r.description || "No description yet.")}</p>
        <div class="r-links">${r.language ? `<span>${esc(r.language)}</span>` : ""}${r.homepage ? `<a href="${esc(r.homepage)}">Homepage</a>` : ""}<a href="${esc(r.html_url)}">Source</a></div></div>${pkgs(r.name)}`).join("");
    return libCache;
  }

  /* ---------------- Boot ---------------- */
  applyTheme();
  setPlaying(S.playing);
  Promise.all([
    loadGitHub(),
    getJSON("data/showcase.json").catch(() => ({ projects: [] })),
    getJSON("data/mindheim.json").catch(() => null),
    getJSON("data/in-progress.json").catch(() => null),
  ]).then(([gh, showcase, mindheim, wip]) => {
    const p = gh.profile;
    $("brand-name").textContent = p.name || p.login;
    if (p.avatar_url) $("avatar").src = `${p.avatar_url}&s=64`;
    S.items = buildItems(gh, showcase, mindheim, wip);
    renderDock();
    // Deep link: #Claudealyzer or #Claudealyzer/3
    const [id, shot] = decodeURIComponent(location.hash.slice(1)).split("/");
    // Section anchors of the classic page still land somewhere sensible:
    // #in-progress opens the first project from the In progress page.
    const key = (id || "").toLowerCase();
    let idx = S.items.findIndex((x) => x.id.toLowerCase() === key);
    if (idx < 0 && key === "in-progress") idx = S.items.findIndex((x) => x.kind === "wip");
    idx = Math.max(0, idx);
    showItem(idx, shot ? Math.max(0, +shot - 1 || 0) : 0);
  }).catch((err) => {
    console.error(err);
    $("cap-text").textContent = "Couldn't load the projects.";
    $("details").innerHTML = `<p class="d-desc">Couldn't load the projects. <a href="https://github.com/${USER}?tab=repositories">See them on GitHub</a>.</p>`;
  });
})();
