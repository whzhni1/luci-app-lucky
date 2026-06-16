'use strict';
'require view';
'require poll';
'require rpc';
'require dom';
'require ui';
'require lucky/log';

var SETTINGS = [
    'enabled', 'port', 'safe', 'ssl', 'delay', 'configdir', 'binpath',
    'arch', 'mirror', 'release_type', 'variant', 'auto_update', 'update_interval'
];

var rpcCall = function(method, params) {
    return rpc.declare({ object: 'luci.lucky', method: method, params: params, expect: { '': {} } });
};

var api = {
    status:   rpcCall('get_status'),
    arch:     rpcCall('get_arch'),
    settings: rpcCall('get_settings'),
    save:     rpcCall('save_settings', SETTINGS),
    reset:    rpcCall('reset_user'),
    download: rpcCall('run_update'),
    autoLog:  rpcCall('get_auto_update_log')
};

function val(id) {
    var e = document.getElementById('_f_' + id);
    return e ? (e.type === 'checkbox' ? (e.checked ? '1' : '0') : e.value || '') : '';
}

function buildRow(type, id, label, cfgVal, desc, extra, rowId, hide) {
    var elId = '_f_' + id, input;

    if (type === 'checkbox') {
        input = E('label', { style: 'cursor:pointer;user-select:none;' }, [
            E('input', { type: 'checkbox', id: elId, checked: cfgVal === '1' ? 'checked' : null }),
            E('span', { style: 'margin-left:6px;' }, _('Enable'))
        ]);
    } else if (type === 'select') {
        input = E('select', { id: elId, class: 'cbi-input-select', style: 'width:auto;' },
            extra.map(function(o) {
                return E('option', { value: o.v, selected: o.v === cfgVal ? 'selected' : null }, o.l);
            })
        );
    } else if (type === 'custom') {
        input = extra;
    } else {
        var attrs = Object.assign(
            { type: type, id: elId, class: 'cbi-input-' + (type === 'number' ? 'text' : type), value: cfgVal || '' },
            extra || {}
        );
        if (!attrs.style && type === 'text') attrs.style = 'width:100%;max-width:360px;box-sizing:border-box;';
        input = E('input', attrs);
    }

    return E('div', { id: rowId, style: 'margin-bottom:16px;' + (hide ? 'display:none;' : '') }, [
        E('div', { style: 'font-weight:bold;margin-bottom:4px;' }, label),
        input,
        desc ? E('div', { style: 'font-size:0.85em;color:#888;margin-top:3px;' }, desc) : ''
    ]);
}

return view.extend({
    load: function() {
        return Promise.all([
            L.resolveDefault(api.arch(), {}),
            L.resolveDefault(api.settings(), {}),
            L.resolveDefault(api.status(), {})
        ]);
    },

    handleSave:      function() { return this._saveSettings(false); },
    handleSaveApply: function() { return this._saveSettings(true); },
    handleReset:     function() { location.reload(); },

    _saveSettings: function(andApply) {
        return api.save.apply(null, SETTINGS.map(val)).then(function(res) {
            var ok = res && res.result === 'ok';
            ui.addNotification(null, E('p', {},
                ok ? (andApply ? _('Settings saved, service reloading…') : _('Settings saved successfully'))
                   : _('Save failed')
            ), ok ? 'info' : 'error');
            if (ok && andApply) window.setTimeout(function() { location.reload(); }, 3000);
        });
    },

    _pollDownload: function(logEl) {
        var self = this, dots = 0, lastLen = 0;
        clearInterval(self._dlTimer);
        logEl.style.display = 'block';
        logEl.textContent = _('Waiting') + '...';

        self._dlTimer = setInterval(function() {
            var dot = '.'.repeat((dots = dots % 3 + 1));
            L.resolveDefault(api.autoLog(), {}).then(function(res) {
                var text  = res && res.log ? lucky_log.translate(res.log) : '';
                var lines = text ? text.split('\n').filter(function(l) { return l.trim(); }) : [];

                if (!lines.length) {
                    logEl.textContent = _('Waiting') + dot;
                    return;
                }

                if (lines.length > lastLen) {
                    if (!lastLen) logEl.textContent = '';
                    logEl.textContent += lines.slice(lastLen).join('\n') + '\n';
                    lastLen = lines.length;
                    logEl.scrollTop = logEl.scrollHeight;
                } else {
                    logEl.textContent = logEl.textContent.replace(/\.+$/, '') + dot;
                }

                var last = lines[lines.length - 1] || '';
                if (last.indexOf('complete') !== -1) {
                    clearInterval(self._dlTimer);
                    ui.addNotification(null, E('p', {}, _('Download and installation complete.')), 'info');
                } else if (last.indexOf('ERROR') !== -1) {
                    clearInterval(self._dlTimer);
                    ui.addNotification(null, E('p', {}, _('Download failed, please check the log.')), 'error');
                }
            });
        }, 1000);
    },

    render: function(data) {
        var self = this;
        var cfg         = data[1] || {};
        var detectedArch = (data[0] || {}).arch || _('Unknown');
        var isR66666    = cfg.mirror === 'r66666';
        var protocol    = cfg.ssl === '1' ? 'https:' : 'http:';
        var initStatus  = data[2] || {};

        var statusEl = E('div', { id: '_lucky_status' }, E('em', {}, _('Collecting data…')));
        var dlLogEl  = E('pre', { id: '_dl_log', style: [
            'display:none', 'margin-top:10px', 'background:#1e1e1e', 'color:#d4d4d4',
            'padding:10px', 'font-size:12px', 'height:200px', 'overflow-y:auto',
            'border-radius:4px', 'white-space:pre-wrap', 'font-family:monospace'
        ].join(';') });

        if (initStatus.binary_missing && window.confirm(
            _('Lucky binary not found. Download it now automatically?')
        )) {
            L.resolveDefault(api.download(), {}).then(function(res) {
                var ok = res && res.result === 'ok';
                ui.addNotification(null, E('p', {},
                    ok ? _('Download started, please wait…')
                       : _('Failed to start download, please check the log.')
                ), ok ? 'info' : 'error');
                if (ok) self._pollDownload(dlLogEl);
            });
        }

        poll.add(function() {
            return L.resolveDefault(api.status(), {}).then(function(res) {
                var run  = res && res.running;
                var nodes = [E('em', {}, E('span', {
                    style: 'color:' + (run ? '#4caf50' : '#f44336') + ';font-weight:bold;'
                }, (run ? '●' : '○') + ' Lucky — ' + (run ? _('RUNNING') : _('NOT RUNNING'))))];

                if (run) {
                    var port = val('port') || cfg.port || '16601';
                    var safe = (val('safe') || cfg.safe || '').trim();
                    var url  = (val('ssl') === '1' ? 'https:' : protocol)
                             + '//' + window.location.hostname + ':' + port
                             + '/' + (safe ? safe + '/' : '');
                    nodes.push(E('input', {
                        type: 'button', class: 'cbi-button cbi-button-apply',
                        style: 'margin-left:16px;', value: _('Open Lucky Web UI'),
                        click: function() { window.open(url); }
                    }));
                }
                dom.content(statusEl, nodes);
            });
        }, 3);

        var resetBtn = E('button', {
            class: 'btn cbi-button cbi-button-remove',
            style: 'background-color:#f44336;color:#fff;border-color:#f44336;',
            click: function() {
                if (!window.confirm(_('Are you sure you want to reset credentials to 666? The service will restart automatically.')))
                    return;
                L.resolveDefault(api.reset(), {}).then(function(res) {
                    var ok = res && res.result;
                    ui.addNotification(null, E('p', {},
                        ok ? _('Credentials have been reset to: 666, service is restarting…')
                           : _('Reset failed, please check the log.')
                    ), ok ? 'info' : 'error');
                });
            }
        }, E('span', { style: 'color:#dc3545;font-weight:bold;' }, _('Reset password')));

        var mapEl = E('div', { class: 'cbi-map' }, [
            E('h2', {}, _('Lucky')),
            E('p', { class: 'cbi-map-descr' }, _('Port forward · DDNS · Reverse Proxy · WoL · IoT · and more')),

            E('div', { class: 'cbi-section' }, [
                statusEl, dlLogEl,
                E('div', { style: 'margin-top:6px;font-size:0.85em;color:#888;' }, [
                    _('LuCI App: '),
                    E('a', {
                        href: 'https://github.com/whzhni1/luci-app-lucky',
                        target: '_blank', style: 'color:#2196f3;'
                    }, 'github.com/whzhni1/luci-app-lucky')
                ])
            ]),

            E('div', { class: 'cbi-section' }, [
                E('h3', {}, _('Service Settings')),
                buildRow('checkbox', 'enabled',  _('Enable Lucky'),         cfg.enabled || '0',
                    _('Start Lucky service automatically on boot')),
                buildRow('text',     'port',     _('Web UI Port'),          cfg.port    || '16601',
                    _('Port for accessing the Lucky web interface, default: 16601'), { style:'width:120px' }),
                buildRow('text',     'safe',     _('Safe Entrance'),        cfg.safe,
                    _('Custom URL path prefix to protect the web interface, e.g.: mysecret')),
                buildRow('checkbox', 'ssl',      _('Enable HTTPS'),         cfg.ssl     || '0',
                    _('Encrypt web interface access using SSL/TLS')),
                buildRow('number',   'delay',    _('Delayed Start (seconds)'), cfg.delay || '60',
                    _('Delay before starting after boot, only applied when system uptime < 120s'), { style:'width:80px', min:'0' }),
                buildRow('custom',   'reset',    _('Reset Credentials'),    null,
                    _('Reset admin username and password back to 666'), resetBtn)
            ]),

            E('div', { class: 'cbi-section' }, [
                E('h3', {}, _('Path & Architecture')),
                buildRow('text', 'configdir', _('Data Directory'),      cfg.configdir || '/etc/config/lucky.daji',
                    _('Directory where Lucky stores runtime configuration and data')),
                buildRow('text', 'binpath',   _('Binary Path'),         cfg.binpath   || '/usr/bin/lucky',
                    _('Full path to the Lucky executable binary')),
                buildRow('text', 'arch',      _('Device Architecture'), cfg.arch      || 'auto',
                    E('span', {}, [
                        _('Current detected: '), E('strong', {}, E('code', {}, detectedArch)), E('br'),
                        _('Leave as "auto" to detect automatically, or manually specify to override')
                    ]), { style:'width:200px' })
            ]),

            E('div', { class: 'cbi-section' }, [
                E('h3', {}, _('Download & Update Settings')),
                buildRow('select', 'mirror',       _('Download Mirror'),   cfg.mirror       || 'github',
                    _('Select the download source for Lucky binary updates'), [
                        { v: 'github', l: _('GitHub (github.com/gdy666/lucky)') },
                        { v: 'r66666', l: _('Official (release.66666.plus)') }
                    ]),
                buildRow('select', 'release_type', _('Release Channel'),   cfg.release_type || 'stable',
                    _('Beta channel is only available when using the Mirror source'), [
                        { v: 'stable', l: _('Stable') }, { v: 'beta', l: _('Beta') }
                    ], '_row_reltype', !isR66666),
                buildRow('select', 'variant',      _('Lucky Variant'),     cfg.variant      || 'lucky',
                    _('Standard: smaller size. Full-featured (wanji): includes additional features'), [
                        { v: 'lucky', l: _('Standard (lucky)') }, { v: 'wanji', l: _('Full-featured (wanji)') }
                    ], '_row_variant', !isR66666)
            ]),

            E('div', { class: 'cbi-section' }, [
                E('h3', {}, _('Auto Update')),
                buildRow('checkbox', 'auto_update',     _('Enable Auto Update'),      cfg.auto_update     || '0',
                    _('Periodically check and install the latest Lucky version via cron job')),
                buildRow('number',   'update_interval', _('Check Interval (days)'),   cfg.update_interval || '7',
                    _('Number of days between each automatic update check, range: 1 - 365'),
                    { style:'width:80px', min:'1', max:'365' }, '_row_interval', cfg.auto_update !== '1')
            ])
        ]);

        mapEl.querySelector('#_f_mirror').addEventListener('change', function() {
            var show = this.value === 'r66666';
            ['#_row_reltype', '#_row_variant'].forEach(function(sel) {
                mapEl.querySelector(sel).style.display = show ? 'block' : 'none';
            });
        });

        mapEl.querySelector('#_f_auto_update').addEventListener('change', function() {
            mapEl.querySelector('#_row_interval').style.display = this.checked ? 'block' : 'none';
        });

        return mapEl;
    }
});