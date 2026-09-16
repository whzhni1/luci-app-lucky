'use strict';
'require baseclass';
'require rpc';

var themeState = 'light';
var bgState = 'on';

var settingsGet = rpc.declare({ object: 'luci.lucky', method: 'get_settings', expect: { '': {} } });
var themeSave   = rpc.declare({ object: 'luci.lucky', method: 'save_settings', params: ['theme'], expect: { '': {} } });
var bgSave      = rpc.declare({ object: 'luci.lucky', method: 'save_settings', params: ['bg'],    expect: { '': {} } });

var ICONS = {
    refresh:  ['M23 4v6h-6', 'M20.49 15a9 9 0 1 1-2.12-9.36L23 10'],
    sun:      ['M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10z', 'M12 1v3', 'M12 20v3',
               'M4.22 4.22l2.12 2.12', 'M17.66 17.66l2.12 2.12',
               'M1 12h3', 'M20 12h3', 'M4.22 19.78l2.12-2.12', 'M17.66 6.34l2.12-2.12'],
    moon:     ['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'],
    external: ['M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6', 'M15 3h6v6', 'M10 14L21 3'],
    trash:    ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
               'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'M10 11v6', 'M14 11v6'],
    download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
    alert:    ['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
               'M12 9v4', 'M12 17h.01'],
    check:    ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4L12 14.01l-3-3'],
    close:    ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M15 9l-6 6', 'M9 9l6 6'],
    folder:   ['M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'],
    gear:     ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
               'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z'],
    clock:    ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
    info:     ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 16v-4', 'M12 8h.01'],
    link:     ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
               'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
    globe:    ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M2 12h20',
               'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'],
    box:      ['M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
               'M3.27 6.96L12 12.01l8.73-5.05', 'M12 22.08V12'],
    sparkles: ['M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z',
               'M20 3v4', 'M22 5h-4', 'M4 17v2', 'M5 18H3'],
    ban:      ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M4.93 4.93L19.07 19.07']
};

function icon(key, size) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('width', size || 16);
    svg.setAttribute('height', size || 16);
    svg.setAttribute('class', 'lucky-icon');
    (ICONS[key] || ICONS.info).forEach(function(d) {
        var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('d', d);
        svg.appendChild(p);
    });
    return svg;
}

function syncThemeBtn() {
    var b = document.getElementById('lucky-theme-btn');
    if (!b) return;
    while (b.firstChild) b.removeChild(b.firstChild);
    var dark = theme.get() === 'dark';
    b.appendChild(icon(dark ? 'sun' : 'moon', 16));
    b.title = dark ? _('Switch to light theme') : _('Switch to dark theme');
}

function syncBgBtn() {
    var b = document.getElementById('lucky-bg-btn');
    if (!b) return;
    while (b.firstChild) b.removeChild(b.firstChild);
    var on = bg.get() === 'on';
    b.appendChild(icon(on ? 'sparkles' : 'ban', 16));
    b.title = on ? _('Turn off background decoration') : _('Turn on background decoration');
}

function showCurtain(targetTheme, callback) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        callback();
        return;
    }
    var page = document.querySelector('.lucky-page');
    if (!page) { callback(); return; }
    var el = E('div', { class: 'lucky-curtain' });
    var grad = targetTheme === 'dark'
        ? 'linear-gradient(160deg, #12142c 0%, #170f36 55%, #221040 100%)'
        : 'linear-gradient(160deg, #dfe7ff 0%, #e9e0ff 48%, #ffe8f2 100%)';
    el.style.background = grad;
    page.insertBefore(el, page.firstChild);
    el.classList.add(targetTheme === 'dark' ? 'is-closing' : 'is-opening');
    var extras = [];
    var links = document.querySelectorAll('#tabmenu ul li a');
    for (var i = 0; i < links.length; i++) extras.push(links[i]);
    var bar = document.querySelector('#view > .lucky-page ~ .cbi-page-actions');
    if (bar) extras.push(bar);
    for (var j = 0; j < extras.length; j++) {
        extras[j].style.transition = 'opacity 0.25s ease-out';
        extras[j].style.opacity = '0.35';
    }
    setTimeout(function() {
        callback();
        if (el.parentNode) el.parentNode.removeChild(el);
        for (var k = 0; k < extras.length; k++) {
            extras[k].style.transition = 'opacity 0.35s ease-in';
            extras[k].style.opacity = '1';
        }
    }, 800);
}

var theme = {
    get: function() {
        return themeState;
    },
    apply: function(t) {
        document.documentElement.setAttribute('data-theme', t);
    },
    set: function(t) {
        if (t !== 'light' && t !== 'dark') return Promise.resolve({});
        themeState = t;
        theme.apply(t);
        syncThemeBtn();
        try { localStorage.setItem('lucky-theme', t); } catch(e) {}
        try { themeSave(t); } catch(e) {}
        return Promise.resolve({});
    },
    toggle: function() {
        var next = themeState === 'dark' ? 'light' : 'dark';
        var self = this;
        showCurtain(next, function() { self.set(next); });
        return Promise.resolve({});
    },
    load: function() {
        return L.resolveDefault(settingsGet(), {}).then(function(res) {
            var t = res && res.theme;
            if (t !== 'light' && t !== 'dark') return;
            if (t === themeState) return;
            themeState = t;
            theme.apply(t);
            syncThemeBtn();
            try { localStorage.setItem('lucky-theme', t); } catch(e) {}
        });
    }
};

var bg = {
    get: function() {
        return bgState;
    },
    apply: function(v) {
        document.documentElement.setAttribute('data-bg', v);
    },
    set: function(v) {
        if (v !== 'on' && v !== 'off') return Promise.resolve({});
        bgState = v;
        bg.apply(v);
        syncBgBtn();
        try { localStorage.setItem('lucky-bg', v); } catch(e) {}
        try { bgSave(v === 'on' ? '1' : '0'); } catch(e) {}
        return Promise.resolve({});
    },
    toggle: function() {
        var next = bgState === 'on' ? 'off' : 'on';
        var self = this;
        showCurtain(themeState, function() { self.set(next); });
        return Promise.resolve({});
    },
    load: function() {
        return L.resolveDefault(settingsGet(), {}).then(function(res) {
            var v = res && res.bg === '0' ? 'off' : 'on';
            if (v === bgState) return;
            bgState = v;
            bg.apply(v);
            syncBgBtn();
            try { localStorage.setItem('lucky-bg', v); } catch(e) {}
        });
    }
};

function makeToolButton(id, fn) {
    var b = E('button', {
        id: id,
        type: 'button',
        class: 'lucky-theme-btn'
    });
    b.addEventListener('click', function() {
        fn();
        var ic = b.querySelector('.lucky-icon');
        if (ic) {
            ic.classList.remove('lucky-flip');
            void ic.offsetWidth;
            ic.classList.add('lucky-flip');
        }
    });
    return b;
}

function hasLuckyLink(el) {
    return !!el.querySelector('a[href*="/lucky"]');
}

function markMenuItems() {
    ['topmenu', 'mainmenu'].forEach(function(id) {
        var root = document.getElementById(id);
        if (!root) return;
        var lis = root.querySelectorAll('li');
        for (var i = 0; i < lis.length; i++) {
            var li = lis[i];
            if (li.className && li.className.indexOf('mainmenu-item-lucky') !== -1) {
                li.classList.add('lucky-menu-parent');
                continue;
            }
            if (!hasLuckyLink(li)) continue;
            var kids = li.querySelectorAll('li'), deeper = false;
            for (var k = 0; k < kids.length; k++) {
                if (hasLuckyLink(kids[k])) { deeper = true; break; }
            }
            if (deeper) continue;
            li.classList.add(li.querySelector('ul') ? 'lucky-menu-parent' : 'lucky-menu-item');
        }
    });
}

function mountField() {
    if (document.getElementById('lucky-field')) return;
    var tabmenu = document.getElementById('tabmenu');
    var host = tabmenu ? tabmenu.parentElement : null;
    if (!host || host === document.body)
        host = document.querySelector ? document.querySelector('.lucky-page') : null;
    if (!host) return;
    var f = E('div', { id: 'lucky-field', class: 'lucky-field' });
    host.insertBefore(f, host.firstChild);
    host.style.position = 'relative';
    host.style.isolation = 'isolate';
}

function ensureMenuTools() {
    var bar = document.getElementById('lucky-menu-tools');
    if (bar) return bar;
    bar = E('div', { id: 'lucky-menu-tools', class: 'lucky-menu-tools' });
    bar.appendChild(makeToolButton('lucky-theme-btn', function() {
        return theme.toggle();
    }));
    bar.appendChild(makeToolButton('lucky-bg-btn', function() {
        return bg.toggle();
    }));
    var tabmenu  = document.getElementById('tabmenu');
    var mainmenu = document.getElementById('mainmenu');
    if (tabmenu) {
        bar.classList.add('is-tabs');
        tabmenu.appendChild(bar);
    } else if (mainmenu) {
        bar.classList.add('is-side');
        mainmenu.insertBefore(bar, mainmenu.firstChild);
    } else {
        bar.classList.add('is-fallback');
        document.body.appendChild(bar);
    }
    mountField();
    markMenuItems();
    syncThemeBtn();
    syncBgBtn();
    return bar;
}

function initThemeButton() {
    ensureMenuTools();
    return document.getElementById('lucky-theme-btn');
}

function injectCSS() {
    if (document.getElementById('lucky-css')) return;
    var l = document.createElement('link');
    l.id = 'lucky-css';
    l.rel = 'stylesheet';
    l.href = L.resource('lucky/lucky.css');
    document.head.appendChild(l);
}

function buildCard(title, children, opts) {
    opts = opts || {};
    var card = E('div', {
        class: 'lucky-card' + (opts.variant ? ' lucky-card--' + opts.variant : '')
    });
    if (title) {
        var t = E('h3', { class: 'lucky-card-title' });
        if (opts.icon) t.appendChild(icon(opts.icon, 15));
        t.appendChild(E('span', {}, title));
        card.appendChild(t);
    }
    var kids = Array.isArray(children) ? children : [children];
    kids.forEach(function(c) {
        if (c !== '' && c != null) card.appendChild(c);
    });
    return card;
}

function buildGrid(minW, cards) {
    var g = E('div', { class: 'lucky-grid' });
    if (minW) g.style.setProperty('--lucky-min', minW + 'px');
    (cards || []).forEach(function(c, i) {
        if (!c) return;
        c.style.animationDelay = (i * 60) + 'ms';
        g.appendChild(c);
    });
    return g;
}

function buildFormRow(type, id, label, value, desc, extra) {
    var elId = '_f_' + id, ctrl;

    if (type === 'toggle') {
        ctrl = buildToggle(elId, value === '1', null);

    } else if (type === 'select') {
        ctrl = E('select', { id: elId, class: 'lucky-select' },
            (extra || []).map(function(o) {
                return E('option', {
                    value: o.v,
                    selected: o.v === value ? 'selected' : null
                }, o.l);
            }));

    } else if (type === 'custom') {
        ctrl = extra;

    } else {
        var attrs = (typeof extra === 'object' && !Array.isArray(extra)) ? extra : {};
        ctrl = E('input', Object.assign({
            type: type,
            id: elId,
            value: value || ''
        }, attrs, { class: 'lucky-input' }));
    }

    return E('div', { id: '_row_' + id, class: 'lucky-form-row' }, [
        E('label', { for: elId, class: 'lucky-form-label' }, label),
        E('div', { class: 'lucky-form-ctrl' }, [
            ctrl,
            desc ? E('div', { class: 'lucky-form-desc' }, desc) : ''
        ])
    ]);
}

function buildToggle(id, checked, onChange) {
    var input = E('input', {
        type: 'checkbox',
        id: id,
        checked: checked ? 'checked' : null
    });
    if (onChange) input.addEventListener('change', onChange);
    return E('label', { class: 'lucky-toggle', for: id }, [
        input,
        E('span', { class: 'lucky-toggle-slider' })
    ]);
}

function buildIconBtn(iconKey, title, onClick) {
    var b = E('button', {
        type: 'button',
        class: 'lucky-iconbtn',
        title: title || ''
    }, [icon(iconKey, 15)]);
    b.addEventListener('click', onClick);
    return b;
}

function buildBar(id, semantic) {
    var cls = 'lucky-bar-fill' + (semantic === 'progress' ? ' is-progress' : '');
    return E('div', { class: 'lucky-bar' }, [E('div', { id: id, class: cls })]);
}

function setBar(id, pct) {
    var el = document.getElementById(id);
    if (!el) return;
    var p = Math.min(100, Math.max(0, pct || 0));
    el.style.width = p + '%';
    if (!el.classList.contains('is-progress')) {
        el.classList.toggle('is-warn', p >= 70 && p < 90);
        el.classList.toggle('is-danger', p >= 90);
    }
}

function buildLinkBtn(label, url, iconKey) {
    return E('a', {
        href: url,
        target: '_blank',
        rel: 'noopener',
        class: 'lucky-link-btn'
    }, [icon(iconKey || 'external', 14), E('span', {}, label)]);
}

function buildKVGrid(rows) {
    var grid = E('div', { class: 'lucky-kv' });
    rows.forEach(function(r) {
        grid.appendChild(E('span', { class: 'lucky-kv-label' }, r[0]));
        grid.appendChild(E('span', { class: 'lucky-kv-value', id: r[1] },
            r[2] || _('Unknown')));
    });
    return grid;
}

function buildInfoTiles(items, minW, snap) {
    var grid = E('div', { class: 'lucky-tiles' + (snap ? ' lucky-tiles--snap' : '') });
    if (minW) grid.style.setProperty('--lucky-min', minW + 'px');
    items.forEach(function(it) {
        var val = it[2];
        grid.appendChild(E('div', { class: 'lucky-info-cell' }, [
            E('div', { class: 'lucky-info-label' }, it[0]),
            E('div', { class: 'lucky-info-value', id: it[1] },
                val
                    ? val
                    : E('em', { class: 'lucky-loading' }, _('Loading…')))
        ]));
    });
    return grid;
}

function setState(id, text, kind) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = 'lucky-state lucky-state--' + (kind || 'idle');
}

function showToast(opts) {
    var ok      = opts.ok !== false;
    var title   = opts.title || (ok ? _('Success') : _('Failed'));
    var msg     = opts.msg   || '';
    var timeout = opts.timeout != null ? opts.timeout : (ok ? 2000 : 0);

    var overlay = E('div', { class: 'lucky-toast-overlay' });
    var toast   = E('div', { class: 'lucky-toast' }, [
        E('div', { class: 'lucky-toast-icon ' + (ok ? 'is-ok' : 'is-err') },
            [icon(ok ? 'check' : 'close', 40)]),
        E('div', { class: 'lucky-toast-title ' + (ok ? 'is-ok' : 'is-err') }, title),
        msg ? E('div', { class: 'lucky-toast-msg' }, msg) : ''
    ]);

    function close() {
        overlay.classList.remove('is-show');
        toast.classList.remove('is-show');
        window.setTimeout(function() {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            if (toast.parentNode)   toast.parentNode.removeChild(toast);
        }, 240);
    }

    if (!ok || timeout === 0) {
        toast.appendChild(E('button', {
            type: 'button',
            class: 'lucky-btn lucky-btn-primary',
            style: 'margin-top:18px;min-width:84px;',
            click: close
        }, _('OK')));
    }

    overlay.addEventListener('click', function() {
        if (!ok || timeout === 0) close();
    });

    document.body.appendChild(overlay);
    document.body.appendChild(toast);

    window.setTimeout(function() {
        overlay.classList.add('is-show');
        toast.classList.add('is-show');
    }, 10);

    if (ok && timeout > 0) {
        window.setTimeout(close, timeout);
    }
    return close;
}

function setText(id, t) {
    var e = document.getElementById(id);
    if (e) e.textContent = t;
}

function setVis(id, show, d) {
    var e = document.getElementById(id);
    if (e) e.style.display = show ? (d || 'block') : 'none';
}

function fval(id) {
    var e = document.getElementById('_f_' + id);
    return e ? (e.type === 'checkbox' ? (e.checked ? '1' : '0') : e.value || '') : '';
}

function rowVis(id, show) {
    var e = document.getElementById('_row_' + id);
    if (e) e.style.display = show ? '' : 'none';
}

var TASK_MESSAGES = {
    checking: _('Checking upstream…'),
    downloading: _('Downloading…'),
    installing: _('Installing…'),
    installing_luci: _('Installing LuCI…'),
    ready: _('Ready'),
    done: _('Complete'),
    download_failed: _('Download failed'),
    download_empty: _('Downloaded file is empty'),
    checksum_failed: _('SHA256 verification failed'),
    url_not_found: _('Download URL not found'),
    extract_failed: _('Extract failed'),
    unsupported_format: _('Unsupported format'),
    binary_not_found: _('Lucky binary not found in archive'),
    install_failed: _('Installation failed'),
    package_manager_missing: _('Package manager not found'),
    no_releases: _('No releases found'),
    check_failed: _('Update check failed'),
    unknown_mirror: _('Unknown mirror'),
    invalid_request: _('Invalid update request'),
    file_not_found: _('File not found'),
    configdir_missing: _('Config directory is not set'),
    language_pack_failed: _('Language pack installation failed'),
    error: _('Error')
};

function taskMessage(s) {
    s = s || {};
    var code = s.code || s.status_code || s.status || 'error';
    return TASK_MESSAGES[code] || _('Error');
}

function LogPoller(opts) {
    var timer = null;

    function tick() {
        opts.status().then(function(s) {
            s = s || {};
            var code = s.code || s.status;

            if (opts.textEl) {
                var el = typeof opts.textEl === 'string'
                    ? document.getElementById(opts.textEl) : opts.textEl;
                if (el && s.log) {
                    var atBottom = el.scrollTop + el.clientHeight
                                   >= el.scrollHeight - 12;
                    if (el.textContent !== s.log) el.textContent = s.log;
                    if (atBottom) el.scrollTop = el.scrollHeight;
                }
            }

            if (opts.bar && code === 'downloading' && s.progress != null)
                setBar(opts.bar, s.progress);

            if (opts.onTick) opts.onTick(s);

            var done = opts.terminal
                ? opts.terminal(s)
                : (code === 'done' || code === 'error');
            if (done) {
                stop();
                if (opts.onDone) opts.onDone(s);
            }
        });
    }

    function start(interval) {
        stop();
        timer = setInterval(tick, interval || opts.interval || 1500);
        tick();
    }

    function stop() {
        if (timer) { clearInterval(timer); timer = null; }
    }

    return { start: start, stop: stop };
}

try {
    var _ct = localStorage.getItem('lucky-theme');
    if (_ct === 'dark' || _ct === 'light') {
        themeState = _ct;
        theme.apply(_ct);
    }
} catch(e) {}
try {
    var _cb = localStorage.getItem('lucky-bg');
    if (_cb === 'on' || _cb === 'off') {
        bgState = _cb;
        bg.apply(_cb);
    }
} catch(e) {}

injectCSS();
theme.load();
bg.load();

return baseclass.extend({
    __name__: 'luckyCommon',
    __init__: function() {
        window.luckyUI = this;
    },
    ICONS: ICONS,
    icon: icon,
    theme: theme,
    bg: bg,
    initThemeButton: initThemeButton,
    rpc: function(method, params) {
        return rpc.declare({
            object: 'luci.lucky',
            method: method,
            params: params,
            expect: { '': {} }
        });
    },
    buildCard: buildCard,
    buildGrid: buildGrid,
    buildFormRow: buildFormRow,
    buildToggle: buildToggle,
    buildIconBtn: buildIconBtn,
    buildBar: buildBar,
    setBar: setBar,
    buildLinkBtn: buildLinkBtn,
    buildKVGrid: buildKVGrid,
    buildInfoTiles: buildInfoTiles,
    setState: setState,
    showToast: showToast,
    setText: setText,
    setVis: setVis,
    fval: fval,
    rowVis: rowVis,
    taskMessage: taskMessage,
    LogPoller: LogPoller
});

