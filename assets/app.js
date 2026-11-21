/* Home page: the published projects, read live from the GitHub API with a
   committed snapshot as fallback. Shared pieces come from core.js (window.SC). */
(() => {
  const { $, esc, ICON, COMPONENTS, getJSON, renderHero, deviceCarousel, tilt, reveals, glowCards, scrollSpy, countUp, openLightbox, toShots } = window.SC;
  const USER = "molnarroland";
  const API = "https://api.github.com";
  const GH = { Accept: "application/vnd.github+json" };
  const HIDDEN = new Set([`${USER}.github.io`.toLowerCase()]);
  const HERO_MS = 4200;
  const PROJECT_MS = 3600;

  const LANG_COLORS = {
    Swift: "#F05138", Kotlin: "#A97BFF", Go: "#00ADD8", TypeScript: "#3178C6",
    JavaScript: "#F1E05A", Python: "#3572A5", Java: "#B07219", "C#": "#178600",
    "C++": "#F34B7D", C: "#555555", Rust: "#DEA584", Ruby: "#701516", PHP: "#4F5D95",
    HTML: "#E34C26", CSS: "#663399", Shell: "#89E051", Dart: "#00B4AB", Vue: "#41B883",
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

  // Live API first, committed snapshot as fallback (rate limits / outages).
  async function loadGitHub() {
    try {
      const [profile, list] = await Promise.all([
        getJSON(`${API}/users/${USER}`, GH),
        getJSON(`${API}/users/${USER}/repos?per_page=100&sort=pushed`, GH),
      ]);
      return { profile, list, source: "Live data from the GitHub API" };
    } catch (err) {
      console.warn("Live GitHub API unavailable, using snapshot:", err);
      const [profile, list] = await Promise.all([getJSON("data/profile.json"), getJSON("data/repos.json")]);
      return { profile, list, source: "Cached GitHub snapshot" };
    }
  }

  // Ported from the hero of https://molnarroland.github.io/ClaudeProfileBar/
  COMPONENTS["profile-panel"] = () => {
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

  function renderProject(p, r, index) {
    const sec = document.createElement("section");
    sec.className = "project";
    sec.id = p.name;
    sec.style.setProperty("--pa", p.accent);
    sec.style.setProperty("--dur", `${PROJECT_MS}ms`);
    const iconHtml = p.icon
      ? `<img class="p-icon" src="${esc(p.icon)}" alt="" loading="lazy">`
      : `<div class="p-icon fallback">${esc(p.name[0])}</div>`;
    sec.innerHTML = `
      <div class="p-media reveal"></div>
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
    const { wrap } = deviceCarousel(media, { kind: p.frame, shots: p.shots, title: p.name, project: p, interval: PROJECT_MS });
    tilt(wrap.querySelector(".device"), media, 5);
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
    glowCards("#more-grid .mini");
  }

  /* ---------------- Spartan Native (closing section) ----------------
     The UI theme library some of the apps are built with. Its repositories
     are read live from the GitHub organisation, with showcase.json as fallback. */
  async function libraryRepos(lib) {
    const fallback = lib.repos.map((r) => ({ ...r, html_url: `https://github.com/${lib.org}/${r.name}` }));
    // Public repos that aren't ready to show yet.
    const hidden = new Set((lib.hidden || []).map((n) => n.toLowerCase()));
    try {
      const list = await getJSON(`${API}/orgs/${lib.org}/repos?per_page=100&sort=pushed`, GH);
      const known = new Map(fallback.map((r) => [r.name.toLowerCase(), r]));
      const live = list.filter((r) => !r.fork && !r.archived && !r.private && !hidden.has(r.name.toLowerCase())).map((r) => ({
        name: r.name,
        description: r.description || known.get(r.name.toLowerCase())?.description || "",
        homepage: r.homepage || (r.has_pages ? `https://${lib.org.toLowerCase()}.github.io/${r.name}/` : ""),
        language: r.language,
        stars: r.stargazers_count,
        pushed_at: r.pushed_at,
        html_url: r.html_url,
      }));
      return live.length ? live : fallback;
    } catch (err) {
      console.warn("Spartan-Native repos unavailable, using snapshot:", err);
      return fallback;
    }
  }

  function renderLibrary(lib, projects) {
    const sec = $("spartan-native");
    const users = lib.usedBy.map((n) => projects.find((p) => p.name === n)).filter(Boolean);
    const [img, alt] = lib.image;
    sec.hidden = false;
    sec.innerHTML = `
      <div class="lib-card reveal">
        <div class="lib-copy">
          <div class="p-head"><img class="p-icon" src="${esc(lib.logo)}" alt=""><div><div class="p-kicker">${esc(lib.kicker)}</div><h2 class="p-name">${esc(lib.name)}</h2></div></div>
          <p class="p-tagline">${esc(lib.tagline)}</p>
          <p class="p-desc">${esc(lib.description)}</p>
          ${users.length ? `<div class="lib-used"><span>Powers the UI of</span>${users.map((p) => `<a class="chip" href="#${esc(p.name)}">${p.icon ? `<img src="${esc(p.icon)}" alt="">` : ""}${esc(p.name)}</a>`).join("")}</div>` : ""}
          <div class="p-links">
            <a class="btn btn-accent" href="${esc(lib.homepage)}">${ICON.home}Homepage</a>
            <a class="btn" href="https://github.com/${esc(lib.org)}">${ICON.repo}GitHub organisation</a>
            ${lib.npm ? `<a class="btn" href="${esc(lib.npm)}">npm</a>` : ""}
          </div>
        </div>
        <figure class="lib-shot zoomable"><img src="${esc(img)}" alt="${esc(alt)}" loading="lazy"><figcaption>${esc(alt)}</figcaption></figure>
      </div>
      <h3 class="lib-sub reveal">Repositories and packages in <a href="https://github.com/${esc(lib.org)}">${esc(lib.org)}</a></h3>
      <div class="more-grid" id="lib-repos"></div>`;
    sec.querySelector(".lib-shot").addEventListener("click", () => openLightbox([{ src: img, caption: alt, project: { name: lib.name } }], 0));

    // Point the apps that use it back here.
    users.forEach((p) => document.getElementById(p.name)?.querySelector(".chips")
      ?.insertAdjacentHTML("beforeend", `<a class="chip chip-link" href="#spartan-native"><img src="${esc(lib.logo)}" alt="">Built with ${esc(lib.name)}</a>`));

    // npm packages that live inside a repo, shown right after it.
    const packageCard = (k) => `
        <article class="mini reveal">
          <h3>${esc(k.name)}</h3>
          <p>${esc(k.description)}</p>
          <div class="chips">
            <span class="chip"><i class="dot" style="background:${LANG_COLORS.TypeScript}"></i>TypeScript</span>
            <span class="chip">npm package</span>
            <span class="chip">in ${esc(k.repo)}</span>
          </div>
          <div class="p-links">
            <a class="btn btn-accent" href="${esc(k.npm)}">npm</a>
            <a class="btn" href="https://github.com/${esc(lib.org)}/${esc(k.repo)}/tree/main/${esc(k.path)}">${ICON.repo}Source</a>
          </div>
        </article>`;
    const packagesOf = (name) => (lib.packages || []).filter((k) => k.repo.toLowerCase() === name.toLowerCase()).map(packageCard).join("");

    libraryRepos(lib).then((repos) => {
      $("lib-repos").innerHTML = repos.map((r) => `
        <article class="mini reveal">
          <h3>${esc(r.name)}</h3>
          <p>${esc(r.description || "No description yet.")}</p>
          <div class="chips">
            ${r.language ? `<span class="chip"><i class="dot" style="background:${LANG_COLORS[r.language] || "#8b949e"}"></i>${esc(r.language)}</span>` : ""}
            ${r.stars != null ? `<span class="chip">★ ${r.stars}</span>` : ""}
            ${r.pushed_at ? `<span class="chip">Updated ${esc(ago(r.pushed_at))}</span>` : ""}
          </div>
          <div class="p-links">
            ${r.homepage ? `<a class="btn btn-accent" href="${esc(r.homepage)}">${ICON.home}Homepage</a>` : ""}
            <a class="btn" href="${esc(r.html_url)}">${ICON.repo}Source</a>
          </div>
        </article>${packagesOf(r.name)}`).join("");
      glowCards("#lib-repos .mini");
      reveals();
    });
  }

  /* ---------------- In progress: Mindheim first ----------------
     The Mindheim card leads the In progress section; it links to Mindheim's
     own page. The other unpublished apps are on in-progress.html. */
  async function renderMindheim() {
    const m = await getJSON("data/mindheim.json");
    const c = m.card;
    const [img, alt] = c.image;
    const sec = $("mindheim-card");
    sec.hidden = false;
    sec.innerHTML = `
      <div class="lib-card reveal">
        <div class="lib-copy">
          <div class="p-head"><img class="p-icon on-light" src="${esc(m.logo)}" alt=""><div><div class="p-kicker">${esc(c.kicker)}</div><h2 class="p-name">Mindheim</h2></div></div>
          <p class="p-tagline">${esc(c.tagline)}</p>
          <p class="p-desc">${esc(c.description)}</p>
          <div class="lib-used">${m.apps.map((a) =>
            `<a class="chip chip-link" href="mindheim.html#${esc(a.name)}"><img class="on-light" src="${esc(a.icon)}" alt="">${esc(a.title)}</a>`).join("")}</div>
          <div class="p-links">
            <a class="btn btn-accent" href="mindheim.html">Explore the Mindheim apps ${ICON.arrow}</a>
            <a class="btn" href="${esc(m.site)}">${ICON.globe}mindheim.app</a>
          </div>
        </div>
        <a class="lib-shot" href="mindheim.html" aria-label="Open the Mindheim page"><img src="${esc(img)}" alt="${esc(alt)}" loading="lazy"><figcaption>${esc(alt)}</figcaption></a>
      </div>`;
    reveals();
  }

  function renderNavAndMarquee(projects, lib) {
    $("nav-links").innerHTML = projects.map((p) => `<a href="#${esc(p.name)}">${esc(p.name)}</a>`).join("")
      + (lib ? `<a href="#spartan-native">${esc(lib.name)}</a>` : "")
      + '<a class="nav-wip" href="#in-progress"><span class="pulse"></span>In progress</a>';
    const items = projects.map((p) => `<span style="--c:${p.accent}">${esc(p.name)} — ${esc(p.tagline)}</span>`).join("");
    $("marquee").innerHTML = items + items; // doubled for a seamless loop
    scrollSpy(".project, .library:not([hidden]), #in-progress");
  }

  /* ---------------- Boot ---------------- */
  renderMindheim().catch((err) => console.warn("Mindheim card unavailable:", err));
  Promise.all([loadGitHub(), getJSON("data/showcase.json").catch(() => ({ projects: [] }))])
    .then(([{ profile, list, source }, showcase]) => {
      const repos = list.filter((r) => !r.fork && !HIDDEN.has(r.name.toLowerCase()));
      const byName = new Map(repos.map((r) => [r.name.toLowerCase(), r]));
      const projects = showcase.projects
        .filter((p) => byName.has(p.name.toLowerCase()))
        .map((p) => ({ ...p, shots: toShots(p.shots) }));
      const featured = new Set(projects.map((p) => p.name.toLowerCase()));

      renderProfile(profile, repos);
      renderHero(projects.filter((p) => p.shots.length), HERO_MS);
      projects.forEach((p, i) => renderProject(p, byName.get(p.name.toLowerCase()), i));
      renderMore(repos.filter((r) => !featured.has(r.name.toLowerCase())));
      if (showcase.library) renderLibrary(showcase.library, projects);
      renderNavAndMarquee(projects, showcase.library);
      $("source").textContent = source;
      reveals();
    })
    .catch((err) => {
      console.error(err);
      $("projects").innerHTML = `<p style="text-align:center;padding:80px 0">Couldn't load projects. <a href="https://github.com/${USER}?tab=repositories">View them on GitHub</a>.</p>`;
    });
})();
