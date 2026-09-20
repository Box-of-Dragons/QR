// Sheet rectangle packing — shared by the generator pages.
// Every function takes queue: items with .w/.h in px, and returns
// { placements: [{s, x, y}], overflow } in margin-relative coordinates.
// With repeat, the queue cycles until nothing more fits.
window.SheetPack = (function () {
    // Uniform grid: all cells are cellW × cellH, stickers centered inside.
    function grid(queue, innerW, innerH, cellW, cellH, gap, repeat) {
        var cols = Math.max(1, Math.floor((innerW + gap) / (cellW + gap)));
        var rows = Math.max(1, Math.floor((innerH + gap) / (cellH + gap)));
        var slots = cols * rows;
        var placements = [];
        for (var i = 0; i < slots && queue.length; i++) {
            if (i >= queue.length && !repeat) break;
            var s = queue[i % queue.length];
            // Items without measured .w/.h fill the cell exactly (uniform grid).
            var sw = s.w != null ? s.w : cellW;
            var sh = s.h != null ? s.h : cellH;
            var col = i % cols, row = Math.floor(i / cols);
            placements.push({
                s: s,
                x: col * (cellW + gap) + Math.floor((cellW - sw) / 2),
                y: row * (cellH + gap) + Math.floor((cellH - sh) / 2)
            });
        }
        return {
            placements: placements,
            overflow: Math.max(0, queue.length - placements.length),
            cols: cols, rows: rows, slots: slots
        };
    }

    // Shelf packing: stickers flow left-to-right in entry order; when one
    // doesn't fit the remaining row width a new row starts (height =
    // tallest sticker in it).
    function shelf(queue, innerW, innerH, gap, repeat) {
        var placements = [], overflow = 0;
        var x = 0, y = 0, shelfH = 0;
        var failed = {}, failedCount = 0; // stickers that can no longer fit
        var n = queue.length, i = 0;
        while (n && (repeat ? failedCount < n : i < n)) {
            var si = i % n;
            var s = queue[si];
            i++;
            if (failed[si]) continue;
            if (x > 0 && x + s.w > innerW) { y += shelfH + gap; x = 0; shelfH = 0; }
            // Too wide ever, or no vertical room left at this y — permanent,
            // since y only grows. Shorter stickers may still fit below.
            if (s.w > innerW || y + s.h > innerH) {
                failed[si] = true; failedCount++;
                if (!repeat) overflow++;
                continue;
            }
            placements.push({ s: s, x: x, y: y });
            x += s.w + gap;
            if (s.h > shelfH) shelfH = s.h;
        }
        return { placements: placements, overflow: overflow };
    }

    // MaxRects best-area-fit: keeps a list of free rectangles and puts each
    // sticker in the one with the least leftover area (short-side fit as
    // tiebreak), splitting overlapping free space after each placement.
    // Largest-side-first ordering packs tighter than entry order, so
    // stickers end up spatially scrambled. Each placed sticker carves out
    // the full gap on all four sides, so no sticker can be placed flush
    // against a neighbour's top or left edge.
    function maxRects(queue, innerW, innerH, gap, repeat) {
        var items = queue.slice().sort(function (a, b) {
            return (b.h - a.h) || (b.w - a.w);
        });
        var free = [{ x: 0, y: 0, w: innerW, h: innerH }];
        var placements = [], overflow = 0;
        var failed = {}, failedCount = 0;
        var n = items.length, i = 0;
        while (n && (repeat ? failedCount < n : i < n)) {
            var si = i % n;
            var s = items[si];
            i++;
            if (failed[si]) continue;
            var best = -1, bestArea = Infinity, bestShort = Infinity;
            for (var f = 0; f < free.length; f++) {
                var r = free[f];
                if (s.w > r.w || s.h > r.h) continue;
                var area = r.w * r.h - s.w * s.h;
                var short = Math.min(r.w - s.w, r.h - s.h);
                if (area < bestArea || (area === bestArea && short < bestShort)) {
                    best = f; bestArea = area; bestShort = short;
                }
            }
            if (best < 0) {
                failed[si] = true; failedCount++;
                if (!repeat) overflow++;
                continue;
            }
            var r = free[best];
            placements.push({ s: s, x: r.x, y: r.y });
            var px = r.x - gap, py = r.y - gap;
            var pw = s.w + 2 * gap, ph = s.h + 2 * gap;
            var next = [];
            free.forEach(function (fr) {
                if (px >= fr.x + fr.w || px + pw <= fr.x ||
                    py >= fr.y + fr.h || py + ph <= fr.y) {
                    next.push(fr); return; // no overlap
                }
                if (fr.x < px) next.push({ x: fr.x, y: fr.y, w: px - fr.x, h: fr.h });
                if (fr.x + fr.w > px + pw) next.push({ x: px + pw, y: fr.y, w: fr.x + fr.w - px - pw, h: fr.h });
                if (fr.y < py) next.push({ x: fr.x, y: fr.y, w: fr.w, h: py - fr.y });
                if (fr.y + fr.h > py + ph) next.push({ x: fr.x, y: py + ph, w: fr.w, h: fr.y + fr.h - py - ph });
            });
            // Drop rects fully contained in another.
            free = next.filter(function (a, ai) {
                return !next.some(function (b, bi) {
                    return bi !== ai && b.x <= a.x && b.y <= a.y &&
                        b.x + b.w >= a.x + a.w && b.y + b.h >= a.y + a.h;
                });
            });
        }
        return { placements: placements, overflow: overflow };
    }

    return { grid: grid, shelf: shelf, maxRects: maxRects };
})();
