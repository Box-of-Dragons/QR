/* qr-store.js - named saved-set storage for the generator pages.
 * Signed in → the {rows, opts} payload lives in the auth database via the
 * Better Auth sticker-set endpoints; signed out or unreachable → a
 * localStorage store on this browser. Same idea as JSketcher's
 * remoteProjectService: remote first, local fallback, identical UI.
 *
 * window.QrStore.mount({ type, storageKey, mountEl, getState, applyState })
 *   type       'qr' | 'text' — which generator produced the set (qr_type)
 *   storageKey localStorage key for the browser-local set list
 *   mountEl    element the UI renders into
 *   getState() → {rows, opts} — same shape the pages persist to localStorage
 *   applyState(data) — apply {rows, opts} back onto the page + re-render
 */
window.QrStore = (function () {

    function authBaseUrl() {
        var host = window.location.hostname.toLowerCase();
        var isLocal = host === 'localhost' || host === '127.0.0.1' || host.indexOf('.ddev.site') !== -1;
        return isLocal ? 'http://localhost:3000' : 'https://auth.misssponto.me.uk';
    }

    function signInUrl() {
        return authBaseUrl() + '/';
    }

    function request(path, init) {
        return fetch(authBaseUrl() + '/api/auth/sticker-set' + path, Object.assign({
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        }, init)).then(function (response) {
            if (response.status === 401) return null;
            if (!response.ok) throw new Error('Sticker set API failed: ' + response.status);
            return response.json();
        });
    }

    function remoteApi(type) {
        return {
            list: function () {
                return request('/list?type=' + encodeURIComponent(type)).then(function (r) {
                    return r ? r.stickerSets : null;
                });
            },
            get: function (id) {
                return request('/get?id=' + encodeURIComponent(id)).then(function (r) {
                    return r && r.stickerSet ? r.stickerSet : null;
                });
            },
            create: function (name, data) {
                return request('/create', { method: 'POST', body: JSON.stringify({ name: name, type: type, data: data }) });
            },
            update: function (id, data) {
                return request('/update', { method: 'POST', body: JSON.stringify({ id: id, data: data }) });
            },
            remove: function (id) {
                return request('/delete', { method: 'POST', body: JSON.stringify({ id: id }) });
            }
        };
    }

    // Mirror of the backend's countStickers for the local store's denormalized count.
    function countStickers(data) {
        return ((data && data.rows) || []).reduce(function (sum, r) {
            return sum + Math.max(1, parseInt(r.count, 10) || 1);
        }, 0);
    }

    // localStorage-backed store producing the same row shape as the API.
    function localApi(storageKey) {
        function read() {
            try { return JSON.parse(localStorage.getItem(storageKey)) || []; }
            catch (e) { return []; }
        }
        function write(sets) {
            try { localStorage.setItem(storageKey, JSON.stringify(sets)); } catch (e) {}
        }
        return {
            list: function () { return Promise.resolve(read()); },
            get: function (id) {
                return Promise.resolve(read().find(function (s) { return s.id === id; }) || null);
            },
            create: function (name, data) {
                var set = {
                    id: 'local-' + Date.now().toString(36),
                    qr_name: name,
                    qr_data: data,
                    qr_stickerCount: countStickers(data),
                    updatedAt: new Date().toISOString()
                };
                write([set].concat(read()).slice(0, 50));
                return Promise.resolve(set);
            },
            update: function (id, data) {
                var sets = read();
                var set = sets.find(function (s) { return s.id === id; });
                if (!set) return Promise.resolve(null);
                set.qr_data = data;
                set.qr_stickerCount = countStickers(data);
                set.updatedAt = new Date().toISOString();
                write(sets);
                return Promise.resolve(set);
            },
            remove: function (id) {
                write(read().filter(function (s) { return s.id !== id; }));
                return Promise.resolve();
            }
        };
    }

    function mount(opts) {
        var remote = remoteApi(opts.type);
        var local = localApi(opts.storageKey);
        var api = local;
        var signedIn = false;
        var sets = [];

        opts.mountEl.innerHTML =
            '<div class="gen-store-save">' +
                '<input type="text" class="gen-store-name" placeholder="Set name" maxlength="80">' +
                '<button type="button" class="gen-store-save-btn">Save</button>' +
            '</div>' +
            '<div class="gen-store-io">' +
                '<button type="button" class="gen-store-export">Export JSON</button>' +
                '<button type="button" class="gen-store-import">Import JSON</button>' +
                '<input type="file" class="gen-store-file" accept=".json,application/json" hidden>' +
            '</div>' +
            '<ul class="gen-store-list"></ul>' +
            '<p class="caption gen-store-status"></p>';

        var nameInput = opts.mountEl.querySelector('.gen-store-name');
        var fileInput = opts.mountEl.querySelector('.gen-store-file');
        var listEl = opts.mountEl.querySelector('.gen-store-list');
        var statusEl = opts.mountEl.querySelector('.gen-store-status');

        function setStatus() {
            if (signedIn) {
                statusEl.textContent = 'Signed in — sets are saved to your account.';
            } else {
                statusEl.innerHTML = 'Not signed in — sets stay in this browser. ' +
                    '<a href="' + signInUrl() + '" target="_blank" rel="noopener">Sign in</a> to save to your account.';
            }
        }

        function fmtDate(iso) {
            var d = iso ? new Date(iso) : null;
            return d && !isNaN(d) ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
        }

        function renderList() {
            listEl.innerHTML = '';
            if (!sets.length) {
                var empty = document.createElement('li');
                empty.className = 'gen-store-empty';
                empty.textContent = 'No saved sets yet.';
                listEl.appendChild(empty);
                return;
            }
            sets.forEach(function (s) {
                var li = document.createElement('li');

                var load = document.createElement('button');
                load.type = 'button';
                load.className = 'gen-store-load';
                load.textContent = s.qr_name;
                load.title = 'Load this set';
                load.addEventListener('click', function () { loadSet(s); });

                var meta = document.createElement('span');
                meta.className = 'gen-store-meta';
                var bits = [];
                if (s.qr_stickerCount != null) bits.push(s.qr_stickerCount + ' sticker' + (s.qr_stickerCount === 1 ? '' : 's'));
                var dt = fmtDate(s.updatedAt);
                if (dt) bits.push(dt);
                meta.textContent = bits.join(' · ');

                var del = document.createElement('button');
                del.type = 'button';
                del.className = 'gen-store-del';
                del.textContent = '×';
                del.title = 'Delete this set';
                del.addEventListener('click', function () { deleteSet(s); });

                li.appendChild(load);
                li.appendChild(meta);
                li.appendChild(del);
                listEl.appendChild(li);
            });
        }

        function refresh() {
            return remote.list().then(function (remoteSets) {
                if (remoteSets) {
                    signedIn = true;
                    api = remote;
                    return remoteSets;
                }
                return local.list();
            }).catch(function (e) {
                console.error(e);
                return local.list();
            }).then(function (list) {
                sets = list;
                setStatus();
                renderList();
            });
        }

        function loadSet(s) {
            var ready = s.qr_data ? Promise.resolve(s) : api.get(s.id);
            ready.then(function (full) {
                if (!full || !full.qr_data) return;
                opts.applyState(full.qr_data);
                nameInput.value = full.qr_name;
            }).catch(function (e) { console.error(e); });
        }

        function deleteSet(s) {
            if (!confirm('Delete "' + s.qr_name + '"?')) return;
            api.remove(s.id).catch(function (e) { console.error(e); }).then(function () {
                sets = sets.filter(function (x) { return x.id !== s.id; });
                renderList();
            });
        }

        opts.mountEl.querySelector('.gen-store-save-btn').addEventListener('click', function () {
            var name = nameInput.value.trim();
            if (!name) { nameInput.focus(); return; }
            var data = opts.getState();
            var existing = sets.find(function (s) { return s.qr_name === name; });
            var save = existing
                ? (confirm('Overwrite "' + name + '"?') ? api.update(existing.id, data) : Promise.reject('cancelled'))
                : api.create(name, data);
            save.then(function () {
                nameInput.value = '';
                refresh();
            }).catch(function (e) {
                if (e === 'cancelled') return;
                console.error(e);
                alert('Save failed — the set was not stored.');
            });
        });

        opts.mountEl.querySelector('.gen-store-export').addEventListener('click', function () {
            var data = opts.getState();
            var name = nameInput.value.trim();
            if (name) data.name = name;
            var slug = (name || opts.type + '-stickers').toLowerCase()
                .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            var a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
            a.download = slug + '.json';
            a.click();
            URL.revokeObjectURL(a.href);
        });

        opts.mountEl.querySelector('.gen-store-import').addEventListener('click', function () {
            fileInput.click();
        });

        fileInput.addEventListener('change', function () {
            var file = fileInput.files && fileInput.files[0];
            fileInput.value = '';
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function () {
                var data;
                try { data = JSON.parse(reader.result); } catch (e) {}
                if (!data || !Array.isArray(data.rows)) {
                    alert('That file is not a saved set (expected {rows, opts} JSON).');
                    return;
                }
                opts.applyState({ rows: data.rows, opts: data.opts || {} });
                if (typeof data.name === 'string' && data.name) nameInput.value = data.name;
            };
            reader.readAsText(file);
        });

        refresh();
    }

    return { mount: mount };
})();
