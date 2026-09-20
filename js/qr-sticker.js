/* qr-sticker.js - draws a single QR sticker for the generator page.
 *
 * Layout: border | pad | QR ink | caption gap | caption | bottom pad | pad | border.
 * The caption gap is measured from the QR ink, not the square's edge — the
 * square's bottom quiet zone overlaps it; "auto" keeps the recommended
 * 4-module gap below the ink.
 *
 * QrSticker.makeQr(url)  - returns a made qrcode-generator object
 * QrSticker.draw(ctx, o) - draws one sticker; all sizes in px:
 *   x, y, w, h    - sticker bounds
 *   borderPx      - printed border width (0 for none)
 *   padPx         - inner padding
 *   textGapPx     - fixed caption gap (used when textGapAuto is false)
 *   textGapAuto   - caption gap = the padding (padPx + quiet zone) — fixed,
 *                   so the caption never moves relative to the QR
 *   bottomPadPx   - fixed space under the caption (used when bottomPadAuto is false)
 *   bottomPadAuto - bottom pad absorbs whatever space is left below the caption
 *   textPx, text  - caption strip height and text (0/'' for no caption)
 *   qr            - made qrcode-generator object
 *   cutPx         - ScanNCut cut-line inset (0 hides the inner guide)
 *   quiet         - quiet-zone modules included in the QR square
 *   showCuts      - draw dashed cut lines (preview only, never in downloads)
 *
 * QrSticker.captionHeight(ctx, textPx, text) - measured glyph bounds
 *   ({asc, desc, glyphH, font}) so layout can use the real text height.
 */
window.QrSticker = (function () {
    var mmToPx = GenShared.mmToPx;

    // Real glyph bounds are measured on a scratch canvas: font metrics
    // (actualBoundingBox*) reserve extra room for the fount's em box, which
    // leaves phantom space under the caption in the layout math.
    var scratch = null;

    function captionHeight(ctx, textPx, text) {
        var fontPx = Math.round(textPx * 0.55);
        var font = '600 ' + fontPx + 'px "Open Sans", sans-serif';
        if (!scratch) scratch = document.createElement('canvas');
        var sctx = scratch.getContext('2d', { willReadFrequently: true });
        sctx.font = font;
        var baseline = fontPx * 1.5;
        scratch.width = Math.ceil(sctx.measureText(text).width) + 8;
        scratch.height = fontPx * 3;
        sctx.font = font; // resizing the canvas resets its state
        sctx.textBaseline = 'alphabetic';
        sctx.fillText(text, 4, baseline);
        var img = sctx.getImageData(0, 0, scratch.width, scratch.height).data;
        var top = -1, bot = -1;
        for (var y = 0; y < scratch.height; y++) {
            for (var x = 0; x < scratch.width; x++) {
                if (img[(y * scratch.width + x) * 4 + 3] > 40) {
                    if (top === -1) top = y;
                    bot = y;
                    break;
                }
            }
        }
        if (top === -1) { top = baseline - fontPx * 0.72; bot = baseline; }
        return { asc: baseline - top, desc: bot - baseline, glyphH: bot - top + 1, font: font };
    }

    function makeQr(url) {
        var qr = qrcode(0, 'M');
        qr.addData(url);
        qr.make();
        return qr;
    }

    function draw(ctx, o) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(o.x, o.y, o.w, o.h);

        if (o.borderPx > 0) {
            ctx.strokeStyle = '#000';
            ctx.lineWidth = o.borderPx;
            ctx.strokeRect(o.x + o.borderPx / 2, o.y + o.borderPx / 2, o.w - o.borderPx, o.h - o.borderPx);
        }

        var innerX = o.x + o.borderPx + o.padPx;
        var innerY = o.y + o.borderPx + o.padPx;
        var innerW = o.w - 2 * (o.borderPx + o.padPx);
        var innerH = o.h - 2 * (o.borderPx + o.padPx);

        // Measure the caption first so layout uses real glyph bounds, not
        // the full strip height (which leaves dead space under the text).
        var cap = o.textPx > 0 ? captionHeight(ctx, o.textPx, o.text) : null;
        var glyphH = cap ? cap.glyphH : 0;

        var count = o.qr.getModuleCount();
        var cellEst = Math.max(1, Math.floor(Math.min(innerW, innerH) / (count + o.quiet * 2)));
        // Estimate of the space the caption needs below the QR square: auto
        // values target the padding (padPx + quiet zone) when auto-sized.
        var gapEst = o.textGapAuto ? o.padPx + o.quiet * cellEst : o.textGapPx;
        var botEst = o.bottomPadAuto ? o.padPx + o.quiet * cellEst : o.bottomPadPx;
        var reservePx = cap ? Math.max(0, gapEst - o.quiet * cellEst + glyphH + botEst) : 0;
        var qrArea = Math.min(innerW, innerH - reservePx);

        var cell = Math.max(1, Math.floor(qrArea / (count + o.quiet * 2)));
        var qrActual = cell * (count + o.quiet * 2);
        var quietPx = o.quiet * cell;

        var qrOffX = innerX + Math.floor((innerW - qrActual) / 2);
        var qrOffY, botPadPx;
        // The caption gap is always a fixed distance from the ink — "Auto"
        // is the padding (padPx + quiet zone), not a flexible share — so
        // the caption never moves relative to the QR.
        var capGapPx = o.textGapAuto ? o.padPx + quietPx : o.textGapPx;
        if (cap && o.bottomPadAuto) {
            // Auto bottom pad absorbs the space below the caption; the
            // square anchors on the width remainder so the top margin
            // always equals the sides (same as the centred block).
            qrOffY = innerY + Math.floor((innerW - qrActual) / 2);
            var inkB = qrOffY + qrActual - quietPx;
            botPadPx = Math.max(0, innerY + innerH - inkB - capGapPx - glyphH);
        } else {
            // QR square + caption glyph + bottom pad form one centred
            // block — the square's top quiet zone stays intact so the top
            // margin matches the sides.
            botPadPx = o.bottomPadPx;
            var contentH = qrActual + (cap ? Math.max(0, capGapPx - quietPx + glyphH + botPadPx) : 0);
            qrOffY = innerY + Math.max(0, Math.floor((innerH - contentH) / 2));
        }
        ctx.fillStyle = '#000';
        for (var r = 0; r < count; r++) {
            for (var c = 0; c < count; c++) {
                if (o.qr.isDark(r, c)) {
                    ctx.fillRect(qrOffX + (c + o.quiet) * cell, qrOffY + (r + o.quiet) * cell, cell, cell);
                }
            }
        }

        if (cap) {
            ctx.fillStyle = '#000';
            ctx.font = cap.font;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            var inkBottom = qrOffY + qrActual - quietPx;
            ctx.fillText(o.text, o.x + o.w / 2, inkBottom + capGapPx + cap.asc, innerW);
        }

        // ScanNCut cut lines (dashed) — preview only, never in the download.
        // With no printed border the sticker edge still gets an outer line;
        // an inward offset adds a second line showing where the blade lands.
        if (o.showCuts) {
            var cutLine = Math.max(1, Math.round(mmToPx(0.2)));
            ctx.setLineDash([mmToPx(0.8), mmToPx(0.5)]);
            ctx.strokeStyle = '#000';
            ctx.lineWidth = cutLine;
            if (o.borderPx === 0) {
                ctx.strokeRect(o.x + cutLine / 2, o.y + cutLine / 2, o.w - cutLine, o.h - cutLine);
            }
            if (o.cutPx !== 0) {
                ctx.strokeRect(o.x + o.cutPx, o.y + o.cutPx, o.w - 2 * o.cutPx, o.h - 2 * o.cutPx);
            }
            ctx.setLineDash([]);
        }
    }

    return { makeQr: makeQr, draw: draw, captionHeight: captionHeight };
})();
