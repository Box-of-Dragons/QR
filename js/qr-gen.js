/* qr-gen.js - QR sticker sheet generator page logic.
 * Depends on: qrcode-generator (CDN), GenShared, SheetPack, QrSticker,
 * and window.SITE_FOOTER (footer-links.js) for the preset chips.
 */
(function () {
    var mmToPx = GenShared.mmToPx;
    var makeQr = QrSticker.makeQr;
    var TEXT_MM = 6;
    var hideCutLines = false;
    var COLS = ['gen-url', 'gen-text', 'gen-count'];
    var rowsEl = document.getElementById('gen-rows');
    var sheetCanvas = document.getElementById('gen-sheet');
    var guideEl = document.getElementById('gen-margin-guide');
    var infoEl = document.getElementById('gen-sheet-info');

    // Option elements keyed by their saved-state name — the single list used
    // for persistence and change wiring.
    var OPTS = {
        size: document.getElementById('gen-size'),
        sizeCustom: document.getElementById('gen-size-custom'),
        height: document.getElementById('gen-height'),
        heightCustom: document.getElementById('gen-height-custom'),
        border: document.getElementById('gen-border'),
        borderCustom: document.getElementById('gen-border-custom'),
        padding: document.getElementById('gen-padding'),
        paddingCustom: document.getElementById('gen-padding-custom'),
        page: document.getElementById('gen-page'),
        pageCustom: document.getElementById('gen-page-custom'),
        margin: document.getElementById('gen-margin'),
        marginCustom: document.getElementById('gen-margin-custom'),
        gap: document.getElementById('gen-gap'),
        gapCustom: document.getElementById('gen-gap-custom'),
        textgap: document.getElementById('gen-textgap'),
        textgapCustom: document.getElementById('gen-textgap-custom'),
        bottompad: document.getElementById('gen-bottompad'),
        bottompadCustom: document.getElementById('gen-bottompad-custom'),
        fill: document.getElementById('gen-fill'),
        detect: document.getElementById('gen-detect'),
        offset: document.getElementById('gen-offset'),
        offsetCustom: document.getElementById('gen-offset-custom')
    };

    function addRow(url, text, count) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td><input type="text" class="gen-url" placeholder="https://…"></td>' +
                       '<td><textarea class="gen-text" rows="1" placeholder="Caption"></textarea></td>' +
                       '<td class="gen-count"><input type="number" class="gen-count" min="1" value="1"></td>' +
                       '<td class="gen-del-cell"><button class="gen-del" type="button" title="Remove row">×</button></td>';
        tr.querySelector('.gen-url').value = url || '';
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
            var url = tr.querySelector('.gen-url').value.trim();
            var text = tr.querySelector('.gen-text').value.trim();
            var count = Math.max(1, parseInt(tr.querySelector('input.gen-count').value, 10) || 1);
            if (url) out.push({ url: url, text: text, count: count });
        });
        return out;
    }

    var LS_KEY = 'qr-gen-v1';

    // {rows, opts} — the shape persisted to localStorage and to saved sets.
    function currentState() {
        var rows = [];
        rowsEl.querySelectorAll('tr').forEach(function (tr) {
            rows.push({
                url: tr.querySelector('.gen-url').value,
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
        (st.rows || []).forEach(function (r) { addRow(r.url, (r.text || '').replace(/\\n/g, '\n'), r.count); });
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

    document.getElementById('gen-add').addEventListener('click', function () { addRow().querySelector('.gen-url').focus(); });

    // Preset chips — the novelty pages only (links between the two separators
    // in the shared footer list; skips Home and the generators).
    // Clicking one prefills a new URL row with the production URL.
    var presetsEl = document.getElementById('gen-presets');
    var presetColors = ['gold', 'sand', 'sage', 'olive', 'sky', 'stone', 'rose', 'clay',
                        'plum', 'ink', 'moss', 'lavender', 'peach', 'slate', 'rust', 'berry'];
    for (var ci = presetColors.length - 1; ci > 0; ci--) {
        var cj = Math.floor(Math.random() * (ci + 1));
        var ct = presetColors[ci]; presetColors[ci] = presetColors[cj]; presetColors[cj] = ct;
    }
    var presetSection = 0;
    var presetIndex = 0;
    ((window.SITE_FOOTER && window.SITE_FOOTER.links) || []).forEach(function (l) {
        if (l.separator) { presetSection++; return; }
        if (presetSection !== 1) return;
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip color-pair-' + presetColors[presetIndex++ % presetColors.length];
        b.textContent = l.label;
        b.addEventListener('click', function () {
            var pageId = l.href.slice(l.href.lastIndexOf('/') + 1).replace(/\.html$/, '');
            addRow('https://qr.misssponto.me.uk/?page=' + pageId, l.label.toUpperCase(), 1);
            render();
        });
        presetsEl.appendChild(b);
    });

    // Every 'fooCustom' input shadows its 'foo' select — shown only when the
    // select is on 'custom'. optValue resolves the effective value either way.
    function syncCustomInputs() {
        Object.keys(OPTS).forEach(function (k) {
            if (/Custom$/.test(k)) OPTS[k].hidden = OPTS[k.slice(0, -6)].value !== 'custom';
        });
    }

    function optValue(name) {
        var v = OPTS[name].value;
        return v === 'custom' ? OPTS[name + 'Custom'].value : v;
    }

    function numOpt(name, fallback) {
        var v = parseFloat(optValue(name));
        return isFinite(v) ? v : fallback;
    }

    function stickerWidthMm() {
        var v = numOpt('size', 38);
        return v > 0 ? v : 38;
    }

    function stickerHeightMm() {
        if (OPTS.height.value === 'auto') return null;
        var v = numOpt('height', 0);
        return v > 0 ? v : null;
    }

    function render() {
        syncCustomInputs();
        var stickers = getStickers();
        var sizeMm = stickerWidthMm();
        var borderMm = numOpt('border', 1);
        var marginMm = numOpt('margin', 6);
        var single = OPTS.page.value === 'single';
        var repeat = OPTS.fill.value === 'repeat';

        var borderPx = mmToPx(borderMm);
        // Auto padding = the QR spec's 4-module quiet zone (and no extra pad);
        // a fixed value is the exact visual gap around the modules.
        var padAuto = OPTS.padding.value === 'auto';
        var padPx = padAuto ? 0 : mmToPx(numOpt('padding', 0));
        var quiet = padAuto ? 4 : 0;
        var offsetPx = mmToPx(numOpt('offset', 0));
        // Line detection cuts the centre of the detected line; outline
        // detection cuts its outer edge. Offsets apply on top of that —
        // positive cutPx insets the guide, negative pushes it outside
        // the sticker edge.
        var cutPx = (OPTS.detect.value === 'line' ? mmToPx(borderMm) / 2 : 0) - offsetPx;
        var stickerW = mmToPx(sizeMm);
        var anyText = stickers.some(function (s) { return s.text; });
        var textGapAuto = OPTS.textgap.value === 'auto';
        var textGapPx = anyText && !textGapAuto ? mmToPx(numOpt('textgap', 0)) : 0;
        var bottomPadAuto = OPTS.bottompad.value === 'auto';
        var bottomPadPx = anyText && !bottomPadAuto ? mmToPx(numOpt('bottompad', 0)) : 0;
        var textPx = anyText ? mmToPx(TEXT_MM) : 0;

        var ctx = sheetCanvas.getContext('2d');

        // Height: a fixed value is uniform; Auto sizes each sticker to its
        // own caption — width + space below the QR square the caption needs.
        // Auto values flex to absorb the leftover band below the QR ink —
        // the height targets each auto side at the padding
        // (padPx + quiet zone); fixed values are exact.
        var stickerHmm = stickerHeightMm();
        var uniformH = !!stickerHmm;
        var innerWEst = stickerW - 2 * (borderPx + padPx);
        var maxH = stickerW;
        stickers.forEach(function (s) {
            var reservePx = 0;
            if (s.text) {
                var countI = makeQr(s.url).getModuleCount();
                var cellEst = Math.max(1, Math.floor(innerWEst / (countI + quiet * 2)));
                var remEst = Math.floor((innerWEst - cellEst * (countI + quiet * 2)) / 2);
                var glyphH = QrSticker.captionHeight(ctx, textPx, s.text).glyphH;
                var padEst = padPx + quiet * cellEst;
                var gapEst = textGapAuto ? padEst : textGapPx;
                var botEst = bottomPadAuto ? padEst : bottomPadPx;
                var belowSq = gapEst + botEst + glyphH - quiet * cellEst
                    - (bottomPadAuto ? remEst : 0);
                reservePx = Math.max(0, belowSq);
            }
            s.w = stickerW;
            s.h = uniformH ? mmToPx(stickerHmm) : stickerW + reservePx;
            if (s.h > maxH) maxH = s.h;
        });
        var stickerH = uniformH ? mmToPx(stickerHmm) : maxH;
        var sameH = stickers.every(function (s) { return s.h === maxH; });
        var sizeLabel = sizeMm + ' × ' + GenShared.pxToMm(stickerH) + ' mm' +
            (uniformH || sameH ? '' : ' max');

        saveState();

        function place(x, y, s) {
            QrSticker.draw(ctx, {
                x: x, y: y, w: stickerW, h: s.h,
                borderPx: borderPx, padPx: padPx,
                textGapPx: textGapPx, textGapAuto: textGapAuto,
                bottomPadPx: bottomPadPx, bottomPadAuto: bottomPadAuto,
                textPx: textPx, text: s.text,
                qr: makeQr(s.url), cutPx: cutPx, quiet: quiet,
                showCuts: !hideCutLines
            });
        }

        if (single) {
            var singleH = stickers.length ? stickers[0].h : stickerW;
            sheetCanvas.width = stickerW;
            sheetCanvas.height = singleH;
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, stickerW, singleH);
            if (stickers.length) place(0, 0, stickers[0]);
            infoEl.textContent = 'Single sticker — ' + sizeMm + ' × ' + GenShared.pxToMm(singleH) + ' mm';
            guideEl.style.display = 'none';
            return;
        }

        var pageParts = optValue('page').toLowerCase().replace('×', 'x').split('x');
        var pageWmm = parseFloat(pageParts[0]) || 210;
        var pageHmm = parseFloat(pageParts[1]) || 297;
        var pageW = mmToPx(pageWmm);
        var pageH = mmToPx(pageHmm);
        var margin = mmToPx(marginMm);
        var gap = mmToPx(numOpt('gap', 5));
        var innerW = pageW - 2 * margin;
        var innerH = pageH - 2 * margin;

        sheetCanvas.width = pageW;
        sheetCanvas.height = pageH;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, pageW, pageH);

        // Uniform heights → grid (neat cells); variable auto heights → shelf
        // rows (each row's height is its tallest sticker, columns still align
        // since widths are uniform). Queue expands rows by count.
        var queue = GenShared.expandQueue(stickers);
        var result = uniformH
            ? SheetPack.grid(queue, innerW, innerH, stickerW, stickerH, gap, repeat)
            : SheetPack.shelf(queue, innerW, innerH, gap, repeat);
        result.placements.forEach(function (p) {
            place(margin + p.x, margin + p.y, p.s);
        });
        var placed = result.placements.length;

        // Margin guide bounds exactly where stickers are placed
        GenShared.positionMarginGuide(guideEl, marginMm, pageWmm, pageHmm);

        var sheetDesc = 'Sticker ' + sizeLabel + ' on ' + pageWmm + ' × ' + pageHmm + ' mm';
        if (!stickers.length) {
            infoEl.textContent = uniformH
                ? 'Sticker ' + sizeLabel + ' — add a URL to get started (' + result.slots + ' slots, ' + result.cols + ' × ' + result.rows + ', on ' + pageWmm + ' × ' + pageHmm + ' mm)'
                : sheetDesc + ' — add a URL to get started';
        } else {
            infoEl.textContent = uniformH
                ? 'Sticker ' + sizeLabel + ' — ' + placed + ' of ' + result.slots + ' slots filled (' + result.cols + ' × ' + result.rows + ') on ' + pageWmm + ' × ' + pageHmm + ' mm' + GenShared.overflowNote(result.overflow)
                : sheetDesc + ' — ' + placed + ' placed' + GenShared.overflowNote(result.overflow);
        }
    }

    Object.keys(OPTS).forEach(function (k) {
        OPTS[k].addEventListener('change', render);
        // Custom mm inputs re-render live, not just on commit
        if (/Custom$/.test(k)) OPTS[k].addEventListener('input', render);
    });

    document.getElementById('gen-download').addEventListener('click', function () {
        hideCutLines = true;
        render();
        var pageName = optValue('page').toLowerCase().replace(/[^0-9x.]/g, '');
        GenShared.downloadCanvas(sheetCanvas, OPTS.page.value === 'single'
            ? 'qr-sticker-' + stickerWidthMm() + 'mm.png'
            : 'qr-sheet-' + pageName + 'mm-' + stickerWidthMm() + 'mm-stickers.png');
        hideCutLines = false;
        render();
    });

    QrStore.mount({
        type: 'qr',
        storageKey: 'qr-gen-sets',
        mountEl: document.getElementById('gen-store'),
        getState: currentState,
        applyState: function (st) {
            applyState(st);
            syncCustomInputs();
            render();
        }
    });

    if (!loadState()) addRow('https://qr.misssponto.me.uk/?page=scan', 'SCAN ME', 1);
    syncCustomInputs();
    render();
})();
