'use strict';
'require view';
'require rpc';
'require ui';

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

var KEYS = [
    'port', 'safe', 'ssl', 'delay', 'configdir', 'binpath',
    'arch', 'mirror', 'release_type', 'variant',
    'respawn_threshold', 'respawn_timeout', 'respawn_retry',
    'auto_update', 'update_interval'
];

var api = {
    settings: mkRpc('get_settings'),
    arch:     mkRpc('get_arch'),
    save:     mkRpc('save_settings', KEYS),
    reset:    mkRpc('reset_user')
};

return view.extend({
    load: function() {
        return Promise.all([
            loadCommon(),
            L.resolveDefault(api.settings(), {}),
            L.resolveDefault(api.arch(),     {})
        ]);
    },

    handleSave:      function() { return this._save(); },
    handleSaveApply: null,
    handleReset:     function() { location.reload(); },

    _save: function() {
        var C = window.luckyUI;
        return api.save.apply(null, KEYS.map(C.fval)).then(function(res) {
            var ok = res && res.result === 'ok';
            C.showToast({
                ok:      ok,
                title:   ok ? _('Saved') : _('Save Failed'),
                msg:     ok ? _('Settings saved successfully.')
                            : _('Save failed, please check the log.'),
                timeout: ok ? 2000 : 0
            });
        });
    },

    render: function(data) {
        var C    = window.luckyUI;
        var cfg  = data[1] || {};
        var arch = (data[2] || {}).arch || _('Unknown');

        var isR        = cfg.mirror === 'r66666';
        var autoUpdate = cfg.auto_update === '1';

        var resetBtn = E('button', {
            style: C.CSS.btn.danger,
            click: function() {
                if (!window.confirm(
                    _('Reset credentials to 666? Service will restart.'))) return;
                L.resolveDefault(api.reset(), {}).then(function(res) {
                    C.showToast({
                        ok:      !!(res && res.result),
                        title:   (res && res.result)
                                     ? _('Reset Success') : _('Reset Failed'),
                        msg:     (res && res.result)
                                     ? _('Credentials reset to 666, service restarting…')
                                     : _('Reset failed, please check the log.'),
                        timeout: (res && res.result) ? 2500 : 0
                    });
                });
            }
        }, _('Reset password'));

        var descThreshold = E('span', {}, '');
        var descTimeout   = E('span', {}, '');
        var descRetry     = E('span', {}, '');

        function fmtThreshold(v) {
            var n = parseInt(v) || 0;
            return n === 0
                ? _('Uptime > 0s always resets the retry counter')
                : _('Uptime exceeds %ss, retry counter resets').format(n);
        }
        function fmtTimeout(v) {
            return _('Wait %ss before restarting after a crash').format(parseInt(v) || 0);
        }
        function fmtRetry(v) {
            var n = parseInt(v) || 0;
            return n === 0
                ? _('Unlimited retries')
                : _('Stop after %s restart(s), 0 No limits').format(n);
        }

        descThreshold.textContent = fmtThreshold(cfg.respawn_threshold || '3600');
        descTimeout.textContent   = fmtTimeout(cfg.respawn_timeout     || '30');
        descRetry.textContent     = fmtRetry(cfg.respawn_retry         || '5');

        var mapEl = E('div', { class: 'cbi-map' }, [
            E('h2', {}, _('Lucky — Settings')),

            C.buildCard('⚙ ' + _('Basic Service'), [
                C.buildFormRow('text', 'port', _('Web UI Port'),
                    cfg.port || '16601',
                    _('Default: 16601'),
                    { style: 'width:100px;' }),
                C.buildFormRow('text', 'safe', _('Safe Entrance'),
                    cfg.safe || '',
                    _('URL path prefix, e.g.: mysecret')),
                C.buildFormRow('toggle', 'ssl', _('Enable HTTPS'),
                    cfg.ssl || '0',
                    _('Encrypt access using SSL/TLS')),
                C.buildFormRow('number', 'delay', _('Delayed Start (s)'),
                    cfg.delay || '60',
                    _('Delay before starting after boot (only when uptime < 120s)'),
                    { style: 'width:80px;', min: '0' }),
                C.buildFormRow('custom', 'reset', _('Reset Credentials'),
                    null,
                    _('Reset username and password back to 666'),
                    resetBtn)
            ]),

            E('div', { style: C.CSS.gridAuto(280, 16) }, [
                C.buildCard('📁 ' + _('Path & Architecture'), [
                    C.buildFormRow('text', 'configdir', _('Data Directory'),
                        cfg.configdir || '/etc/config/lucky.daji',
                        _('Lucky runtime data directory')),
                    C.buildFormRow('text', 'binpath', _('Binary Path'),
                        cfg.binpath || '/usr/bin/lucky',
                        _('Full path to the Lucky executable')),
                    C.buildFormRow('text', 'arch', _('Architecture'),
                        cfg.arch || 'auto',
                        E('span', {}, [
                            _('Detected:'), E('strong', {}, arch), E('br'),
                            _('Leave "auto" to detect automatically')
                        ]),
                        { style: 'width:120px;' })
                ]),
                C.buildCard('🔄 ' + _('Download & Update'), [
                    C.buildFormRow('select', 'mirror', _('Download Mirror'),
                        cfg.mirror || 'github', null, [
                            { v: 'github', l: _('GitHub (github.com/gdy666/lucky)') },
                            { v: 'r66666', l: _('Official (release.66666.plus)') }
                        ]),
                    C.buildFormRow('select', 'release_type', _('Release Channel'),
                        cfg.release_type || 'stable',
                        _('Beta only available with Official mirror'), [
                            { v: 'stable', l: _('Stable') },
                            { v: 'beta',   l: _('Beta')   }
                        ]),
                    C.buildFormRow('select', 'variant', _('Lucky Variant'),
                        cfg.variant || 'lucky',
                        _('Standard: smaller. Full-featured: more functions'), [
                            { v: 'lucky', l: _('Standard (lucky)') },
                            { v: 'wanji', l: _('Full-featured (wanji)') }
                        ])
                ])
            ]),

            E('div', { style: C.CSS.gridAuto(280, 16) }, [
                C.buildCard('🔁 ' +_('Respawn Policy'), [
                    C.buildFormRow('number', 'respawn_threshold', _('Crash Threshold (s)'),
                        cfg.respawn_threshold || '3600',
                        descThreshold,
                        { style: 'width:80px;', min: '0' }),
                    C.buildFormRow('number', 'respawn_timeout', _('Respawn Delay (s)'),
                        cfg.respawn_timeout || '30',
                        descTimeout,
                        { style: 'width:80px;', min: '0' }),
                    C.buildFormRow('number', 'respawn_retry', _('Max Retries'),
                        cfg.respawn_retry || '5',
                        descRetry,
                        { style: 'width:80px;', min: '0' })
                ]),
                C.buildCard('🕐 ' + _('Auto Update'), [
                    C.buildFormRow('toggle', 'auto_update', _('Enable Auto Update'),
                        cfg.auto_update || '0',
                        _('Periodically check and install the latest version')),
                    C.buildFormRow('number', 'update_interval', _('Check Interval (days)'),
                        cfg.update_interval || '7',
                        _('Range: 1 – 365 days'),
                        { style: 'width:80px;', min: '1', max: '365' })
                ])
            ])
        ]);

        var mirrorEl = mapEl.querySelector('#_f_mirror');
        if (mirrorEl) {
            mirrorEl.addEventListener('change', function() {
                C.rowVis('release_type', this.value === 'r66666');
                C.rowVis('variant',      this.value === 'r66666');
            });
        }

        var autoEl = mapEl.querySelector('#_f_auto_update');
        if (autoEl) {
            autoEl.addEventListener('change', function() {
                C.rowVis('update_interval', this.checked);
            });
        }

        window.setTimeout(function() {
            C.rowVis('release_type',    isR);
            C.rowVis('variant',         isR);
            C.rowVis('update_interval', autoUpdate);

            var elThreshold = mapEl.querySelector('#_f_respawn_threshold');
            var elTimeout   = mapEl.querySelector('#_f_respawn_timeout');
            var elRetry     = mapEl.querySelector('#_f_respawn_retry');

            if (elThreshold) elThreshold.addEventListener('input', function() {
                descThreshold.textContent = fmtThreshold(this.value);
            });
            if (elTimeout) elTimeout.addEventListener('input', function() {
                descTimeout.textContent = fmtTimeout(this.value);
            });
            if (elRetry) elRetry.addEventListener('input', function() {
                descRetry.textContent = fmtRetry(this.value);
            });
        }, 0);

        return mapEl;
    }
});