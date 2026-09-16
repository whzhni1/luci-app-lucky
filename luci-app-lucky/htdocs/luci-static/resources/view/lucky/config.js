'use strict';
'require view';
'require ui';
'require lucky/common';

var C   = lucky_common;
var KEYS = [
    'port', 'safe', 'internet', 'delay', 'configdir', 'binpath',
    'arch', 'mirror', 'release_type', 'variant',
    'respawn_threshold', 'respawn_timeout', 'respawn_retry',
    'auto_update', 'update_interval'
];

var api = {
    settings:      C.rpc('get_settings'),
    arch:          C.rpc('get_arch'),
    save:          C.rpc('save_settings', KEYS),
    reset:         C.rpc('reset_user'),
    listBackups:   C.rpc('list_backups'),
    restoreBackup: C.rpc('restore_backup', ['filename'])
};

return view.extend({
    load: function() {
        return Promise.all([
            L.resolveDefault(api.settings(), {}),
            L.resolveDefault(api.arch(),     {})
        ]);
    },

    handleSave:      function() { return this._save(); },
    handleSaveApply: null,
    handleReset:     function() { location.reload(); },

    _save: function() {
        return api.save.apply(null, KEYS.map(C.fval)).then(function(res) {
            var ok = res && res.result === 'ok';
            C.showToast({
                ok:      ok,
                title:   ok ? _('Saved') : _('Save Failed'),
                msg:     ok ? _('Settings saved successfully.')
                            : _('Save failed'),
                timeout: ok ? 2000 : 0
            });
        });
    },

    render: function(data) {
        var cfg  = data[0] || {};
        var arch = (data[1] || {}).arch || _('Unknown');

        var isR        = cfg.mirror === 'r66666';
        var autoUpdate = cfg.auto_update === '1';

        var restoreBtn = E('button', {
            type: 'button',
            class: 'lucky-btn lucky-btn-primary',
            click: function() {
                restoreBtn.disabled = true;
                L.resolveDefault(api.listBackups(), {}).then(function(res) {
                    restoreBtn.disabled = false;
                    var files = (res && res.files) ? res.files : [];

                    if (!files.length) {
                        C.showToast({
                            ok: false,
                            title: _('No Backups'),
                            msg: _('No backup files found.'),
                            timeout: 2500
                        });
                        return;
                    }

                    var overlay;
                    function closePanel() {
                        if (overlay && overlay.parentNode)
                            overlay.parentNode.removeChild(overlay);
                    }

                    function buildFileBtn(f) {
                        return E('button', {
                            type: 'button',
                            class: 'lucky-file-btn',
                            title: f.name,
                            click: function() {
                                closePanel();
                                if (!window.confirm(
                                    _('Restore backup: %s ?').format(f.name)
                                )) return;
                                L.resolveDefault(
                                    api.restoreBackup({ filename: f.name }), {}
                                ).then(function(r) {
                                    var ok = r && r.result === 'ok';
                                    C.showToast({
                                        ok:      ok,
                                        title:   ok ? _('Restored') : _('Failed'),
                                        msg:     ok
                                            ? _('Backup restored successfully.')
                                            : _('Restore failed'),
                                        timeout: ok ? 2500 : 0
                                    });
                                });
                            }
                        }, f.name);
                    }

                    var card = E('div', { class: 'lucky-panel' }, [
                        E('h3', { class: 'lucky-panel-title' },
                            [C.icon('folder', 16), E('span', {}, _('Select Backup to Restore'))]),
                        E('p', { class: 'lucky-panel-desc' }, _('Click a file to restore it:')),
                        E('div', { class: 'lucky-file-list' }, files.map(buildFileBtn)),
                        E('div', { class: 'lucky-panel-foot' }, [
                            E('button', {
                                type: 'button',
                                class: 'lucky-btn lucky-btn-danger',
                                click: closePanel
                            }, _('Cancel'))
                        ])
                    ]);

                    overlay = E('div', { class: 'lucky-panel-overlay' }, [card]);
                    overlay.addEventListener('click', function(ev) {
                        if (ev.target === overlay) closePanel();
                    });
                    card.addEventListener('click', function(ev) {
                        ev.stopPropagation();
                    });
                    document.body.appendChild(overlay);
                });
            }
        }, [C.icon('folder', 14), E('span', {}, _('Restore Backup'))]);

        var resetBtn = E('button', {
            type: 'button',
            class: 'lucky-btn lucky-btn-danger',
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
        }, [C.icon('trash', 14), E('span', {}, _('Reset password'))]);

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

        var mapEl = E('div', { class: 'cbi-map lucky-page' }, [
            E('h2', {}, _('Lucky — Settings')),

            C.buildCard(_('Basic Service'), [
                C.buildFormRow('text', 'port', _('Web UI Port'),
                    cfg.port || '16601',
                    _('Default: 16601'),
                    { style: 'width:100px;' }),
                C.buildFormRow('text', 'safe', _('Safe Entrance'),
                    cfg.safe || '',
                    _('URL path prefix, e.g.: mysecret')),
                C.buildFormRow('toggle', 'internet', _('Allow Internet Access'),
                    cfg.internet || '0',
                    _('Allow access to the Web UI from the internet')),
                C.buildFormRow('number', 'delay', _('Delayed Start (s)'),
                    cfg.delay || '60',
                    _('Delay before starting after boot (only when uptime < 120s)'),
                    { style: 'width:80px;', min: '0' }),
                C.buildFormRow('custom', 'restore', _('Restore Backup'),
                    null,
                    _('Restore Lucky config from a previous backup'),
                    restoreBtn),
                C.buildFormRow('custom', 'reset', _('Reset Credentials'),
                    null,
                    _('Reset username and password back to 666'),
                    resetBtn)
            ], { icon: 'gear' }),

            C.buildGrid(280, [
                C.buildCard(_('Path & Architecture'), [
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
                ], { icon: 'folder' }),
                C.buildCard(_('Download & Update'), [
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
                ], { icon: 'download' })
            ]),

            C.buildGrid(280, [
                C.buildCard(_('Respawn Policy'), [
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
                ], { icon: 'refresh' }),
                C.buildCard(_('Auto Update'), [
                    C.buildFormRow('toggle', 'auto_update', _('Enable Auto Update'),
                        cfg.auto_update || '0',
                        _('Periodically check and install the latest version')),
                    C.buildFormRow('number', 'update_interval', _('Check Interval (days)'),
                        cfg.update_interval || '7',
                        _('Range: 1 – 365 days'),
                        { style: 'width:80px;', min: '1', max: '365' })
                ], { icon: 'clock' })
            ])
        ]);

        C.initThemeButton();

        var mirrorEl = mapEl.querySelector('#_f_mirror');
        if (mirrorEl) {
            mirrorEl.addEventListener('change', function() {
                C.rowVis('release_type', this.value === 'r66666');
                C.rowVis('variant',      true);
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
            C.rowVis('variant',         true);
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
