# QR Agent Notes

This directory is the local mirror of the `qr.misssponto.me.uk` subdomain docroot. It holds standalone novelty pages that are accessed via QR codes — there is no site navigation or index of pages; each page is reached by scanning its code.

## Product Model

- Static HTML only — no build step, no framework, no CMS.
- Pages are novelty/one-off pages (e.g. `wifi.html` — Wi-Fi QR code generator).
- Tracked in git at `Box-of-Dragons/QR` (Conventional Commits — see [docs/git-rules.md](../StructuredChaos/docs/git-rules.md)). The VPS copy is not a repo; deploys are still manual `scp`.

## Shared Generator Code

The two generator pages (`generator.html`, `text-generator.html`) share code:

- `css/gen.css` — shared `.gen-*` styles (sticker table, options form, sheet preview, margin guide, actions). Loaded after `css/site.css`.
- `js/gen-shared.js` — `window.GenShared` helpers: `mmToPx`/`pxToMm` (300 DPI), `expandQueue` (count expansion), `overflowNote`, `positionMarginGuide`, `attachTsvPaste` (Excel/Sheets paste), `downloadCanvas`.
- `js/sheet-pack.js` — `window.SheetPack` rectangle packing: `grid` (uniform cells), `shelf` (in-order rows), `maxRects` (best-fit). All take a queue of `{w, h}` items and return `{placements, overflow}` in margin-relative px.

## Page Shell

Pages use the Structured Chaos shared chrome, loaded from the root site (`http://localhost:4000` in local dev, `https://misssponto.me.uk` in production):

- `css/shared.css` — injected via an inline `document.write` loader script in `<head>`
- `css/site.css` — qr-specific overrides, loaded after `shared.css` (currently just restores the `.page-main` top gap since these pages have no subheader)
- `js/global-bar.js` — shared site switcher bar (`<div id="global-bar"></div>`)
- `js/site-footer.js` — footer with page links (`window.SITE_FOOTER.links`)

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

The VPS docroot is `/home/misssponto-qr/htdocs/www.qr.misssponto.me.uk/` (nginx serves it directly, no app process). Deploy by copying files and fixing ownership:

```bash
scp wifi.html root@77.68.76.203:/home/misssponto-qr/htdocs/www.qr.misssponto.me.uk/
ssh root@77.68.76.203 "chown misssponto-qr:misssponto-qr /home/misssponto-qr/htdocs/www.qr.misssponto.me.uk/wifi.html && chmod 664 /home/misssponto-qr/htdocs/www.qr.misssponto.me.uk/wifi.html"
```

Public URL: `https://qr.misssponto.me.uk/`
