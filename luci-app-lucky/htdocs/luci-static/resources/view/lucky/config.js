'use strict';
'require form';
'require poll';
'require rpc';
'require uci';
'require view';

// ─── RPC 声明 ───────────────────────────────────────────────
const callServiceStatus = rpc.declare({
    object: 'luci.lucky',
    method: 'get_status',
    expect: { running: false }
});

const callGetArch = rpc.declare({
    object: 'luci.lucky',
    method: 'get_arch',
    expect: { arch: '' }
});

const callResetUser = rpc.declare({
    object: 'luci.lucky',
    method: 'reset_user',
    expect: { result: false }
});

// ─── 状态渲染 ────────────────────────────────────────────────
function renderStatus(isRunning, webport, safe_url, protocol) {
    const color = isRunning ? '#4caf50' : '#f44336';
    const icon  = isRunning ? '●' : '○';
    const text  = isRunning ? _('RUNNING') : _('NOT RUNNING');

    const nodes = [
        E('em', {}, [
            E('span', { style: 'color:%s;font-weight:bold'.format(color) },
                '%s Lucky — %s'.format(icon, text)
            )
        ])
    ];

    if (isRunning) {
        let url = '%s//%s:%s/'.format(protocol, window.location.hostname, webport);
        if (safe_url && safe_url.trim())
            url += safe_url.trim() + '/';

        nodes.push(
            E('input', {
                class: 'cbi-button cbi-button-apply',
                type: 'button',
                style: 'margin-left:16px',
                value: _('Open Lucky Web UI'),
                click: function() { window.open(url); }
            })
        );
    }

    return nodes;
}

// ─── 主视图 ──────────────────────────────────────────────────
return view.extend({

    load: function() {
        return Promise.all([
            uci.load('lucky'),
            L.resolveDefault(callGetArch(), { arch: _('Unknown') })
        ]);
    },

    handleResetUser: function() {
        return callResetUser().then(function(res) {
            if (res && res.result) {
                ui.addNotification(null,
                    E('p', {}, _('Credentials have been reset to: 666')), 'info');
            } else {
                ui.addNotification(null,
                    E('p', {}, _('Reset failed, please check the log.')), 'error');
            }
        });
    },

    render: function(data) {
        const detectedArch = (data[1] && data[1].arch) ? data[1].arch : _('Unknown');

        const webport  = uci.get('lucky', 'lucky', 'port')   || '16601';
        const safeurl  = uci.get('lucky', 'lucky', 'safe')   || '';
        const uci_ssl  = uci.get('lucky', 'lucky', 'ssl')    || '0';
        const protocol = uci_ssl === '1' ? 'https:' : 'http:';

        let m, s, o;

        m = new form.Map('lucky', _('Lucky'),
            _('Port forward · DDNS · Reverse Proxy · WoL · IoT · and more'));

        // ══════════════════════════════════════════════════════
        // § 状态栏
        // ══════════════════════════════════════════════════════
        s = m.section(form.TypedSection, 'lucky');
        s.anonymous = true;
        s.addremove = false;
        s.render = function() {
            // 启动轮询
            poll.add(function() {
                return L.resolveDefault(callServiceStatus(), { running: false })
                    .then(function(res) {
                        const el = document.getElementById('_lucky_status');
                        if (el) {
                            dom.content(el, renderStatus(
                                res.running, webport, safeurl, protocol
                            ));
                        }
                    });
            }, 5);

            return E('div', { class: 'cbi-section' }, [
                // 状态行
                E('div', { id: '_lucky_status' },
                    E('em', {}, _('Collecting data…'))
                ),
                // 底部：LuCI 项目地址 + 作者
                E('div', {
                    style: 'display:flex;justify-content:space-between;margin-top:6px;font-size:0.85em;color:#888'
                }, [
                    E('span', {}, [
                        _('LuCI App: '),
                        E('a', {
                            href: 'https://github.com/whzhni1/luci-app-lucky',
                            target: '_blank',
                            style: 'color:#2196f3'
                        }, 'github.com/whzhni1/luci-app-lucky')
                    ]),
                    E('span', {}, [
                        '© ',
                        E('a', {
                            href: 'https://github.com/sirpdboy',
                            target: '_blank',
                            style: 'color:#888;text-decoration:none'
                        }, 'sirpdboy')
                    ])
                ])
            ]);
        };

        // ══════════════════════════════════════════════════════
        // § 1  基本服务设置
        // ══════════════════════════════════════════════════════
        s = m.section(form.NamedSection, 'lucky', 'lucky', _('Service Settings'));
        s.addremove = false;

        o = s.option(form.Flag, 'enabled', _('Enable Lucky'));
        o.default  = o.disabled;
        o.rmempty  = false;

        o = s.option(form.Value, 'port', _('Web UI Port'));
        o.default     = '16601';
        o.datatype    = 'port';
        o.placeholder = '16601';
        o.rmempty     = false;

        o = s.option(form.Value, 'safe', _('Safe Entrance'),
            _('Custom URL path prefix, e.g.: <code>mysecret</code>'));
        o.datatype = 'string';

        o = s.option(form.Flag, 'ssl', _('Enable HTTPS'),
            _('Encrypt access using SSL/TLS'));
        o.default  = '0';
        o.rmempty  = false;

        o = s.option(form.Value, 'delay', _('Delayed Start (seconds)'),
            _('Delay before starting after boot, only applied when uptime &lt; 120s'));
        o.default     = '60';
        o.datatype    = 'uinteger';
        o.placeholder = '60';

        o = s.option(form.Button, '_resetuser', _('Reset Credentials'),
            _('Reset admin username and password back to <strong>666</strong>'));
        o.inputtitle = _('Reset Now');
        o.inputstyle = 'apply';
        o.onclick    = L.bind(this.handleResetUser, this);

        // ══════════════════════════════════════════════════════
        // § 2  路径与架构
        // ══════════════════════════════════════════════════════
        s = m.section(form.NamedSection, 'lucky', 'lucky', _('Path & Architecture'));
        s.addremove = false;

        o = s.option(form.Value, 'configdir', _('Data Directory'),
            _('Directory where Lucky stores runtime configuration and data'));
        o.default     = '/etc/config/lucky.daji';
        o.placeholder = '/etc/config/lucky.daji';
        o.datatype    = 'string';

        o = s.option(form.Value, 'binpath', _('Binary Path'),
            _('Full path to the Lucky executable'));
        o.default     = '/usr/bin/lucky';
        o.placeholder = '/usr/bin/lucky';
        o.datatype    = 'string';

        o = s.option(form.Value, 'arch', _('Device Architecture'),
            _('Current detected architecture: <strong><code>%s</code></strong>').format(detectedArch));
        o.default     = 'auto';
        o.placeholder = _('auto');
        o.datatype    = 'string';

        // ══════════════════════════════════════════════════════
        // § 3  下载与更新
        // ══════════════════════════════════════════════════════
        s = m.section(form.NamedSection, 'lucky', 'lucky', _('Download & Update Settings'));
        s.addremove = false;

        o = s.option(form.ListValue, 'mirror', _('Download Mirror'));
        o.value('github', 'GitHub  (github.com/gdy666/lucky)');
        o.value('r66666', 'Mirror  (release.66666.plus)');
        o.default = 'github';

        o = s.option(form.ListValue, 'release_type', _('Release Channel'),
            _('Beta channel is only available when using the Mirror source'));
        o.value('stable', _('Stable'));
        o.value('beta',   _('Beta'));
        o.default = 'stable';
        o.depends('mirror', 'r66666');

        o = s.option(form.ListValue, 'variant', _('Lucky Variant'));
        o.value('lucky', _('Standard (lucky)'));
        o.value('wanji', _('Full-featured (wanji)'));
        o.default = 'lucky';

        // ══════════════════════════════════════════════════════
        // § 4  自动更新
        // ══════════════════════════════════════════════════════
        s = m.section(form.NamedSection, 'lucky', 'lucky', _('Auto Update'));
        s.addremove = false;

        o = s.option(form.Flag, 'auto_update', _('Enable Auto Update'),
            _('Periodically check and install the latest Lucky version via cron'));
        o.default  = '0';
        o.rmempty  = false;

        o = s.option(form.Value, 'update_interval', _('Check Interval (days)'));
        o.default     = '7';
        o.datatype    = 'range(1,365)';
        o.placeholder = '7';
        o.depends('auto_update', '1');

        return m.render();
    }
});
