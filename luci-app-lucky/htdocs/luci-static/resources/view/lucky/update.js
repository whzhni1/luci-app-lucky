'use strict';
'require view';
'require rpc';
'require uci';
'require lucky/log';

var rpcC = function(m, p) {
    return rpc.declare({ object: 'luci.lucky', method: m, params: p, expect: { '': {} } });
};

var api = {
    info:        rpcC('get_system_info'),
    updChk:      rpcC('get_upstream_version', ['mirror', 'release_type', 'variant']),
    updStat:     rpcC('get_update_status'),
    updDo:       rpcC('do_update', ['tag', 'filename']),
    luciChk:     rpcC('check_luci'),
    luciStat:    rpcC('get_luci_update_status'),
    luciDo:      rpcC('do_update_luci', ['tag', 'filename']),
    autoLog:     rpcC('get_auto_update_log'),
    cleanUpdate: rpcC('clean_update')
};

var $ = function(id) { return document.getElementById(id); };

var txt = function(id, t, c) {
    var e = $(id);
    if (!e) return;
    e.textContent = t;
    if (c) e.style.color = c;
};

var vis = function(id, s, d) {
    var e = $(id);
    if (e) e.style.display = s ? (d || 'block') : 'none';
};

var LOG_STYLE = [
    'display:none', 'margin-top:10px', 'background:#1e1e1e', 'color:#d4d4d4',
    'padding:10px', 'font-size:12px', 'height:200px', 'overflow-y:auto',
    'border-radius:4px', 'white-space:pre-wrap', 'font-family:monospace'
].join(';');

var ucig = function(k) { return uci.get('lucky', 'lucky', k); };

var infoBlock = function() {
    var th = 'padding:8px 12px;text-align:left;width:160px;';
    var td = 'padding:8px 12px;';
    var rows = [
        [_('Lucky Version'), 'iv'], [_('Luci Version'), 'il'], [_('Variant'),       'ir'],
        [_('Architecture'),  'ia'], [_('Install Path'), 'ip'], [_('Data Directory'), 'ic']
    ];
    return E('div', { class: 'cbi-section' }, [
        E('h3', {}, _('Current Status')),
        E('div', { style: 'overflow-x:auto;border:1px solid #ddd;border-radius:8px;' },
            E('table', { style: 'width:100%;min-width:360px;border-collapse:collapse;' },
                rows.map(function(r) {
                    return E('tr', {}, [
                        E('th', { style: th }, r[0]),
                        E('td', { style: td, id: r[1] }, E('em', {}, _('Loading...')))
                    ]);
                })
            )
        )
    ]);
};

var buildSelect = function(id, opts, cur, onChange) {
    return E('select', { class: 'cbi-input-select', id: id, style: 'width:auto;', change: onChange },
        opts.map(function(o) {
            return E('option', { value: o.v, selected: o.v === cur ? 'selected' : null }, o.l);
        })
    );
};

var buildSection = function(t, tLbl, bLbl, self, ext) {
    return E('div', { class: 'cbi-section' }, [
        E('h3', {}, tLbl),
        E('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;' }, [
            E('button', { class: 'btn cbi-button-action', id: t + '_chk',
                click: function() { self._chk(t); }
            }, bLbl),
            E('span', { id: t + '_stat', style: 'font-size:13px;color:#888;' }, _('Click to check'))
        ]),
        ext || '',
        E('div', { id: t + '_sels', style: 'display:none;margin-top:10px;' },
            E('div', { style: 'display:flex;flex-wrap:wrap;align-items:center;gap:8px;' }, [
                E('label', {}, _('Version:')),
                E('select', { class: 'cbi-input-select', id: t + '_tag',
                    style: 'width:auto;max-width:200px;',
                    change: function() { self._sel(t); }
                }),
                E('label', {}, _('File:')),
                E('select', { class: 'cbi-input-select', id: t + '_file',
                    style: 'width:auto;max-width:360px;'
                }),
                E('button', { class: 'btn cbi-button-apply', id: t + '_do',
                    click: function() { self._do(t); }
                }, _('Install Now'))
            ])
        ),
        E('pre', { id: t + '_log', style: LOG_STYLE })
    ]);
};

return view.extend({
    handleSave: null, handleSaveApply: null, handleReset: null,

    load: function() { return uci.load('lucky'); },

    render: function() {
        var self = this;
        var m = ucig('mirror')       || 'github';
        var r = ucig('release_type') || 'stable';
        var v = ucig('variant')      || 'lucky';

        var mirrorExt = E('div', { id: 'upd_retry',
            style: 'display:none;margin-top:8px;align-items:center;gap:8px;flex-wrap:wrap;'
        }, [
            E('span', { style: 'font-size:13px;' }, _('Switch and retry:')),
            buildSelect('upd_rmir', [
                { v: 'github', l: _('GitHub (github.com/gdy666/lucky)') },
                { v: 'r66666', l: _('Official (release.66666.plus)') }
            ], m, function() { vis('upd_rext', this.value === 'r66666', 'flex'); }),
            E('span', { id: 'upd_rext',
                style: 'display:' + (m === 'r66666' ? 'flex' : 'none') + ';gap:8px;align-items:center;'
            }, [
                buildSelect('upd_rrel', [
                    { v: 'stable', l: _('Stable') }, { v: 'beta', l: _('Beta') }
                ], r),
                buildSelect('upd_rvar', [
                    { v: 'lucky', l: _('Standard') }, { v: 'wanji', l: _('Full-featured') }
                ], v)
            ]),
            E('button', { class: 'btn cbi-button-action',
                click: function() { self._chk('upd', true); }
            }, _('Retry'))
        ]);

        var logIds = ['upd_log', 'luci_log', 'auto_log'];

        var content = E('div', { class: 'cbi-map' }, [
            E('h2', {}, _('Lucky — Download & Update')),
            infoBlock(),
            buildSection('upd',  _('Lucky Binary Update'), _('Check Upstream'),    self, mirrorExt),
            buildSection('luci', _('Luci App Update'),     _('Check Luci Version'), self),
            E('div', { class: 'cbi-section' }, [
                E('h3', {}, _('Auto Update Log')),
                E('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;' }, [
                    E('button', { class: 'btn cbi-button-action', click: function() {
                        L.resolveDefault(api.autoLog(), {}).then(function(res) {
                            var el = $('auto_log');
                            if (!el) return;
                            el.style.display = 'block';
                            el.textContent = lucky_log.translate(
                                res && res.log ? res.log : _('(No log)')
                            );
                            el.scrollTop = el.scrollHeight;
                        });
                    }}, _('View Log')),
                    E('button', { class: 'btn cbi-button-remove', click: function() {
                        if (!window.confirm(_('Clear all update cache and logs? This will delete /tmp/lucky_update.')))
                            return;
                        L.resolveDefault(api.cleanUpdate(), {}).then(function(res) {
                            var ok = res && res.result === 'ok';
                            logIds.forEach(function(id) {
                                var el = $(id);
                                if (el) { el.textContent = ''; el.style.display = 'none'; }
                            });
                            ui.addNotification(null, E('p', {},
                                ok ? _('Cache cleared.') : _('Clear failed.')
                            ), ok ? 'info' : 'error');
                        });
                    }}, _('Clear Cache'))
                ]),
                E('pre', { id: 'auto_log', style: LOG_STYLE })
            ])
        ]);

        this._info();
        return content;
    },

    _chk: function(t, retry) {
        var self = this;
        var btn = $(t + '_chk');
        if (btn) btn.disabled = true;
        vis(t + '_retry', false);
        vis(t + '_sels', false);
        vis(t + '_log',  false);
        txt(t + '_stat', _('Checking…'), '#888');

        var p = [];
        if (t === 'upd') {
            var m = retry ? $('upd_rmir').value : (ucig('mirror')       || 'github');
            var r = retry ? $('upd_rrel').value : (ucig('release_type') || 'stable');
            var v = retry ? $('upd_rvar').value : (ucig('variant')      || 'lucky');
            p = [m, m === 'r66666' ? r : '', m === 'r66666' ? v : ''];
        }

        L.resolveDefault(api[t + 'Chk'].apply(null, p), {}).then(function(res) {
            if (!res || res.result === 'error') {
                if (btn) btn.disabled = false;
                txt(t + '_stat', _('✗ Failed to start check'), '#dc3545');
                if (t === 'upd') vis('upd_retry', true, 'flex');
                return;
            }
            self._pollChk(t);
        });
    },

    _pollChk: function(t) {
        var self = this, tk = t + '_ck', dots = 0;
        clearInterval(self[tk]);
        self[tk] = setInterval(function() {
            var dot = '.'.repeat(dots = dots % 3 + 1);
            api[t + 'Stat']().then(function(s) {
                if (!s) return;
                switch (s.status) {
                    case 'idle':
                    case 'checking':
                        txt(t + '_stat', _('Checking') + dot, '#888');
                        break;
                    case 'ready':
                        clearInterval(self[tk]);
                        $(t + '_chk').disabled = false;
                        txt(t + '_stat', _('✓ Found %d version(s)').format(s.count || 0), '#28a745');
                        if (s.releases) {
                            self['_R' + t] = s.releases;
                            var ts = $(t + '_tag');
                            ts.innerHTML = '';
                            s.releases.forEach(function(r) {
                                ts.appendChild(E('option', { value: r.tag }, r.tag));
                            });
                            self._sel(t);
                            vis(t + '_sels', true);
                        }
                        break;
                    case 'error':
                        clearInterval(self[tk]);
                        $(t + '_chk').disabled = false;
                        txt(t + '_stat', _('✗ %s').format(s.msg || _('Error')), '#dc3545');
                        if (t === 'upd') vis('upd_retry', true, 'flex');
                        break;
                }
            });
        }, 1000);
    },

    _do: function(t) {
        var self = this;
        var tag  = ($(t + '_tag')  || {}).value;
        var fn   = ($(t + '_file') || {}).value;
        var btn  = $(t + '_do');
        if (!tag || !fn) return txt(t + '_stat', _('✗ Please select version and file'), '#dc3545');

        if (btn) btn.disabled = true;
        var lgEl = $(t + '_log');
        if (lgEl) { lgEl.style.display = 'none'; lgEl.textContent = ''; }
        txt(t + '_stat', _('Starting…'), '#888');

        L.resolveDefault(api[t + 'Do'](tag, fn), {}).then(function(res) {
            if (!res || res.result !== 'ok') {
                if (btn) btn.disabled = false;
                txt(t + '_stat', _('✗ Failed'), '#dc3545');
                return;
            }
            self._pollDo(t);
        });
    },

    _pollDo: function(t) {
        var self = this, tk = t + '_do_tm', dots = 0;
        clearInterval(self[tk]);
        self[tk] = setInterval(function() {
            var dot = '.'.repeat(dots = dots % 3 + 1);
            api[t + 'Stat']().then(function(s) {
                if (!s) return;
                var lgEl = $(t + '_log');
                if (s.log && s.log.trim() && lgEl) {
                    lgEl.style.display = 'block';
                    lgEl.textContent = lucky_log.translate(s.log);
                    lgEl.scrollTop = lgEl.scrollHeight;
                }
                switch (s.status) {
                    case 'idle':
                    case 'downloading':
                        txt(t + '_stat', _('Downloading') + dot, '#888');
                        break;
                    case 'installing':
                        txt(t + '_stat', _('Installing') + dot, '#f0ad4e');
                        break;
                    case 'done':
                        clearInterval(self[tk]);
                        $(t + '_chk').disabled = false;
                        $(t + '_do').disabled  = false;
                        txt(t + '_stat', _('✓ Complete: %s').format(s.installed || ''), '#28a745');
                        self._info();
                        break;
                    case 'error':
                        clearInterval(self[tk]);
                        $(t + '_chk').disabled = false;
                        $(t + '_do').disabled  = false;
                        txt(t + '_stat', _('✗ %s').format(s.msg || _('Error')), '#dc3545');
                        if (t === 'upd') vis('upd_retry', true, 'flex');
                        break;
                }
            });
        }, 1000);
    },

    _sel: function(t) {
        var rels = this['_R' + t] || [];
        var tv   = ($(t + '_tag')  || {}).value;
        var fs   = $(t + '_file');
        if (!tv || !fs) return;
        var r = rels.filter(function(x) { return x.tag === tv; })[0];
        fs.innerHTML = '';
        if (!r || !r.files) return;
        var best = 0;
        r.files.forEach(function(f, i) {
            fs.appendChild(E('option', { value: f.name }, f.name));
            if (f.name === r.best) best = i;
        });
        fs.selectedIndex = best;
    },

    _info: function() {
        L.resolveDefault(api.info(), {}).then(function(sys) {
            if (!sys) return;
            var map = { iv: sys.version, il: sys.luci_version, ir: sys.variant,
                        ia: sys.arch,    ip: sys.binpath,       ic: sys.configdir };
            Object.keys(map).forEach(function(k) {
                var e = $(k);
                if (e) { e.textContent = map[k] || _('Unknown'); e.style.color = ''; }
            });
        });
    }
});