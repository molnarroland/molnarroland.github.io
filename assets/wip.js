/* The "In progress" page and the Mindheim page. Both are curated (nothing
   here is on GitHub), so they render straight from a JSON file in data/.
   Shared pieces come from core.js (window.SC). */
(() => {
  const { $, esc, ICON, getJSON, renderHero, deviceCarousel, tilt, reveals, glowCards, scrollSpy, countUp, openLightbox, toShots } = window.SC;
  const HERO_MS = 4200;
  const PROJECT_MS = 3600;
  const page = document.body.dataset.page;

  const icon = (p, cls = "p-icon") => p.icon
    ? `<img class="${cls}${p.iconLight ? " on-light" : ""}" src="${esc(p.icon)}" alt="" loading="lazy">`
    : `<div class="${cls} fallback">${esc((p.title || p.name)[0])}</div>`;

  // Highlights are [title, text] pairs or plain strings.
  const highlights = (list) => list?.length
    ? `<ul class="hl">${list.map((h) => Array.isArray(h)
      ? `<li><b>${esc(h[0])}</b><span>${esc(h[1])}</span></li>`
      : `<li><span>${esc(h)}</span></li>`).join("")}</ul>`
    : "";

  /* One section per project: its device(s) on one side, the story on the other.
     A project with several devices (BrickSplit's Android and iOS apps) shows
     them side by side, each with its own carousel and label. */
  function renderSection(p, index, { kicker, chips = "", links = "" }) {
    const sec = document.createElement("section");
    sec.className = "project";
    sec.id = p.name;
    sec.style.setProperty("--pa", p.accent);
    sec.style.setProperty("--dur", `${PROJECT_MS}ms`);
    sec.innerHTML = `
      <div class="p-media reveal"></div>
      <div class="p-copy reveal">
        <div class="p-head">${icon(p)}<div><div class="p-kicker">${String(index + 1).padStart(2, "0")} · ${esc(kicker)}</div><h2 class="p-name">${esc(p.title)}</h2></div></div>
        <p class="p-tagline">${esc(p.tagline)}</p>
        <p class="p-desc">${esc(p.description)}</p>
        ${highlights(p.highlights)}
        ${chips ? `<div class="chips">${chips}</div>` : ""}
        ${links ? `<div class="p-links">${links}</div>` : ""}
      </div>`;
    $("projects").appendChild(sec);

    const media = sec.querySelector(".p-media");
    const devices = p.devices.filter((d) => d.shots.length);
    if (!devices.length) { media.remove(); return; }
    if (devices.length === 1) {
      const d = devices[0];
      const { wrap } = deviceCarousel(media, { kind: d.frame, shots: d.shots, title: p.title, project: p, interval: PROJECT_MS });
      tilt(wrap.querySelector(".device"), media, 5);
      return;
    }
    media.classList.add("duo");
    devices.forEach((d, k) => {
      const { wrap } = deviceCarousel(media, {
        kind: d.frame, shots: d.shots, title: p.title, project: p, thumbs: false,
        // Offset the timers so the phones don't flip in lockstep.
        interval: PROJECT_MS + k * 700,
      });
      wrap.insertAdjacentHTML("beforeend", `<div class="duo-label"><span class="os ${esc(d.frame)}"></span>${esc(d.label)}<em></em></div>`);
      const cap = wrap.querySelector(".duo-label em");
      const show = (s) => { cap.textContent = s.caption; };
      show(d.shots[0]);
      wrap.addEventListener("slide", (e) => show(e.detail.s));
      tilt(wrap.querySelector(".device"), wrap, 6);
    });
  }

  const stackChips = (list) => (list || []).map((s) => `<span class="chip">${esc(s)}</span>`).join("");

  // Each device's screenshots, flattened, with the device frame on each slide.
  const heroShots = (p) => p.devices.flatMap((d) => d.shots.map((s) => ({ ...s, frame: d.frame })));

  function renderStats(stats) {
    $("stats").innerHTML = stats.map(([v, l]) => `<div class="stat"><b data-count="${typeof v === "number" ? v : ""}">${esc(v)}</b><span>${esc(l)}</span></div>`).join("");
    countUp();
  }

  function renderNav(items, extra = "") {
    $("nav-links").innerHTML = items.map(([id, label]) => `<a href="#${esc(id)}">${esc(label)}</a>`).join("") + extra;
  }

  function renderMarquee(items) {
    const html = items.map((p) => `<span style="--c:${p.accent}">${esc(p.title)} — ${esc(p.tagline)}</span>`).join("");
    $("marquee").innerHTML = html + html; // doubled for a seamless loop
  }

  /* ---------------- In progress ---------------- */
  function inProgress(data) {
    const projects = data.projects.map((p) => ({
      ...p,
      devices: p.devices.map((d) => ({ ...d, shots: toShots(d.shots) })),
    }));
    projects.forEach((p) => { p.shots = heroShots(p); p.frame = p.devices[0].frame; });

    renderStats([
      [projects.length, "projects"],
      [projects.reduce((n, p) => n + p.devices.length, 0), "apps"],
      [data.platforms.length, data.platforms.join(" · ")],
    ]);
    renderHero(projects, HERO_MS);
    projects.forEach((p, i) => renderSection(p, i, { kicker: p.platform, chips: stackChips(p.stack) }));
    renderNav(projects.map((p) => [p.name, p.title]),
      `<a class="nav-out" href="index.html#in-progress">${ICON.arrow}Home</a>`);
    renderMarquee(projects);
    scrollSpy(".project");
  }

  /* ---------------- Mindheim ---------------- */
  function mindheim(data) {
    const apps = data.apps.map((a) => {
      const shots = toShots(a.shots);
      return { ...a, iconLight: true, frame: "window", shots, devices: [{ frame: "window", shots }] };
    });

    renderStats([
      [apps.length, "live apps"],
      [6, "languages"],
      ["1–8", "grades"],
      [0, "accounts needed"],
    ]);
    renderHero(apps, HERO_MS);

    $("app-grid").innerHTML = apps.map((a) => `
      <a class="app-card reveal" href="#${esc(a.name)}" style="--pa:${a.accent}">
        ${icon(a, "app-icon")}
        <div>
          <h3>${esc(a.title)}${a.beta ? '<span class="beta">beta</span>' : ""}</h3>
          <p class="app-meta">${esc(a.subject)} · grades ${esc(a.grades)}</p>
          <p>${esc(a.tagline)}</p>
        </div>
      </a>`).join("") + (data.next || []).map((a) => `
      <a class="app-card soon reveal" href="#next" style="--pa:${a.accent}">
        <img class="app-icon on-light" src="${esc(a.icon)}" alt="" loading="lazy">
        <div>
          <h3>${esc(a.title)}<span class="beta">coming next</span></h3>
          <p class="app-meta">${esc(a.subject)} · grades ${esc(a.grades)}</p>
          <p>${esc(a.tagline)}</p>
        </div>
      </a>`).join("");
    glowCards(".app-card");

    apps.forEach((a, i) => renderSection(a, i, {
      kicker: `${a.subject} · grades ${a.grades}`,
      chips: `<span class="chip">${a.beta ? "Beta" : "Live"}</span><span class="chip">${esc(a.url.replace(/^https:\/\//, ""))}</span>`,
      links: `<a class="btn btn-accent" href="${esc(a.url)}">${ICON.globe}Open ${esc(a.title)}</a>`,
    }));

    if (data.next?.length) {
      $("next").hidden = false;
      $("next-list").innerHTML = data.next.map((a) => `
        <article class="next-card reveal" style="--pa:${a.accent}">
          <img class="p-icon on-light" src="${esc(a.icon)}" alt="">
          <div>
            <div class="p-kicker">Coming next · ${esc(a.subject)} · grades ${esc(a.grades)}</div>
            <h3>${esc(a.title)}</h3>
            <p class="p-tagline">${esc(a.tagline)}</p>
            <p class="p-desc">${esc(a.description)}</p>
          </div>
        </article>`).join("");
    }

    $("shared-grid").innerHTML = data.shared.map(([t, d]) => `<article class="mini reveal"><h3>${esc(t)}</h3><p>${esc(d)}</p></article>`).join("");
    $("stack").innerHTML = stackChips(data.stack);
    glowCards("#shared-grid .mini");

    const [img, alt] = data.landing;
    $("landing-shot").innerHTML = `<img src="${esc(img)}" alt="${esc(alt)}" loading="lazy"><figcaption>${esc(alt)}</figcaption>`;
    $("landing-shot").addEventListener("click", () => openLightbox([{ src: img, caption: alt, project: { title: "Mindheim" } }], 0));

    renderNav([["apps", "Apps"], ...apps.map((a) => [a.name, a.title]), ["shared", "Shared"]],
      `<a class="nav-out" href="index.html#in-progress">${ICON.arrow}Home</a>`);
    renderMarquee(apps);
    scrollSpy("#apps, .project, #shared");
  }

  /* ---------------- Boot ---------------- */
  const source = { "in-progress": ["data/in-progress.json", inProgress], mindheim: ["data/mindheim.json", mindheim] }[page];
  getJSON(source[0])
    .then((data) => { source[1](data); reveals(); })
    .catch((err) => {
      console.error(err);
      $("projects").innerHTML = '<p style="text-align:center;padding:80px 0">Couldn\'t load this page\'s content.</p>';
    });
})();
