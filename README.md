# molnarroland.github.io

A showcase of the projects I've built and published on GitHub
([@molnarroland](https://github.com/molnarroland)).

What it does:

- **Hero carousel** that slides between every app, each shown in its own device
  frame, with a colour glow that follows the current app and per-app progress bars.
- **Device frames** per app (`frame` in `data/showcase.json`): a macOS window for
  desktop apps, a TV for PlexVerse, and a menu-bar desktop for ClaudeProfileBar,
  whose panel is a live HTML mock-up taken from the top of its homepage.
- **One section per project** with its own sliding screenshot carousel (swipe on
  touch screens), clickable thumbnails, live GitHub stats and links to the **homepage**, the
  **GitHub Pages** site and the **source**.
- **Lightbox**: click any screenshot for a full-screen view (← → / Esc).
- Scroll-reveal, 3D tilt, aurora background and a cursor spotlight. All motion
  is switched off for visitors with *reduce motion* enabled.
- **Spartan Native** closing section: my UI theme library used by
  Claudealyzer and WorkLogger, with links into those apps and a list of the
  repositories in the [Spartan-Native](https://github.com/Spartan-Native)
  organisation (read live, with the `library` entry in `data/showcase.json` as
  fallback).
- Any public repo not listed in `data/showcase.json` still appears under
  *More on GitHub*.

## How it works

- `index.html` + `assets/` — a static page, no build step.
- On load, `assets/app.js` reads the live profile and repository list from the
  GitHub REST API, so new projects show up automatically.
- `data/showcase.json` holds the curated part for each project: tagline,
  platform, accent colour, icon and screenshots (in `assets/shots/<repo>/`).
  To feature a new app, drop its screenshots there and add an entry.
- `data/profile.json` and `data/repos.json` are a fallback snapshot used when
  the API is rate-limited (60 requests/hour per visitor IP). The
  **Update data snapshot** workflow refreshes them daily.

## Publishing

1. Create a public repository named **`molnarroland.github.io`** on GitHub.
2. Push this repository to it:
   ```sh
   git remote add origin git@github.com:molnarroland/molnarroland.github.io.git
   git push -u origin main
   ```
3. In **Settings → Pages**, set *Source* to *Deploy from a branch*, branch
   `main`, folder `/ (root)`.

The site is then served at <https://molnarroland.github.io/>.

## Local preview

```sh
python3 -m http.server 8000
# open http://localhost:8000
```
