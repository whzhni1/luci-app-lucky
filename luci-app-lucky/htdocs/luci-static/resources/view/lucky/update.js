'use strict';
'require view';
'require rpc';
'require uci';
'require ui';
'require lucky/log';

function loadCommon() {
    return new Promise(function(resolve, reject) {
        if (window.luckyUI) return resolve(window.luckyUI);
        var s = document.createElement('script');
        s.src = L.resource('lucky/common.js');
        s.onload  = function() { resolve(window.luckyUI); };
        s.onerror = function() { reject(new Error('Failed to load common.js')); };
        document.head.appendChild(s);
    });
}

function mkRpc(method, params) {
    return rpc.declare({
        object: 'luci.lucky', method: method,
        params: params, expect: { '': {} }
    });
}

var api = {
    info:        mkRpc('get_system_info'),
    updChk:      mkRpc('get_upstream_version', ['mirror','release_type','variant']),
    updStat:     mkRpc('get_update_status'),
    updDo:       mkRpc('do_update',            ['tag','filename']),
    luciChk:     mkRpc('check_luci'),
    luciStat:    mkRpc('get_luci_update_status'),
    luciDo:      mkRpc('do_update_luci',       ['tag','filename']),
    autoLog:     mkRpc('get_auto_update_log',  ['type']),
    cleanUpdate: mkRpc('clean_update')
};

var $ = function(id) { return document.getElementById(id); };
var ucig = function(k) { return uci.get('lucky', 'lucky', k); };

function mkSelect(id, opts, cur, onChange) {
    var C = window.luckyUI;
    return E('select', {
        id: id,
        style: C.CSS.inputBg + ';width:auto;max-width:100%;cursor:pointer;',
        change: onChange || null
    }, opts.map(function(o) {
        return E('option', {
            value: o.v,
            selected: o.v === cur ? 'selected' : null,
            style: 'background:#fff;color:#333;'
        }, o.l);
    }));
}

function buildInfoGrid(C) {
    var items = [
        [_('Lucky Version'), 'ii_ver'],  [_('LuCI Version'), 'ii_luci'],
        [_('Variant'),       'ii_var'],  [_('Architecture'), 'ii_arch'],
        [_('Binary Path'),   'ii_bin'],  [_('Data Dir'),     'ii_cfg']
    ];
    return C.buildCard('📊 ' + _('Current Installation'),
        E('div', { style: [
            'display:grid',
            'grid-template-columns:repeat(3,1fr)',
            'gap:12px',
            'min-width:480px'
        ].join(';') },
            items.map(function(it) {
                return E('div', {
                    style: 'background:#f8f9fa;border-radius:8px;padding:12px 14px;'
                }, [
                    E('div', { style: C.CSS.cardTitle }, it[0]),
                    E('div', { id: it[1],
                        style: 'font-size:14px;font-weight:600;' +
                               'margin-top:4px;word-break:break-all;' + 'color:#555;'
                    }, E('em', {}, _('Loading...')))
                ]);
            })
        )
    );
}

function buildUpdateSection(C, t, title, chkLabel, self, extraEl) {
    return C.buildCard(title, [
        E('div', {
            style: 'display:flex;align-items:center;gap:10px;' +
                   'flex-wrap:wrap;margin-bottom:8px;'
        }, [
            E('button', { style: C.CSS.btn.primary, id: t + '_chk',
                click: function() { self._chk(t); }
            }, chkLabel),
            E('span', { id: t + '_stat', style: 'font-size:13px;color:#888;' },
                _('Click to check'))
        ]),
        extraEl || '',
        E('div', { id: t + '_sels', style: 'display:none;margin-top:10px;' },
            E('div', {
                style: 'display:flex;flex-wrap:wrap;align-items:center;gap:8px;'
            }, [
                E('label', {}, _('Version:')),
                E('select', {
                    id: t + '_tag',
                    style: C.CSS.inputBg + ';width:auto;max-width:200px;cursor:pointer;',
                    change: function() { self._sel(t); }
                }),
                E('label', {}, _('File:')),
                E('select', {
                    id: t + '_file',
                    style: C.CSS.inputBg + ';width:auto;max-width:340px;cursor:pointer;'
                }),
                E('button', { style: C.CSS.btn.success, id: t + '_do',
                    click: function() { self._do(t); }
                }, _('Install Now'))
            ])
        ),
        E('div', { id: t + '_bar_wrap', style: 'display:none;margin-top:8px;' }, [
            C.buildBar(t + '_bar')
        ]),
        E('pre', { id: t + '_log', style: C.CSS.log })
    ]);
}

return view.extend({
    handleSave: null, handleSaveApply: null, handleReset: null,

    load: function() {
        return Promise.all([
            loadCommon(),
            uci.load('lucky')
        ]);
    },

    render: function() {
        var self = this;
        var C    = window.luckyUI;

        var m = ucig('mirror')       || 'github';
        var r = ucig('release_type') || 'stable';
        var v = ucig('variant')      || 'lucky';

        var mirrorExtra = E('div', { id: 'upd_retry',
            style: 'display:none;margin-top:8px;'
        }, [
            E('div', {
                style: 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;'
            }, [
                E('span', { style: 'font-size:13px;color:#888;' },
                    _('Switch mirror and retry:')),
                mkSelect('upd_rmir', [
                    { v: 'github', l: _('GitHub') },
                    { v: 'r66666', l: _('Official') }
                ], m, function() {
                    C.setVis('upd_rext', this.value === 'r66666', 'flex');
                }),
                E('span', { id: 'upd_rext',
                    style: 'display:' + (m === 'r66666' ? 'flex' : 'none') +
                           ';gap:8px;align-items:center;'
                }, [
                    mkSelect('upd_rrel', [
                        { v: 'stable', l: _('Stable') },
                        { v: 'beta',   l: _('Beta')   }
                    ], r),
                    mkSelect('upd_rvar', [
                        { v: 'lucky', l: _('Standard')     },
                        { v: 'wanji', l: _('Full-featured') }
                    ], v)
                ]),
                E('button', { style: C.CSS.btn.primary,
                    click: function() { self._chk('upd', true); }
                }, _('Retry'))
            ])
        ]);

        var content = E('div', { class: 'cbi-map' }, [
            E('h2', {}, _('Lucky — Download & Update')),
            buildInfoGrid(C),
            buildUpdateSection(C, 'upd', '🔽 ' + _('Lucky Core Update'),
                _('Check Upstream'), self, mirrorExtra),
            buildUpdateSection(C, 'luci', '🔽 ' + _('LuCI App Update'),
                _('Check LuCI'), self),
            C.buildCard('📋 ' + _('Auto Update Log'), [
                E('div', {
                    style: 'display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px;'
                }, [
                    E('button', { style: C.CSS.btn.primary, click: function() {
                        L.resolveDefault(api.autoLog(''), {}).then(function(res) {
                       var el = $('auto_log');
                       if (!el) return;
                       el.style.display = 'block';
                       el.textContent   = lucky_log.translate(
                           (res && res.log) ? res.log : _('(No log)')
                       );
                       el.scrollTop = el.scrollHeight;
                   });
               }}, _('Auto Update Log')),

               E('button', { style: C.CSS.btn.primary, click: function() {
                   L.resolveDefault(api.autoLog('run'), {}).then(function(res) {
                       var el = $('auto_log');
                       if (!el) return;
                       el.style.display = 'block';
                       el.textContent   = lucky_log.translate(
                           (res && res.log) ? res.log : _('(No log)')
                       );
                       el.scrollTop = el.scrollHeight;
                   });
               }}, _('Runtime Log')),

                    E('button', { style: C.CSS.btn.danger, click: function() {
                        if (!window.confirm(_('Clear all update cache and logs?'))) return;
                        L.resolveDefault(api.cleanUpdate(), {}).then(function(res) {
                            var ok = res && res.result === 'ok';
                            ['upd_log','luci_log','auto_log'].forEach(function(id) {
                                var e = $(id);
                                if (e) { e.textContent = ''; e.style.display = 'none'; }
                            });
                            C.showToast({
                                ok:      ok,
                                title:   ok ? _('Done') : _('Failed'),
                                msg:     ok ? _('Cache cleared.') : _('Clear failed.'),
                                timeout: ok ? 2000 : 0
                            });
                        });
                    }}, _('Clear Cache'))
                ]),
                E('pre', { id: 'auto_log', style: C.CSS.log })
            ])
        ]);

        this._info();
        return content;
    },

    _chk: function(t, retry) {
        var self = this, C = window.luckyUI;
        var btn  = $(t + '_chk');
        if (btn) btn.disabled = true;
        C.setVis(t + '_retry', false);
        C.setVis(t + '_sels',  false);
        C.setVis(t + '_bar_wrap', false);
        C.setBar(t + '_bar', 0);
        var lg = $(t + '_log');
        if (lg) { lg.textContent = ''; }
        C.setText(t + '_stat', _('Checking…'), '#888');

        var p = [];
        if (t === 'upd') {
            var mi = retry ? $('upd_rmir').value : (ucig('mirror')       || 'github');
            var re = retry ? $('upd_rrel').value : (ucig('release_type') || 'stable');
            var va = retry ? $('upd_rvar').value : (ucig('variant')      || 'lucky');
            p = [mi, mi === 'r66666' ? re : '', mi === 'r66666' ? va : ''];
        }

        L.resolveDefault(api[t + 'Chk'].apply(null, p), {}).then(function(res) {
            if (!res || res.result === 'error') {
                if (btn) btn.disabled = false;
                C.setText(t + '_stat', _('✗ Failed to start check'), '#dc3545');
                if (t === 'upd') C.setVis('upd_retry', true);
                return;
            }
            self._poll(t, 'chk');
        });
    },

    _do: function(t) {
        var self = this, C = window.luckyUI;
        var tag  = ($(t + '_tag')  || {}).value;
        var fn   = ($(t + '_file') || {}).value;
        var btn  = $(t + '_do');
        if (!tag || !fn)
            return C.setText(t + '_stat',
                _('✗ Please select version and file'), '#dc3545');
        if (btn) btn.disabled = true;
        C.setVis(t + '_bar_wrap', true);
        C.setBar(t + '_bar', 0);
        C.setText(t + '_stat', _('Starting…'), '#888');

        L.resolveDefault(api[t + 'Do'](tag, fn), {}).then(function(res) {
            if (!res || res.result !== 'ok') {
                if (btn) btn.disabled = false;
                C.setText(t + '_stat', _('✗ Failed'), '#dc3545');
                return;
            }
            self._poll(t, 'do');
        });
    },

    _poll: function(t, phase) {
        var self = this, C = window.luckyUI;
        var tk   = t + '_' + phase + '_tm', dots = 0;
        clearInterval(self[tk]);

        self[tk] = setInterval(function() {
            var dot = '.'.repeat(dots = dots % 3 + 1);
            api[t + 'Stat']().then(function(s) {
                if (!s) return;

                var lg = $(t + '_log');
                if (lg && s.log && s.log.trim()) {
                    var translated = lucky_log.translate(s.log);
                    if (lg.textContent !== translated) {
                        var atBottom = lg.scrollTop + lg.clientHeight >= lg.scrollHeight - 10;
                        lg.style.display = 'block';
                        lg.textContent   = translated;
                        if (atBottom) lg.scrollTop = lg.scrollHeight;
                    }
                    var lines = s.log.split('\n');
                    for (var i = lines.length - 1; i >= 0; i--) {
                        var m = lines[i].match(/PROGRESS:(\d+)/);
                        if (m) { C.setBar(t + '_bar', parseInt(m[1])); break; }
                    }
                }

                var done = false;
                if (phase === 'chk') {
                    if (s.status === 'checking' || s.status === 'idle') {
                        C.setText(t + '_stat', _('Checking') + dot, '#888');
                    } else if (s.status === 'ready') {
                        done = true;
                        C.setText(t + '_stat',
                            _('✓ Found %d version(s)').format(s.count || 0), '#28a745');
                        if (s.releases) {
                            self['_R' + t] = s.releases;
                            var ts = $(t + '_tag');
                            ts.innerHTML = '';
                            s.releases.forEach(function(r) {
                                ts.appendChild(E('option', {
                                    value: r.tag,
                                    style: 'background:#fff;color:#333;'
                                }, r.tag));
                            });
                            self._sel(t);
                            C.setVis(t + '_sels', true);
                        }
                    } else if (s.status === 'error') {
                        done = true;
                        C.setText(t + '_stat',
                            _('✗ %s').format(
                                lucky_log.translate(s.msg || _('Error'))
                            ), '#dc3545');
                        if (t === 'upd') C.setVis('upd_retry', true);
                    }
                } else {
                    if (s.status === 'downloading' || s.status === 'idle') {
                        C.setText(t + '_stat', _('Downloading') + dot, '#888');
                    } else if (s.status === 'installing') {
                        C.setText(t + '_stat', _('Installing') + dot, '#f0ad4e');
                    } else if (s.status === 'done') {
                        done = true;
                        C.setBar(t + '_bar', 100);
                        C.setText(t + '_stat',
                            _('✓ Complete: %s').format(s.installed || ''), '#28a745');
                        self._info();
                    } else if (s.status === 'error') {
                        done = true;
                        C.setText(t + '_stat',
                            _('✗ %s').format(
                                lucky_log.translate(s.msg || _('Error'))
                            ), '#dc3545');
                        if (t === 'upd') C.setVis('upd_retry', true);
                    }
                }

                if (done) {
                    clearInterval(self[tk]);
                    [t + '_chk', t + '_do'].forEach(function(id) {
                        var e = $(id); if (e) e.disabled = false;
                    });
                }
            });
        }, 1000);
    },

    _sel: function(t) {
        var rels = this['_R' + t] || [];
        var tv   = ($(t + '_tag') || {}).value;
        var fs   = $(t + '_file');
        if (!tv || !fs) return;
        var rel  = rels.filter(function(x) { return x.tag === tv; })[0];
        fs.innerHTML = '';
        if (!rel || !rel.files) return;
        var best = 0;
        rel.files.forEach(function(f, i) {
            fs.appendChild(E('option', {
                value: f.name,
                style: 'background:#fff;color:#333;'
            }, f.name));
            if (f.name === rel.best) best = i;
        });
        fs.selectedIndex = best;
    },

    _info: function() {
        L.resolveDefault(api.info(), {}).then(function(s) {
            if (!s) return;
            [
                ['ii_ver',  s.version      ],
                ['ii_luci', s.luci_version ],
                ['ii_var',  s.variant      ],
                ['ii_arch', s.arch         ],
                ['ii_bin',  s.binpath      ],
                ['ii_cfg',  s.configdir    ]
            ].forEach(function(kv) {
                var e = $(kv[0]);
                if (!e) return;
                e.textContent     = kv[1] || _('Unknown');
                e.style.fontStyle = '';
            });
        });
    }
});