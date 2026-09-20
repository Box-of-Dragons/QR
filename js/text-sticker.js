// Die-cut text sticker rendering — pure canvas code used by text-generator.
// No DOM access: every function takes explicit sizes/colours and draws onto
// canvases it creates or is handed.
window.TextSticker = (function () {
    var measureCanvas = document.createElement('canvas');

    function fontSpec(fontName, fontPx) {
        return '400 ' + fontPx + 'px "' + fontName + '", "Open Sans", sans-serif';
    }

    // Advance width of a line with manual letter spacing (px, may be negative).
    function lineWidth(ctx, line, letterSpacingPx) {
        var w = 0;
        for (var j = 0; j < line.length; j++) w += ctx.measureText(line[j]).width;
        return w + letterSpacingPx * Math.max(0, line.length - 1);
    }

    // Calls fn(char, centerX, charWidth) for each char, applying letterSpacingPx
    // manually — supports negatives and browsers without canvas letterSpacing.
    function eachChar(ctx, line, cx, letterSpacingPx, fn) {
        var widths = [];
        for (var j = 0; j < line.length; j++) widths.push(ctx.measureText(line[j]).width);
        var total = widths.reduce(function (a, b) { return a + b; }, 0)
            + letterSpacingPx * Math.max(0, line.length - 1);
        var x = cx - total / 2;
        for (var j = 0; j < line.length; j++) {
            fn(line[j], x + widths[j] / 2, widths[j]);
            x += widths[j] + letterSpacingPx;
        }
    }

    // Measures a sticker's pixel size for the given lines at current options.
    function measureSticker(fontName, lines, fontPx, haloPx, edgePx, padPx, rowGapPx, letterSpacingPx) {
        var ctx = measureCanvas.getContext('2d');
        ctx.font = fontSpec(fontName, fontPx);
        ctx.letterSpacing = '0px';
        var textW = 0;
        lines.forEach(function (line) {
            textW = Math.max(textW, lineWidth(ctx, line, letterSpacingPx));
        });
        var textH = Math.max(fontPx, lines.length * fontPx + (lines.length - 1) * rowGapPx);
        var outlinePx = fontPx * 0.07;
        return {
            w: Math.ceil(textW + 2 * (outlinePx + haloPx + edgePx + padPx)),
            h: Math.ceil(textH + 2 * (outlinePx + haloPx + edgePx + padPx))
        };
    }

    // Strokes the text plus bridge geometry at lineWidth 2r — a vector
    // dilation that merges letters, lines and bridges into one smooth
    // silhouette (no pixelation). Bridges sit in the gaps, so counters
    // (O, A, etc.) stay open.
    function paintSilhouette(ctx, s, cx, lineY, fontPx, letterSpacingPx, r) {
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = 2 * r;
        s.lines.forEach(function (line, i) {
            eachChar(ctx, line, cx, letterSpacingPx, function (ch, chx) {
                ctx.strokeText(ch, chx, lineY(i));
            });
        });
        // Vertical bridges between consecutive lines (neck = narrower line).
        // Plain rects — ends sit inside the text silhouette, so flat edges
        // are invisible and there's no round-cap bulge in the gap.
        var prevFill = ctx.fillStyle;
        for (var i = 0; i < s.lines.length - 1; i++) {
            var w1 = lineWidth(ctx, s.lines[i], letterSpacingPx);
            var w2 = lineWidth(ctx, s.lines[i + 1], letterSpacingPx);
            var bw = Math.min(w1, w2) * 0.8;
            var y1 = lineY(i) + fontPx * 0.3;
            var y2 = lineY(i + 1) - fontPx * 0.3;
            if (y2 <= y1) continue; // lines already overlap
            ctx.fillStyle = ctx.strokeStyle;
            ctx.fillRect(cx - (bw + 2 * r) / 2, y1, bw + 2 * r, y2 - y1);
        }
        // Horizontal bridges across inter-letter ink gaps
        if (letterSpacingPx > 0) {
            var bh = fontPx * 0.24 + 2 * r;
            s.lines.forEach(function (line, i) {
                var prevEnd = null;
                eachChar(ctx, line, cx, letterSpacingPx, function (ch, chx, cw) {
                    var start = chx - cw / 2;
                    if (prevEnd !== null && start > prevEnd) {
                        ctx.fillStyle = ctx.strokeStyle;
                        ctx.fillRect(prevEnd - 2, lineY(i) - bh / 2,
                            start - prevEnd + 4, bh);
                    }
                    prevEnd = chx + cw / 2;
                });
            });
        }
        ctx.fillStyle = prevFill;
    }

    // Flood-fills the fully-transparent pixels connected to the border, then
    // repaints everything left — enclosed counters, pockets and the faint
    // semi-transparent seams left where converging stroke fronts meet all
    // become solid. The silhouette's outer AA fringe loses ~1px of softness,
    // but that edge sits under the black outline anyway. Monochrome masks.
    function fillHoles(ctx, color) {
        var w = ctx.canvas.width, h = ctx.canvas.height;
        var img = ctx.getImageData(0, 0, w, h);
        var d = img.data;
        var seen = new Uint8Array(w * h);
        var stack = [];
        var x, y, p;
        for (x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
        for (y = 0; y < h; y++) { stack.push(y * w, y * w + w - 1); }
        while (stack.length) {
            p = stack.pop();
            if (seen[p] || d[p * 4 + 3] !== 0) continue;
            seen[p] = 1;
            var px = p % w, py = (p / w) | 0;
            if (px > 0) stack.push(p - 1);
            if (px < w - 1) stack.push(p + 1);
            if (py > 0) stack.push(p - w);
            if (py < h - 1) stack.push(p + w);
        }
        if (color.length === 4) color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
        var r8 = parseInt(color.slice(1, 3), 16);
        var g8 = parseInt(color.slice(3, 5), 16);
        var b8 = parseInt(color.slice(5, 7), 16);
        // Monochrome masks only — every enclosed pixel is repainted, so
        // anti-aliased ring edges inside holes don't survive as seams.
        for (p = 0; p < w * h; p++) {
            if (!seen[p]) {
                d[p * 4] = r8; d[p * 4 + 1] = g8; d[p * 4 + 2] = b8; d[p * 4 + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
    }

    // Renders one die-cut text sticker to its own canvas (cached per row,
    // then blitted into each sheet slot). Layers: black edge -> vinyl-coloured
    // contour -> optional black letter keyline -> letter fill.
    // opts: { filled, textColour, vinyl }
    function buildStickerCanvas(fontName, s, fontPx, haloPx, edgePx, rowGapPx, letterSpacingPx, opts) {
        var w = s.w, h = s.h;
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        var ctx = c.getContext('2d');
        var cx = w / 2, cy = h / 2;
        var lineH = fontPx + rowGapPx;
        var outlinePx = fontPx * 0.07;
        var lineY = function (i) { return cy + (i - (s.lines.length - 1) / 2) * lineH; };

        ctx.font = fontSpec(fontName, fontPx);
        ctx.letterSpacing = '0px';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        if (haloPx > 0) {
            ctx.strokeStyle = '#000';
            paintSilhouette(ctx, s, cx, lineY, fontPx, letterSpacingPx, haloPx + outlinePx + edgePx);
            // Vinyl contour on its own layer: stroking rings every contour —
            // including glyph counters (O, D). Filling the layer's enclosed
            // holes makes it one solid silhouette, so blitting it over the
            // black edge wipes the stray inner rings completely.
            var sil = document.createElement('canvas');
            sil.width = w; sil.height = h;
            var sctx = sil.getContext('2d');
            sctx.font = ctx.font;
            sctx.textAlign = 'center';
            sctx.textBaseline = 'middle';
            sctx.strokeStyle = opts.vinyl;
            paintSilhouette(sctx, s, cx, lineY, fontPx, letterSpacingPx, haloPx + outlinePx);
            fillHoles(sctx, opts.vinyl);
            ctx.drawImage(sil, 0, 0);
        }

        // Per-char fill (+ optional keyline) on its own layer: with
        // negative spacing each letter keeps its own outline instead of
        // merging into the neighbour's fill. The keyline is fillText dilated
        // around a ring — strokeText would also draw the degenerate interior
        // subpaths some fonts carry (e.g. Luckiest Guy's O counters).
        var letters = document.createElement('canvas');
        letters.width = w; letters.height = h;
        var lctx = letters.getContext('2d');
        lctx.font = ctx.font;
        lctx.textAlign = 'center';
        lctx.textBaseline = 'middle';
        var K = 16;
        s.lines.forEach(function (line, i) {
            var ly = lineY(i);
            eachChar(lctx, line, cx, letterSpacingPx, function (ch, chx) {
                if (!opts.filled) {
                    lctx.fillStyle = '#000';
                    for (var k = 0; k < K; k++) {
                        var a = k * Math.PI * 2 / K;
                        lctx.fillText(ch, chx + Math.cos(a) * outlinePx, ly + Math.sin(a) * outlinePx);
                    }
                }
                lctx.fillStyle = opts.textColour;
                lctx.fillText(ch, chx, ly);
            });
        });
        ctx.drawImage(letters, 0, 0);
        return c;
    }

    return {
        fontSpec: fontSpec,
        lineWidth: lineWidth,
        eachChar: eachChar,
        measureSticker: measureSticker,
        buildStickerCanvas: buildStickerCanvas
    };
})();
