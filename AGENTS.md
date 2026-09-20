# QR Agent Notes

This directory is the local mirror of the `qr.misssponto.me.uk` subdomain docroot. It holds standalone novelty pages that are accessed via QR codes — there is no site navigation or index of pages; each page is reached by scanning its code.

## Product Model

- Static HTML only — no build step, no framework, no CMS.
- Pages are novelty/one-off pages (e.g. `wifi.html` — Wi-Fi QR code generator).
- Tracked in git at `Box-of-Dragons/QR` (Conventional Commits — see [docs/git-rules.md](../StructuredChaos/docs/git-rules.md)). The VPS docroot is a git checkout of `master` — deploys run through the Release workflow.

## Shared Generator Code

The two generator pages (`generator.html`, `text-generator.html`) share code:

- `css/gen.css` — shared `.gen-*` styles (sticker table, options form, sheet preview, margin guide, actions). Loaded after `css/site.css`.
- `js/gen-shared.js` — `window.GenShared` helpers: `mmToPx`/`pxToMm` (300 DPI), `expandQueue` (count expansion), `overflowNote`, `positionMarginGuide`, `attachTsvPaste` (Excel/Sheets paste), `downloadCanvas`.
- `js/sheet-pack.js` — `window.SheetPack` rectangle packing: `grid` (uniform cells), `shelf` (in-order rows), `maxRects` (best-fit). All take a queue of `{w, h}` items and return `{placements, overflow}` in margin-relative px.
- `js/qr-sticker.js` / `js/qr-gen.js` — `generator.html` only: `window.QrSticker` single-sticker drawing (`makeQr`, `draw(ctx, opts)`), and the page logic (rows, localStorage state via the `OPTS` element map, presets, render).

## Page Shell

Pages use the Structured Chaos shared chrome, loaded from the root site (`http://localhost:4000` in local dev, `https://misssponto.me.uk` in production):

- `css/shared.css` — injected via an inline `document.write` loader script in `<head>`
- `css/site.css` — qr-specific overrides, loaded after `shared.css` (currently just restores the `.page-main` top gap since these pages have no subheader)
- `js/global-bar.js` — shared site switcher bar (`<div id="global-bar"></div>`)
- `js/site-footer.js` — footer with page links (`window.SITE_FOOTER.links`)
- `js/footer-links.js` — QR-local single source of truth for `window.SITE_FOOTER` (the footer page-link list); loaded by every page via `<script src="/js/footer-links.js"></script>` before the `site-footer.js` loader

Deliberate deviations from the family shell:

- **No site header or page subheader** — `site-header.js` is not loaded and there is no `h1` banner; content sits directly under the global bar. `css/site.css` restores the top gap via `.page-main { padding-top: 32px }`.
- **Page links live in the footer** (`SITE_FOOTER.links`). These pages are reached via QR codes, not site navigation.
- **`qr` is not registered in `global-bar.js`** — the bar is rendered, but this subdomain is deliberately not added to its `SITES` array.

Otherwise follow the shared shell conventions in [docs/ui.md](../StructuredChaos/docs/ui.md): `.page-subheader` with `h1`, `.container` holding `.panel.panel--padded` sections, shared CSS classes over new selectors.

## Running Locally

Serve the folder with any static server:

```bash
npx serve -l 4002 .
```

Then open e.g. `http://localhost:4002/wifi.html`. For the shared header/footer/styles to render locally, the StructuredChaos site must also be served on `http://localhost:4000`.

## Deploying

The manual **Release** workflow (Actions → Release → Run workflow) is the ship path — it creates the version tag + GitHub Release and deploys to the VPS in one run.

The VPS docroot is `/home/misssponto-qr/htdocs/www.qr.misssponto.me.uk/` — a git checkout of this repo's `master` branch (nginx serves it directly, no app process, no build step). Deploys run through the Release workflow like the rest of the family: the shared deploy job SSHes in as `misssponto-qr`, fetches + resets the checkout, then runs `scripts/deploy.sh` — which only writes `js/buildInfo.js` (version + commit for the footer) from the latest `vX.Y.Z` tag. The file is generated per-deploy and gitignored.

### Manual deploy (fallback)

```bash
ssh misssponto-qr@77.68.76.203
cd htdocs/www.qr.misssponto.me.uk
git fetch origin master && git reset --hard origin/master
```

Untracked files in the docroot (e.g. `.well-known/`) survive deploys — `git reset --hard` only touches tracked files. Do **not** add files to the docroot out-of-band without also committing them to the repo, or they'll drift.

Public URL: `https://qr.misssponto.me.uk/`
