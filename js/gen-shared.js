// Shared helpers for the generator pages (generator.html, text-generator.html).
// Sheet rendering uses window.SheetPack from js/sheet-pack.js.
window.GenShared = (function () {
    var DPI = 300, MM_PER_IN = 25.4;

    function mmToPx(mm) { return Math.round(mm * DPI / MM_PER_IN); }
    function pxToMm(px) { return Math.round(px / DPI * MM_PER_IN * 10) / 10; }

    // Expands sticker rows into a flat queue by count.
    function expandQueue(stickers) {
        var queue = [];
        stickers.forEach(function (s) {
            for (var i = 0; i < s.count; i++) queue.push(s);
        });
        return queue;
    }

    function overflowNote(overflow) {
        return overflow ? ' — ' + overflow + " didn't fit" : '';
    }

    // Margin guide as a DOM overlay — stays crisp at any canvas scale
    // and never ends up in the PNG export.
    function positionMarginGuide(guideEl, marginMm, pageWmm, pageHmm) {
        guideEl.style.display = 'block';
        guideEl.style.left = (marginMm / pageWmm * 100) + '%';
        guideEl.style.top = (marginMm / pageHmm * 100) + '%';
        guideEl.style.right = (marginMm / pageWmm * 100) + '%';
        guideEl.style.bottom = (marginMm / pageHmm * 100) + '%';
    }

    // Excel/Sheets paste: TSV fills the grid starting at the focused cell.
    // cols is the ordered list of input class names per row.
    function attachTsvPaste(rowsEl, cols, addRow, render) {
        rowsEl.addEventListener('paste', function (e) {
            var data = (e.clipboardData || window.clipboardData).getData('text');
            if (!data || (data.indexOf('\t') === -1 && data.indexOf('\n') === -1)) return; // single cell — default paste
            e.preventDefault();
            var rows = data.replace(/\r/g, '').split('\n').filter(function (r) { return r.length; });
            var startTr = e.target.closest('tr');
            var startIdx = Array.prototype.indexOf.call(rowsEl.children, startTr);
            var startCol = -1;
            cols.forEach(function (cls, i) { if (e.target.classList.contains(cls)) startCol = i; });
            if (startCol < 0) startCol = 0;
            rows.forEach(function (row, i) {
                var cells = row.split('\t');
                var tr = rowsEl.children[startIdx + i] || addRow();
                cells.forEach(function (cell, j) {
                    var col = startCol + j;
                    if (col < cols.length) tr.querySelector('.' + cols[col]).value = cell.trim();
                });
            });
            render();
        });
    }

    function downloadCanvas(canvas, filename) {
        var a = document.createElement('a');
        a.download = filename;
        a.href = canvas.toDataURL('image/png');
        a.click();
    }

    return {
        DPI: DPI, MM_PER_IN: MM_PER_IN,
        mmToPx: mmToPx, pxToMm: pxToMm,
        expandQueue: expandQueue, overflowNote: overflowNote,
        positionMarginGuide: positionMarginGuide,
        attachTsvPaste: attachTsvPaste, downloadCanvas: downloadCanvas
    };
})();
