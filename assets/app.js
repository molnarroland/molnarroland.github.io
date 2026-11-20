(() => {
  const USER = "molnarroland";
  const API = "https://api.github.com";
  // Repositories that should never appear as cards (e.g. this dashboard itself).
  const HIDDEN = new Set([`${USER}.github.io`.toLowerCase()]);

  const LANG_COLORS = {
    Swift: "#F05138", Kotlin: "#A97BFF", Go: "#00ADD8", TypeScript: "#3178C6",
    JavaScript: "#F1E05A", Python: "#3572A5", Java: "#B07219", "C#": "#178600",
    "C++": "#F34B7D", C: "#555555", Rust: "#DEA584", Ruby: "#701516", PHP: "#4F5D95",
    HTML: "#E34C26", CSS: "#663399", Shell: "#89E051", Dart: "#00B4AB", Vue: "#41B883",
  };

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const ago = (iso) => {
    const days = Math.floor((Date.now() - new Date(iso)) / 864e5);
    if (days < 1) return "today";
    if (days < 2) return "yesterday";
    if (days < 30) return `${days} days ago`;
    if (days < 365) return `${Math.floor(days / 30)} mo ago`;
    return `${Math.floor(days / 365)} yr ago`;
  };

  const ICON = {
    home: '<svg viewBox="0 0 16 16"><path d="M6.906.664a1.749 1.749 0 0 1 2.187 0l5.25 4.2c.415.332.657.835.657 1.367v7.019A1.75 1.75 0 0 1 13.25 15h-3.5a.75.75 0 0 1-.75-.75V9H7v5.25a.75.75 0 0 1-.75.75h-3.5A1.75 1.75 0 0 1 1 13.25V6.23c0-.531.242-1.034.657-1.366l5.25-4.2Z"/></svg>',
    pages: '<svg viewBox="0 0 16 16"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM5.78 8.75a9.64 9.64 0 0 0 1.363 4.177c.255.426.542.832.857 1.215.245-.296.551-.705.857-1.215A9.64 9.64 0 0 0 10.22 8.75Zm4.44-1.5a9.64 9.64 0 0 0-1.363-4.177c-.307-.51-.612-.919-.857-1.215a9.927 9.927 0 0 0-.857 1.215A9.64 9.64 0 0 0 5.78 7.25Zm-5.944 1.5H1.543a6.507 6.507 0 0 0 4.666 5.5c-.123-.181-.24-.365-.352-.552-.715-1.192-1.437-2.874-1.581-4.948Zm-2.733-1.5h2.733c.144-2.074.866-3.756 1.58-4.948.12-.197.237-.381.353-.552a6.507 6.507 0 0 0-4.666 5.5Zm10.181 1.5c-.144 2.074-.866 3.756-1.58 4.948-.12.197-.237.381-.353.552a6.507 6.507 0 0 0 4.666-5.5Zm2.733-1.5a6.507 6.507 0 0 0-4.666-5.5c.123.181.24.365.353.552.714 1.192 1.436 2.874 1.58 4.948Z"/></svg>',
    repo: '<svg viewBox="0 0 16 16"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"/></svg>',
    star: "★",
    fork: "⑂",
  };

  let repos = [];

  async function getJSON(url) {
    const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.json();
  }

  // Live data from the GitHub API first; fall back to the snapshot committed
  // by the "Update data snapshot" workflow (covers API rate limits / outages).
  async function load() {
    try {
      const [profile, list] = await Promise.all([
        getJSON(`${API}/users/${USER}`),
        getJSON(`${API}/users/${USER}/repos?per_page=100&sort=pushed`),
      ]);
      return { profile, list, source: "Live data from the GitHub API" };
    } catch (err) {
      console.warn("Live GitHub API unavailable, using snapshot:", err);
      const [profile, list] = await Promise.all([getJSON("data/profile.json"), getJSON("data/repos.json")]);
      return { profile, list, source: "Cached snapshot" };
    }
  }

  function pagesUrl(r) {
    if (!r.has_pages) return null;
    return r.name.toLowerCase() === `${USER}.github.io`
      ? `https://${USER}.github.io/`
      : `https://${USER}.github.io/${r.name}/`;
  }

  const norm = (u) => (u || "").replace(/\/+$/, "").toLowerCase();

  function renderProfile(p) {
    $("name").textContent = p.name || p.login;
    if (p.avatar_url) $("avatar").src = `${p.avatar_url}&s=160`;
    const bits = [`<a href="${esc(p.html_url)}">@${esc(p.login)}</a>`];
    if (p.location) bits.push(esc(p.location));
    if (p.blog) bits.push(`<a href="${esc(/^https?:/.test(p.blog) ? p.blog : "https://" + p.blog)}">${esc(p.blog)}</a>`);
    bits.push(`on GitHub since ${new Date(p.created_at).getFullYear()}`);
    $("meta").innerHTML = bits.join(" · ");
    if (p.bio) { $("bio").textContent = p.bio; $("bio").hidden = false; }
  }

  function renderStats(list) {
    const langs = new Set(list.map((r) => r.language).filter(Boolean));
    const stars = list.reduce((n, r) => n + r.stargazers_count, 0);
    const live = list.filter((r) => r.has_pages).length;
    const latest = list.reduce((a, r) => (r.pushed_at > a ? r.pushed_at : a), "");
    const stats = [
      [list.length, "Public projects"],
      [live, "Live on GitHub Pages"],
      [stars, "Stars"],
      [langs.size, "Languages"],
      [latest ? ago(latest) : "–", "Last push"],
    ];
    $("stats").innerHTML = stats.map(([v, l]) =>
      `<div class="stat"><div class="value">${esc(v)}</div><div class="label">${esc(l)}</div></div>`).join("");
  }

  function card(r) {
    const pages = pagesUrl(r);
    const home = r.homepage && /^https?:\/\//.test(r.homepage) ? r.homepage : null;
    const links = [];
    if (home) links.push(`<a class="btn primary" href="${esc(home)}">${ICON.home}Homepage</a>`);
    if (pages && norm(pages) !== norm(home)) {
      links.push(`<a class="btn ${home ? "" : "primary"}" href="${esc(pages)}">${ICON.pages}GitHub Pages</a>`);
    } else if (pages) {
      // Homepage *is* the Pages site — label it so it's still clear.
      links[0] = `<a class="btn primary" href="${esc(home)}" title="Homepage (hosted on GitHub Pages)">${ICON.pages}Homepage</a>`;
    }
    links.push(`<a class="btn" href="${esc(r.html_url)}">${ICON.repo}Repository</a>`);

    const facts = [];
    if (r.language) facts.push(`<span><i class="dot" style="background:${LANG_COLORS[r.language] || "#8b949e"}"></i>${esc(r.language)}</span>`);
    facts.push(`<span title="Stars">${ICON.star} ${r.stargazers_count}</span>`);
    if (r.forks_count) facts.push(`<span title="Forks">${ICON.fork} ${r.forks_count}</span>`);
    if (r.license?.spdx_id && r.license.spdx_id !== "NOASSERTION") facts.push(`<span>${esc(r.license.spdx_id)}</span>`);
    facts.push(`<span title="Created ${esc(fmtDate(r.created_at))}">Updated ${esc(ago(r.pushed_at))}</span>`);

    const badge = r.archived ? "Archived" : r.fork ? "Fork" : pages ? "Live" : "";
    const topics = (r.topics || []).map((t) => `<span class="topic">${esc(t)}</span>`).join("");

    return `<article class="card">
      <div class="card-head">
        <h2><a href="${esc(r.html_url)}">${esc(r.name)}</a></h2>
        ${badge ? `<span class="badge">${badge}</span>` : ""}
      </div>
      <p class="desc">${esc(r.description || "No description yet.")}</p>
      ${topics ? `<div class="topics">${topics}</div>` : ""}
      <div class="facts">${facts.join("")}</div>
      <div class="links">${links.join("")}</div>
    </article>`;
  }

  function render() {
    const q = $("search").value.trim().toLowerCase();
    const lang = $("language").value;
    const sort = $("sort").value;
    const shown = repos
      .filter((r) => !lang || r.language === lang)
      .filter((r) => !q || [r.name, r.description, ...(r.topics || [])].join(" ").toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "stars") return b.stargazers_count - a.stargazers_count || b.pushed_at.localeCompare(a.pushed_at);
        if (sort === "created") return b.created_at.localeCompare(a.created_at);
        return b.pushed_at.localeCompare(a.pushed_at);
      });
    $("grid").innerHTML = shown.map(card).join("");
    $("status").textContent = shown.length ? "" : "No projects match your filters.";
  }

  load()
    .then(({ profile, list, source }) => {
      repos = list.filter((r) => !r.fork && !HIDDEN.has(r.name.toLowerCase()));
      renderProfile(profile);
      renderStats(repos);
      const langs = [...new Set(repos.map((r) => r.language).filter(Boolean))].sort();
      $("language").insertAdjacentHTML("beforeend", langs.map((l) => `<option>${esc(l)}</option>`).join(""));
      $("source").textContent = source;
      render();
      ["search", "language", "sort"].forEach((id) => $(id).addEventListener("input", render));
    })
    .catch((err) => {
      console.error(err);
      $("status").innerHTML = `Couldn't load projects. <a href="https://github.com/${USER}?tab=repositories">View them on GitHub</a>.`;
    });
})();
