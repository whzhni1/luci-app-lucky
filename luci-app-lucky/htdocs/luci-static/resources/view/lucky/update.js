'use strict';
'require view';
'require uci';
'require ui';
'require lucky/common';

var C   = lucky_common;
var api = {
    info:        C.rpc('get_system_info'),
    updChk:      C.rpc('get_upstream_version', ['mirror', 'release_type', 'variant']),
    updStat:     C.rpc('get_update_status'),
    updDo:       C.rpc('do_update',            ['tag', 'filename']),
    luciChk:     C.rpc('check_luci'),
    luciStat:    C.rpc('get_luci_update_status'),
    luciDo:      C.rpc('do_update_luci',       ['tag', 'filename']),
    autoLog:     C.rpc('get_auto_update_log',  ['type']),
    cleanUpdate: C.rpc('clean_update')
};

var $    = function(id) { return document.getElementById(id); };
var ucig = function(k) { return uci.get('lucky', 'lucky', k); };

function mkSelect(id, opts, cur, onChange) {
    var sel = E('select', { id: id, class: 'lucky-select' },
        opts.map(function(o) {
            return E('option', {
                value: o.v,
                selected: o.v === cur ? 'selected' : null
            }, o.l);
        }));
    if (onChange) sel.addEventListener('change', onChange);
    return sel;
}

function buildInfoGrid() {
    var items = [
        [_('Lucky Version'), 'ii_ver'],  [_('LuCI Version'), 'ii_luci'],
        [_('Variant'),       'ii_var'],  [_('Architecture'), 'ii_arch'],
        [_('Binary Path'),   'ii_bin'],  [_('Data Dir'),     'ii_cfg']
    ];
    return C.buildCard(_('Current Installation'),
        C.buildInfoTiles(items, 150, true), { icon: 'info' });
}

function buildRetryRow(self) {
    var m = ucig('mirror')       || 'github';
    var r = ucig('release_type') || 'stable';
    var v = ucig('variant')      || 'lucky';

    return E('div', { id: 'upd_retry', style: 'display:none;' }, [
        E('div', { class: 'lucky-sels' }, [
            E('span', { class: 'lucky-inline-label' }, _('Switch mirror and retry:')),
            mkSelect('upd_rmir', [
                { v: 'github', l: _('GitHub') },
                { v: 'r66666', l: _('Official') }
            ], m, function() {
                C.setVis('upd_rrel_wrap', this.value === 'r66666', 'inline-flex');
            }),
            E('span', { id: 'upd_rrel_wrap',
                style: 'display:' + (m === 'r66666' ? 'inline-flex' : 'none') + ';' }, [
                mkSelect('upd_rrel', [
                    { v: 'stable', l: _('Stable') },
                    { v: 'beta',   l: _('Beta')   }
                ], r)
            ]),
            mkSelect('upd_rvar', [
                { v: 'lucky', l: _('Standard (lucky)') },
                { v: 'wanji', l: _('Full-featured (wanji)') }
            ], v),
            E('button', {
                type: 'button',
                class: 'lucky-btn lucky-btn-primary',
                click: function() { self._chk('upd', true); }
            }, _('Retry'))
        ])
    ]);
}

function buildUpdateSection(t, title, iconKey, chkLabel, self, extraEl) {
    return C.buildCard(title, [
        E('div', { class: 'lucky-banner-row' }, [
            E('button', {
                type: 'button',
                class: 'lucky-btn lucky-btn-primary',
                id: t + '_chk',
                click: function() { self._chk(t); }
            }, [C.icon('refresh', 14), E('span', {}, chkLabel)]),
            E('span', { id: t + '_stat', class: 'lucky-state' },
                _('Click to check for updates'))
        ]),
        extraEl || '',
        E('div', { id: t + '_sels', class: 'lucky-sels', style: 'display:none;' }, [
            E('label', { class: 'lucky-inline-label' }, _('Version:')),
            E('select', { id: t + '_tag', class: 'lucky-select lucky-select--tag' }),
            E('label', { class: 'lucky-inline-label' }, _('File:')),
            E('select', { id: t + '_file', class: 'lucky-select lucky-select--file' }),
            E('button', {
                type: 'button',
                class: 'lucky-btn lucky-btn-success',
                id: t + '_do',
                click: function() { self._do(t); }
            }, [C.icon('download', 14), E('span', {}, _('Install Now'))])
        ]),
        E('div', { id: t + '_bar_wrap', style: 'display:none;' },
            [C.buildBar(t + '_bar', 'progress')]),
        E('pre', { id: t + '_log', class: 'lucky-log' })
    ], { icon: iconKey });
}

function showAutoLog(type) {
    L.resolveDefault(api.autoLog(type), {}).then(function(res) {
        var el = $('auto_log');
        if (!el) return;
        el.textContent = (res && res.log) ? res.log : _('(No log)');
        el.classList.add('is-open');
        el.scrollTop = el.scrollHeight;
    });
}

return view.extend({
    handleSave: null,
    handleSaveApply: null,
    handleReset: null,

    load: function() {
        return uci.load('lucky');
    },

    render: function() {
        var self = this;

        var content = E('div', { class: 'cbi-map lucky-page' }, [
            E('h2', {}, _('Lucky — Download & Update')),
            buildInfoGrid(),
            buildUpdateSection('upd', _('Lucky Core Update'), 'download',
                _('Check Upstream'), self, buildRetryRow(self)),
            buildUpdateSection('luci', _('LuCI App Update'), 'download',
                _('Check LuCI'), self),
            C.buildCard(_('Auto Update Log'), [
                E('div', { class: 'lucky-banner-row' }, [
                    E('button', {
                        type: 'button',
                        class: 'lucky-btn lucky-btn-primary',
                        click: function() { showAutoLog(''); }
                    }, [C.icon('clock', 14), E('span', {}, _('Auto Update Log'))]),
                    E('button', {
                        type: 'button',
                        class: 'lucky-btn lucky-btn-primary',
                        click: function() { showAutoLog('run'); }
                    }, [C.icon('info', 14), E('span', {}, _('Runtime Log'))]),
                    E('button', {
                        type: 'button',
                        class: 'lucky-btn lucky-btn-danger',
                        click: function() {
                            if (!window.confirm(_('Clear all update cache and logs?'))) return;
                            L.resolveDefault(api.cleanUpdate(), {}).then(function(res) {
                                var ok = res && res.result === 'ok';
                                ['upd_log', 'luci_log', 'auto_log'].forEach(function(id) {
                                    var e = $(id);
                                    if (e) { e.textContent = ''; e.classList.remove('is-open'); }
                                });
                                C.showToast({
                                    ok:      ok,
                                    title:   ok ? _('Done') : _('Failed'),
                                    msg:     ok ? _('Cache cleared.') : _('Clear failed.'),
                                    timeout: ok ? 2000 : 0
                                });
                            });
                        }
                    }, [C.icon('trash', 14), E('span', {}, _('Clear Cache'))])
                ]),
                E('pre', { id: 'auto_log', class: 'lucky-log' })
            ], { icon: 'clock' })
        ]);

        C.initThemeButton();
        this._info();
        return content;
    },

    _chk: function(t, retry) {
        var self = this;
        var btn  = $(t + '_chk');
        if (btn) btn.disabled = true;
        C.setVis(t + '_retry', false);
        C.setVis(t + '_sels',  false);
        C.setVis(t + '_bar_wrap', false);
        C.setBar(t + '_bar', 0);
        var lg = $(t + '_log');
        if (lg) { lg.textContent = ''; lg.classList.add('is-open'); }
        C.setState(t + '_stat', _('Checking upstream…'), 'busy');

        var p = [];
        if (t === 'upd') {
            var mi = retry ? $('upd_rmir').value : (ucig('mirror')       || 'github');
            var re = retry ? $('upd_rrel').value : (ucig('release_type') || 'stable');
            var va = retry ? $('upd_rvar').value : (ucig('variant')      || 'lucky');
            p = [mi, mi === 'r66666' ? re : '', va];
        }

        L.resolveDefault(api[t + 'Chk'].apply(null, p), {}).then(function(res) {
            if (!res || res.result === 'error') {
                if (btn) btn.disabled = false;
                C.setState(t + '_stat', _('Failed to start check'), 'err');
                if (t === 'upd') C.setVis('upd_retry', true);
                return;
            }
            self._poll(t, 'chk');
        });
    },

    _do: function(t) {
        var self = this;
        var tag  = ($(t + '_tag')  || {}).value;
        var fn   = ($(t + '_file') || {}).value;
        var btn  = $(t + '_do');
        if (!tag || !fn) {
            C.setState(t + '_stat', _('Please select version and file first'), 'err');
            return;
        }
        if (btn) btn.disabled = true;
        C.setVis(t + '_bar_wrap', true);
        C.setBar(t + '_bar', 0);
        var lg = $(t + '_log');
        if (lg) { lg.textContent = ''; lg.classList.add('is-open'); }
        C.setState(t + '_stat', _('Starting…'), 'busy');

        L.resolveDefault(api[t + 'Do'](tag, fn), {}).then(function(res) {
            if (!res || res.result !== 'ok') {
                if (btn) btn.disabled = false;
                C.setState(t + '_stat', _('Failed to start install'), 'err');
                return;
            }
            self._poll(t, 'do');
        });
    },

    _poll: function(t, phase) {
        var self = this;
        var tk   = t + '_' + phase + '_poller';
        if (self[tk]) self[tk].stop();

        self[tk] = C.LogPoller({
            status:   function() { return api[t + 'Stat'](); },
            textEl:   t + '_log',
            bar:      phase === 'do' ? t + '_bar' : null,
            interval: 1000,
            terminal: phase === 'chk'
                ? function(s) {
                    var code = s.code || s.status;
                    return code === 'ready' || code === 'error';
                }
                : function(s) {
                    var code = s.code || s.status;
                    return code === 'done' || code === 'error';
                },
            onTick: function(s) {
                var code = s.code || s.status;
                if (phase === 'chk') {
                    if (code === 'checking' || code === 'idle')
                        C.setState(t + '_stat', _('Checking upstream…'), 'busy');
                    else if (code === 'ready')
                        C.setState(t + '_stat',
                            _('Found %d version(s)').format(s.count || 0), 'ok');
                    else if (code === 'error')
                        C.setState(t + '_stat', C.taskMessage(s), 'err');
                } else {
                    if (code === 'downloading' || code === 'idle')
                        C.setState(t + '_stat', _('Downloading…'), 'busy');
                    else if (code === 'installing' || code === 'installing_luci')
                        C.setState(t + '_stat', C.taskMessage(s), 'busy');
                    else if (code === 'done')
                        C.setState(t + '_stat',
                            _('Complete: %s').format(s.installed || ''), 'ok');
                    else if (code === 'error')
                        C.setState(t + '_stat', C.taskMessage(s), 'err');
                }
            },
            onDone: function(s) {
                var code = s.code || s.status;
                [t + '_chk', t + '_do'].forEach(function(id) {
                    var e = $(id);
                    if (e) e.disabled = false;
                });

                if (phase === 'chk') {
                    if (code === 'ready' && s.releases) {
                        self['_R' + t] = s.releases;
                        var ts = $(t + '_tag');
                        ts.innerHTML = '';
                        s.releases.forEach(function(r) {
                            ts.appendChild(E('option', { value: r.tag }, r.tag));
                        });
                        self._sel(t);
                        C.setVis(t + '_sels', true, 'flex');
                    } else if (code === 'error' && t === 'upd') {
                        C.setVis('upd_retry', true);
                    }
                } else {
                    if (code === 'done') {
                        C.setBar(t + '_bar', 100);
                        self._info();
                    } else if (code === 'error' && t === 'upd') {
                        C.setVis('upd_retry', true);
                    }
                }
            }
        });
        self[tk].start();
    },

    _sel: function(t) {
        var rels = this['_R' + t] || [];
        var tv   = ($(t + '_tag') || {}).value;
        var fs   = $(t + '_file');
        if (!tv || !fs) return;
        var rel  = rels.filter(function(x) { return x.tag === tv; })[0];
        fs.innerHTML = '';
        if (!rel || !rel.files) return;

        var files = rel.files;
        if (t === 'upd') {
            var variant = ucig('variant') || 'lucky';
            files = files.filter(function(f) {
                var isWanji = f.name.indexOf('wanji') !== -1;
                return variant === 'wanji' ? isWanji : !isWanji;
            });
        }
        var best = 0;
        files.forEach(function(f, i) {
            fs.appendChild(E('option', { value: f.name }, f.name));
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

