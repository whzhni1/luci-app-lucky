'use strict';
'require view';
'require poll';
'require rpc';
'require dom';
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
    status:  mkRpc('get_status'),
    info:    mkRpc('get_system_info'),
    settings:mkRpc('get_settings'),
    stats:   mkRpc('get_process_stats'),
    toggle:  mkRpc('toggle_service', ['action']),
    autoLog: mkRpc('get_auto_update_log', ['type']),
    download:mkRpc('run_update')
};

function fmtUptime(sec) {
    if (!sec || sec < 0) return _('N/A');
    var d = Math.floor(sec / 86400),
        h = Math.floor((sec % 86400) / 3600),
        m = Math.floor((sec % 3600) / 60),
        s = sec % 60;
    return (d ? d + _('d') + ' ' : '') +
           (d || h ? h + _('h') + ' ' : '') +
           (d || h || m ? m + _('m') + ' ' : '') +
           s + _('s');
}

function fmtMem(kb) {
    if (!kb) return '—';
    return kb >= 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb + ' KB';
}

function buildKVRow(label, id, value) {
    return [
        E('span', { style: 'color:#888;white-space:nowrap;' }, label),
        E('span', { id: id,
            style: 'font-weight:600;word-break:break-all;color:#333;' },
            value || _('Unknown'))
    ];
}

function buildLinkBtn(label, url) {
    return E('a', {
        href: url, target: '_blank',
        style: [
            'display:inline-flex', 'align-items:center',
            'padding:7px 18px', 'border-radius:6px',
            'background:#f0f4ff', 'color:#1976d2',
            'font-size:13px', 'font-weight:500',
            'text-decoration:none', 'border:1px solid #c5d8f8',
            'white-space:nowrap'
        ].join(';'),
        onmouseover: function() { this.style.background = '#dceaff'; },
        onmouseout:  function() { this.style.background = '#f0f4ff'; }
    }, label);
}

function buildMissingCard(C) {
    var logEl  = E('pre', { style: C.CSS.log });
    var statEl = E('span', {
        style: 'font-size:13px;color:#888;margin-left:8px;'
    }, '');
    var cardEl;

    var dlBtn = E('button', {
        style: C.CSS.btn.primary,
        click: function() {
            dlBtn.disabled     = true;
            statEl.textContent = _('Starting download…');
            statEl.style.color = '#888';
            L.resolveDefault(api.download(), {}).then(function(res) {
                if (!res || res.result !== 'ok') {
                    dlBtn.disabled     = false;
                    statEl.textContent = _('Failed to start, please check log.');
                    statEl.style.color = '#c62828';
                    return;
                }
                statEl.textContent  = _('Downloading…');
                logEl.style.display = 'block';
                var dots = 0, lastLen = 0;
                var timer = setInterval(function() {
                    var dot = '.'.repeat(dots = dots % 3 + 1);
                    L.resolveDefault(api.autoLog({ type: '' }), {}).then(function(r) {
                        var text  = lucky_log.translate(
                            (r && r.log) ? r.log : '');
                        var lines = text
                            ? text.split('\n').filter(function(l) {
                                return l.trim(); })
                            : [];
                        if (!lines.length) {
                            statEl.textContent = _('Waiting') + dot;
                            return;
                        }
                        if (lines.length > lastLen) {
                            if (!lastLen) logEl.textContent = '';
                            logEl.textContent += lines.slice(lastLen).join('\n') + '\n';
                            lastLen = lines.length;
                            logEl.scrollTop = logEl.scrollHeight;
                        }
                        var last = lines[lines.length - 1] || '';
                        if (last.indexOf('complete') !== -1 ||
                            last.indexOf(_('Complete')) !== -1) {
                            clearInterval(timer);
                            if (cardEl) cardEl.style.display = 'none';
                            C.showToast({
                                ok: true,
                                msg: _('Lucky core downloaded successfully. Service is starting…'),
                                timeout: 3000
                            });
                        } else if (last.indexOf('ERROR') !== -1 ||
                                   last.indexOf('error') !== -1) {
                            clearInterval(timer);
                            dlBtn.disabled     = false;
                            statEl.textContent = _('✗ Download failed, see log below.');
                            statEl.style.color = '#c62828';
                        } else {
                            statEl.textContent = _('Downloading') + dot;
                        }
                    });
                }, 1500);
            });
        }
    }, _('Download Lucky Core'));

    cardEl = E('div', { id: 'missing_card', style: [
        'background:#fff8e1', 'border:1px solid #ffe082',
        'border-radius:12px', 'padding:20px 24px', 'margin-bottom:16px'
    ].join(';') }, [
        E('div', {
            style: 'display:flex;align-items:center;gap:8px;margin-bottom:8px;'
        }, [
            E('span', { style: 'font-size:20px;' }, '⚠️'),
            E('span', { style: 'font-weight:700;font-size:15px;color:#e65100;' },
                _('Lucky core binary not found'))
        ]),
        E('div', { style: 'font-size:13px;color:#888;margin-bottom:12px;' },
            _('The Lucky executable is missing. Download it to start the service.')),
        E('div', {
            style: 'display:flex;align-items:center;flex-wrap:wrap;gap:8px;'
        }, [ dlBtn, statEl ]),
        logEl
    ]);
    return cardEl;
}

return view.extend({
    handleSave: null, handleSaveApply: null, handleReset: null,

    _prevProc:  0,
    _prevTotal: 0,

    load: function() {
        return Promise.all([
            loadCommon(),
            L.resolveDefault(api.status(),   {}),
            L.resolveDefault(api.info(),     {}),
            L.resolveDefault(api.settings(), {})
        ]);
    },

    render: function(data) {
        var self   = this;
        var C      = window.luckyUI;
        var status = data[1] || {};
        var info   = data[2] || {};
        var cfg    = data[3] || {};

        var proto = cfg.ssl === '1' ? 'https' : 'http';
        var port  = cfg.port || '16601';
        var safe  = cfg.safe || '';
        var url   = proto + '://' + window.location.hostname +
                    ':' + port + '/' + (safe ? safe + '/' : '');

        var toggleInput = null;

        var toggleEl = C.buildToggle('st_enabled', cfg.enabled === '1',
            function() {
                toggleInput = this;
                var action = this.checked ? 'enable' : 'disable';
                L.resolveDefault(api.toggle(action), {}).then(function(res) {
                    if (!res || res.result !== 'ok') {
                        toggleInput.checked = !toggleInput.checked;
                    }
                });
            }
        );

        var restartBtn = C.buildRestartBtn(function() {
            var btn = this;
            btn.disabled = true;
            L.resolveDefault(api.toggle('restart'), {}).then(function() {
                window.setTimeout(function() { btn.disabled = false; }, 3000);
            });
        }, _('Restart Lucky'));

        var bannerEl = E('div', { style: C.CSS.card + ';margin-bottom:16px;' }, [
            E('div', {
                style: 'display:flex;align-items:center;gap:10px;' +
                       'margin-bottom:14px;flex-wrap:wrap;'
            }, [
                toggleEl,
                E('span', { style: 'font-size:14px;font-weight:500;color:#333;' },
                    _('Enable Lucky')),
                restartBtn
            ]),
            E('div', {
                style: 'display:flex;align-items:center;' +
                       'justify-content:space-between;flex-wrap:wrap;gap:12px;'
            }, [
                E('div', {}, [
                    E('div', { id: 'st_dot',
                        style: 'font-size:20px;font-weight:700;' +
                               'margin-bottom:6px;color:#888;'
                    }, '○ Lucky — ' + _('Checking...')),
                    E('div', { id: 'st_uptime',
                        style: 'font-size:13px;color:#aaa;' }, '—')
                ]),
                E('div', { id: 'st_btn' })
            ])
        ]);

        var metricsGrid = E('div', { style: C.CSS.gridAuto(200, 16) }, [
            E('div', { style: C.CSS.card }, [
                E('div', { style: C.CSS.cardTitle }, _('CPU Usage')),
                E('div', { id: 'st_cpu', style: C.CSS.cardValue }, '—'),
                C.buildBar('bar_cpu'),
                E('div', { id: 'st_thr', style: C.CSS.cardSub }, '—')
            ]),
            E('div', { style: C.CSS.card }, [
                E('div', { style: C.CSS.cardTitle }, _('Memory')),
                E('div', { id: 'st_mem', style: C.CSS.cardValue }, '—'),
                C.buildBar('bar_mem'),
                E('div', { id: 'st_memp', style: C.CSS.cardSub }, '—')
            ]),
            E('div', { style: C.CSS.card }, [
                E('div', { style: C.CSS.cardTitle }, _('Process')),
                E('div', { id: 'st_pid', style: C.CSS.cardValue }, '—'),
                E('div', { id: 'st_thr2', style: C.CSS.cardSub }, '—')
            ])
        ]);

        var infoGrid = E('div', { style: C.CSS.gridAuto(240, 16) }, [
            C.buildCard(_('Version Info'),
                E('div', {
                    style: 'display:grid;grid-template-columns:auto 1fr;' +
                           'gap:6px 16px;font-size:14px;min-width:220px;'
                }, [].concat(
                    buildKVRow('Lucky',      'si_ver',  info.version      || _('Unknown')),
                    buildKVRow('LuCI',       'si_luci', info.luci_version || _('Unknown')),
                    buildKVRow(_('Variant'), 'si_var',  info.variant      || _('Unknown')),
                    buildKVRow(_('Arch'),    'si_arch', info.arch         || _('Unknown'))
                ))
            ),
            C.buildCard(_('Access Info'),
                E('div', {
                    style: 'display:grid;grid-template-columns:auto 1fr;' +
                           'gap:6px 16px;font-size:14px;min-width:220px;'
                }, [].concat(
                    buildKVRow(_('Port'),     'si_port',  port),
                    buildKVRow(_('Protocol'), 'si_proto', proto.toUpperCase()),
                    buildKVRow(_('Entrance'), 'si_safe',  safe ? '/' + safe + '/' : '/'),
                    buildKVRow(_('URL'),      'si_url',   url)
                ))
            )
        ]);

        var linkCard = E('div', { style: C.CSS.card + ';margin-bottom:16px;' }, [
            E('div', {
                style: 'display:flex;justify-content:center;' +
                       'align-items:center;flex-wrap:wrap;gap:12px;'
            }, [
                buildLinkBtn('🌐 ' + _('Official Website'), 'https://lucky666.cn/'),
                buildLinkBtn('⭐ GitHub Lucky',
                    'https://github.com/gdy666/lucky/releases'),
                buildLinkBtn('📦 GitHub LuCI',
                    'https://github.com/whzhni1/luci-app-lucky')
            ])
        ]);

        var children = [ E('h2', {}, _('Lucky — Status')) ];
        if (status.binary_missing) children.push(buildMissingCard(C));
        children.push(bannerEl, metricsGrid, infoGrid, linkCard);

        var mapEl = E('div', { class: 'cbi-map' }, children);

        poll.add(function() {
            return Promise.all([
                L.resolveDefault(api.status(), {}),
                L.resolveDefault(api.stats(),  {})
            ]).then(function(r) {
                var st  = r[0] || {}, ps = r[1] || {};
                var run = !!st.running;

                var dotEl = document.getElementById('st_dot');
                if (dotEl) {
                    dotEl.textContent = (run ? '● ' : '○ ') + 'Lucky — ' +
                        (run ? _('RUNNING') : _('NOT RUNNING'));
                    dotEl.style.color = run ? '#2e7d32' : '#c62828';
                }

                var uptEl = document.getElementById('st_uptime');
                if (uptEl) {
                    uptEl.textContent = run
                        ? _('Uptime:') + fmtUptime(ps.uptime_seconds) : '—';
                    uptEl.style.color = run ? '#555' : '#aaa';
                }

                var btnEl = document.getElementById('st_btn');
                if (btnEl) {
                    if (run && !btnEl.hasChildNodes()) {
                        dom.content(btnEl, E('button', {
                            style: C.CSS.btn.primary,
                            click: function() { window.open(url); }
                        }, _('Open Lucky Web UI')));
                    } else if (!run && btnEl.hasChildNodes()) {
                        dom.content(btnEl, []);
                    }
                }

                var cpu = 0;
                if (run && ps.proc_ticks !== undefined) {
                    var pd = ps.proc_ticks  - self._prevProc;
                    var td = ps.total_ticks - self._prevTotal;
                    if (td > 0 && self._prevTotal > 0) {
                        cpu = Math.round(pd * (ps.cores || 1) * 1000 / td) / 10;
                        cpu = Math.max(0, Math.min(100, cpu));
                    }
                    self._prevProc  = ps.proc_ticks;
                    self._prevTotal = ps.total_ticks;
                }

                C.setText('st_cpu', run ? cpu.toFixed(1) + '%' : '—');
                C.setBar('bar_cpu', cpu);
                C.setText('st_thr', run && ps.cores
                    ? _('Cores:') + ps.cores : '—');

                var memp = run ? (ps.mem_percent || 0) : 0;
                C.setText('st_mem',  run ? fmtMem(ps.mem_rss) : '—');
                C.setText('st_memp', run ? memp.toFixed(1) + '%' : '—');
                C.setBar('bar_mem', memp);

                C.setText('st_pid',  run && ps.pid ? String(ps.pid) : '—');
                C.setText('st_thr2', run && ps.threads
                    ? _('Threads:') + ps.threads : '—');
            });
        }, 3);

        return mapEl;
    }
});