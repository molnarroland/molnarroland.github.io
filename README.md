# molnarroland.github.io

A small dashboard of the projects I've built and published on GitHub
([@molnarroland](https://github.com/molnarroland)).

Each public, non-fork repository gets a card with its description, language,
stars, license, last update and links to its **homepage**, its **GitHub Pages**
site and the **repository** itself.

## How it works

- `index.html` + `assets/` — a static page, no build step.
- On load, `assets/app.js` reads the live profile and repository list from the
  GitHub REST API, so new projects show up automatically.
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
