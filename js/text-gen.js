// Text Sticker Generator page — rows table, options, persistence, and
// sheet assembly. Rendering lives in js/text-sticker.js (TextSticker),
// packing in js/sheet-pack.js (SheetPack), helpers in js/gen-shared.js.
(function () {
    var mmToPx = GenShared.mmToPx, pxToMm = GenShared.pxToMm;
    var MIN_PAD_MM = 0.25; // just enough to clear the silhouette's AA fringe
    var COLS = ['gen-text', 'gen-count'];
    var rowsEl = document.getElementById('gen-rows');
    var fontEl = document.getElementById('gen-font');
    var textSizeEl = document.getElementById('gen-textsize');
    var textStyleEl = document.getElementById('gen-textstyle');
    var textColourEl = document.getElementById('gen-textcolour');
    var vinylEl = document.getElementById('gen-vinyl');
    var borderEl = document.getElementById('gen-border');
    var rowGapEl = document.getElementById('gen-rowgap');
    var letterSpaceEl = document.getElementById('gen-letterspace');
    var pageEl = document.getElementById('gen-page');
    var marginEl = document.getElementById('gen-margin');
    var layoutEl = document.getElementById('gen-layout');
    var gapEl = document.getElementById('gen-gap');
    var fillEl = document.getElementById('gen-fill');
    var cutLinesEl = document.getElementById('gen-cutlines');
    var sheetCanvas = document.getElementById('gen-sheet');
    var guideEl = document.getElementById('gen-margin-guide');
    var infoEl = document.getElementById('gen-sheet-info');

    function addRow(text, count) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td><textarea class="gen-text" rows="1" placeholder="Sticker text"></textarea>' +
                       '<span class="gen-size caption"></span></td>' +
                       '<td class="gen-count"><input type="number" class="gen-count" min="1" value="1"></td>' +
                       '<td class="gen-del-cell"><button class="gen-del" type="button" title="Remove row">×</button></td>';
        var ta = tr.querySelector('.gen-text');
        ta.value = text || '';
        ta.addEventListener('input', function () { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; });
        requestAnimationFrame(function () { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; });
        tr.querySelector('input.gen-count').value = count || 1;
        tr.querySelector('.gen-del').addEventListener('click', function () { tr.remove(); render(); });
        tr.querySelectorAll('input, textarea').forEach(function (inp) { inp.addEventListener('input', render); });
        rowsEl.appendChild(tr);
        return tr;
    }

    function getStickers() {
        var out = [];
        rowsEl.querySelectorAll('tr').forEach(function (tr) {
            var raw = tr.querySelector('.gen-text').value.trim();
            var count = Math.max(1, parseInt(tr.querySelector('input.gen-count').value, 10) || 1);
            if (raw) out.push({ lines: raw.split(/\n/).map(function (l) { return l.replace(/\s+$/, ''); }), count: count, tr: tr });
        });
        return out;
    }

    var LS_KEY = 'qr-textgen-v1';

    // Option elements keyed by their saved-state name — shared by
    // persistence and saved sets.
    var OPTS = {
        font: fontEl, textsize: textSizeEl, border: borderEl,
        textstyle: textStyleEl, textcolour: textColourEl, vinyl: vinylEl,
        rowgap: rowGapEl, letterspace: letterSpaceEl,
        page: pageEl, margin: marginEl, layout: layoutEl,
        gap: gapEl, fill: fillEl, cutlines: cutLinesEl
    };

    // {rows, opts} — the shape persisted to localStorage and to saved sets.
    function currentState() {
        var rows = [];
        rowsEl.querySelectorAll('tr').forEach(function (tr) {
            rows.push({
                text: tr.querySelector('.gen-text').value.replace(/\n/g, '\\n'),
                count: tr.querySelector('input.gen-count').value
            });
        });
        var opts = {};
        Object.keys(OPTS).forEach(function (k) { opts[k] = OPTS[k].value; });
        return { rows: rows, opts: opts };
    }

    function applyState(st) {
        if (!st) return;
        rowsEl.innerHTML = '';
        if (st.opts) Object.keys(st.opts).forEach(function (k) {
            if (OPTS[k] && st.opts[k] != null) OPTS[k].value = st.opts[k];
        });
        (st.rows || []).forEach(function (r) { addRow((r.text || '').replace(/\\n/g, '\n'), r.count); });
    }

    function saveState() {
        try {
            localStorage.setItem(LS_KEY, JSON.stringify(currentState()));
        } catch (e) {}
    }

    function loadState() {
        var st;
        try { st = JSON.parse(localStorage.getItem(LS_KEY)); } catch (e) {}
        if (!st) return false;
        applyState(st);
        return true;
    }

    // Excel/Sheets paste: TSV fills the grid starting at the focused cell
    GenShared.attachTsvPaste(rowsEl, COLS, addRow, render);

    document.getElementById('gen-add').addEventListener('click', function () { addRow().querySelector('.gen-text').focus(); });

    function render() {
        var stickers = getStickers();
        var textMm = parseInt(textSizeEl.value, 10);
        var borderMm = parseFloat(borderEl.value);
        var marginMm = parseInt(marginEl.value, 10);
        var single = pageEl.value === 'single';
        var repeat = fillEl.value === 'repeat';

        var fontPx = mmToPx(textMm);
        // Spacing is edge-to-edge: each sticker carries half the gap as its
        // transparent pad, so packers tile boxes flush and the option sets
        // the real distance between die-cut edges. Single stickers get just
        // the floor — they aren't packed against anything.
        var padPx = Math.max(mmToPx(MIN_PAD_MM),
            single ? 0 : Math.round(mmToPx(parseFloat(gapEl.value)) / 2));
        var rowGapPx = mmToPx(parseFloat(rowGapEl.value));
        var letterSpacingPx = mmToPx(parseFloat(letterSpaceEl.value));
        // Contour halo = border option in mm; black edge scales with font size
        var haloPx = mmToPx(borderMm);
        var edgePx = haloPx > 0 ? fontPx * 0.035 : 0;

        // Uniform cell = largest sticker; each sticker centers in its cell.
        // Per-row size caption under each text input.
        rowsEl.querySelectorAll('.gen-size').forEach(function (el) { el.textContent = ''; });
        var cellW = 0, cellH = 0;
        stickers.forEach(function (s) {
            var size = TextSticker.measureSticker(fontEl.value, s.lines, fontPx, haloPx, edgePx, padPx, rowGapPx, letterSpacingPx);
            s.w = size.w; s.h = size.h;
            cellW = Math.max(cellW, size.w);
            cellH = Math.max(cellH, size.h);
            var wmm = pxToMm(size.w);
            var hmm = pxToMm(size.h);
            s.tr.querySelector('.gen-size').textContent = wmm + ' × ' + hmm + ' mm';
        });
        if (!stickers.length) { cellW = mmToPx(38); cellH = mmToPx(38); }

        var stickerOpts = {
            filled: textStyleEl.value === 'filled',
            textColour: textColourEl.value,
            vinyl: vinylEl.value
        };

        // Render each unique sticker once, then blit into every slot
        stickers.forEach(function (s) {
            s.canvas = TextSticker.buildStickerCanvas(fontEl.value, s, fontPx, haloPx, edgePx, rowGapPx, letterSpacingPx, stickerOpts);
        });

        var cellWmm = pxToMm(cellW);
        var cellHmm = pxToMm(cellH);
        var sizeLabel = cellWmm + ' × ' + cellHmm + ' mm';

        var ctx = sheetCanvas.getContext('2d');

        saveState();

        if (single) {
            var sw = stickers.length ? stickers[0].w : cellW;
            var sh = stickers.length ? stickers[0].h : cellH;
            sheetCanvas.width = sw;
            sheetCanvas.height = sh;
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, sw, sh);
            if (stickers.length) {
                ctx.drawImage(stickers[0].canvas, 0, 0);
            }
            var swmm = pxToMm(sw);
            var shmm = pxToMm(sh);
            infoEl.textContent = 'Single sticker — ' + swmm + ' × ' + shmm + ' mm';
            guideEl.style.display = 'none';
            return;
        }

        var pageParts = pageEl.value.split('x');
        var pageWmm = parseInt(pageParts[0], 10);
        var pageHmm = parseInt(pageParts[1], 10);
        var pageW = mmToPx(pageWmm);
        var pageH = mmToPx(pageHmm);
        var margin = mmToPx(marginMm);
        var gap = 0; // spacing is inside each sticker's pad, so boxes tile flush
        var innerW = pageW - 2 * margin;
        var innerH = pageH - 2 * margin;
        var layout = layoutEl.value;

        sheetCanvas.width = pageW;
        sheetCanvas.height = pageH;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, pageW, pageH);

        // Expand rows by count, then place. All modes produce placements
        // in margin-relative coordinates.
        var queue = GenShared.expandQueue(stickers);
        var result = layout === 'grid'
            ? SheetPack.grid(queue, innerW, innerH, cellW, cellH, gap, repeat)
            : layout === 'shelf'
                ? SheetPack.shelf(queue, innerW, innerH, gap, repeat)
                : SheetPack.maxRects(queue, innerW, innerH, gap, repeat);
        var placements = result.placements, overflow = result.overflow;

        placements.forEach(function (p) {
            ctx.drawImage(p.s.canvas, margin + p.x, margin + p.y);
        });
        var placed = placements.length;

        // Dashed cut lines at each sticker's box edge — exported in the PNG
        if (cutLinesEl.value === 'show') {
            ctx.strokeStyle = '#888';
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 6]);
            placements.forEach(function (p) {
                ctx.strokeRect(margin + p.x, margin + p.y, p.s.w, p.s.h);
            });
            ctx.setLineDash([]);
        }

        // Margin guide bounds exactly where stickers are placed
        GenShared.positionMarginGuide(guideEl, marginMm, pageWmm, pageHmm);

        var overflowNote = GenShared.overflowNote(overflow);
        if (!stickers.length) {
            infoEl.textContent = 'Add text to get started — ' + pageWmm + ' × ' + pageHmm + ' mm sheet';
        } else if (layout === 'grid') {
            infoEl.textContent = 'Sticker cell ' + sizeLabel + ' — ' + placed + ' of ' + result.slots +
                ' slots filled (' + result.cols + ' × ' + result.rows + ') on ' + pageWmm + ' × ' + pageHmm + ' mm' + overflowNote;
        } else {
            infoEl.textContent = placed + ' sticker' + (placed === 1 ? '' : 's') + ' placed on ' +
                pageWmm + ' × ' + pageHmm + ' mm' + (repeat ? ' — repeated to fill' : '') + overflowNote;
        }
    }

    [fontEl, textSizeEl, textStyleEl, borderEl, rowGapEl, letterSpaceEl, pageEl, marginEl, layoutEl, gapEl, fillEl, cutLinesEl].forEach(function (el) {
        el.addEventListener('change', render);
    });
    // Colour inputs fire 'input' live while dragging the picker
    [textColourEl, vinylEl].forEach(function (el) {
        el.addEventListener('input', render);
    });

    // Re-render once the chosen display font has actually loaded
    fontEl.addEventListener('change', function () {
        if (document.fonts && document.fonts.load) {
            document.fonts.load(TextSticker.fontSpec(fontEl.value, 100)).then(render);
        }
    });
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(render);
    }

    document.getElementById('gen-download').addEventListener('click', function () {
        GenShared.downloadCanvas(sheetCanvas, pageEl.value === 'single'
            ? 'text-sticker.png'
            : 'text-sticker-sheet-' + pageEl.value + 'mm.png');
    });

    QrStore.mount({
        type: 'text',
        storageKey: 'qr-textgen-sets',
        mountEl: document.getElementById('gen-store'),
        getState: currentState,
        applyState: function (st) {
            applyState(st);
            render();
        }
    });

    if (!loadState()) addRow('DO NOT\nTHE MACHINE', 1);
    render();
})();
