'use strict';
'require view';
'require ui';
'require uci';
'require rpc';

// ─── RPC 声明 ────────────────────────────────────────────────
function rpcDeclare(method, params) {
    return rpc.declare({
        object: 'luci.lucky',
        method: method,
        params: params || []
    });
}

var callGetSystemInfo      = rpcDeclare('get_system_info');
var callGetUpstreamVersion = rpcDeclare('get_upstream_version', ['mirror', 'release_type', 'variant']);
var callGetUpdateStatus    = rpcDeclare('get_update_status');
var callDoUpdate           = rpcDeclare('do_update',            ['tag', 'filename']);
var callGetAutoUpdateLog   = rpcDeclare('get_auto_update_log');

// ─── 镜像源选项 ──────────────────────────────────────────────
var MIRROR_OPTIONS = [
    { value: 'github', label: 'GitHub (github.com/gdy666/lucky)' },
    { value: 'r66666', label: 'Mirror (release.66666.plus)'      }
];

// ─── 主视图 ──────────────────────────────────────────────────
return view.extend({

    // 禁用默认页脚保存按钮（本页无 UCI 表单）
    handleSave:      null,
    handleSaveApply: null,
    handleReset:     null,

    load: function() {
        return Promise.all([
            uci.load('lucky'),
            L.resolveDefault(callGetSystemInfo(), {})
        ]);
    },

    render: function(data) {
        var self      = this;
        self._sysinfo = data[1] || {};

        return E('div', { class: 'cbi-map' }, [
            E('h2', {}, _('Lucky — Download & Update')),
            self._buildCurrentInfo(),
            self._buildUpdateBlock(),
            self._buildAutoUpdateLog()
        ]);
    },

    // ══════════════════════════════════════════════════════════
    // § 1  当前版本信息表格
    // ══════════════════════════════════════════════════════════
    _buildCurrentInfo: function() {
        var self = this;
        var sys  = self._sysinfo;

        var thStyle = 'padding:8px 16px;text-align:left;background:#f5f5f5;white-space:nowrap;';
        var tdStyle = 'padding:8px 16px;vertical-align:middle;';

        function row(label, value, id) {
            return E('tr', {}, [
                E('th', { style: thStyle }, label),
                E('td', { style: tdStyle, id: id || '' }, value || _('Unknown'))
            ]);
        }

        return E('div', { class: 'cbi-section' }, [
            E('h3', {}, _('Current Version')),
            E('div', { style: 'overflow-x:auto;' },
                E('table', {
                    style: 'width:100%;border-collapse:collapse;border:1px solid #ddd;border-radius:6px;'
                }, [
                    row(_('Lucky Version'),  sys.version  || _('Unknown'), '_lucky_cur_version'),
                    row(_('Variant'),        sys.variant  || _('Unknown'), '_lucky_cur_variant'),
                    row(_('Architecture'),   sys.arch     || _('Unknown'), '_lucky_cur_arch'),
                    row(_('Install Path'),   sys.binpath  || _('Unknown')),
                    row(_('Data Directory'), sys.configdir|| _('Unknown'))
                ])
            )
        ]);
    },

    // ══════════════════════════════════════════════════════════
    // § 2  更新操作区
    // ══════════════════════════════════════════════════════════
    _buildUpdateBlock: function() {
        var self   = this;
        var mirror = uci.get('lucky', 'lucky', 'mirror')       || 'github';
        var reltyp = uci.get('lucky', 'lucky', 'release_type') || 'stable';
        var varnt  = uci.get('lucky', 'lucky', 'variant')      || 'lucky';

        // ── 镜像源选择 ──
        var mirrorSel = E('select', {
            class: 'cbi-input-select',
            id:    '_upd_mirror',
            style: 'width:auto;'
        }, MIRROR_OPTIONS.map(function(o) {
            var attr = { value: o.value };
            if (o.value === mirror) attr.selected = 'selected';
            return E('option', attr, o.label);
        }));

        // ── 版本类型（stable / beta，镜像源为 r66666 时可选 beta）──
        var relTypeSel = E('select', {
            class: 'cbi-input-select',
            id:    '_upd_reltype',
            style: 'width:auto;'
        }, [
            E('option', { value: 'stable', selected: reltyp === 'stable' ? 'selected' : null },
                _('Stable')),
            E('option', { value: 'beta',   selected: reltyp === 'beta'   ? 'selected' : null },
                _('Beta'))
        ]);

        // beta 仅在 r66666 时显示
        var relTypeRow = E('div', {
            id:    '_upd_reltype_row',
            style: 'display:' + (mirror === 'r66666' ? 'flex' : 'none') +
                   ';align-items:center;gap:8px;flex-wrap:wrap;'
        }, [
            E('label', {}, _('Release Channel:')),
            relTypeSel
        ]);

        // 切换镜像源时联动显示/隐藏 beta 选项
        mirrorSel.addEventListener('change', function() {
            var row = document.getElementById('_upd_reltype_row');
            if (row) row.style.display = this.value === 'r66666' ? 'flex' : 'none';
        });

        // ── 变体选择 ──
        var variantSel = E('select', {
            class: 'cbi-input-select',
            id:    '_upd_variant',
            style: 'width:auto;'
        }, [
            E('option', { value: 'lucky', selected: varnt === 'lucky' ? 'selected' : null },
                _('Standard (lucky)')),
            E('option', { value: 'wanji', selected: varnt === 'wanji' ? 'selected' : null },
                _('Full-featured (wanji)'))
        ]);

        // ── 版本标签下拉 ──
        var tagSel = E('select', {
            class: 'cbi-input-select',
            id:    '_upd_tag',
            style: 'width:auto;max-width:200px;'
        });

        // ── 文件下拉 ──
        var fileSel = E('select', {
            class: 'cbi-input-select',
            id:    '_upd_file',
            style: 'width:auto;max-width:320px;overflow:hidden;text-overflow:ellipsis;'
        });

        // ── 版本/文件行（查询后显示）──
        var selectsRow = E('div', {
            id:    '_upd_selects',
            style: 'display:none;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px;'
        }, [
            E('label', {}, _('Version:')),
            tagSel,
            E('label', {}, _('File:')),
            fileSel,
            E('button', {
                class: 'btn cbi-button-apply',
                id:    '_upd_do_btn',
                click: function() { self._doUpdate(); }
            }, _('Update Now'))
        ]);

        // ── 状态文字 ──
        var statusEl = E('span', {
            id:    '_upd_status',
            style: 'font-size:13px;color:#888;'
        }, _('Click "Check" to get available versions'));

        // ── 镜像源切换重试行 ──
        var mirrorRetryRow = E('div', {
            id:    '_upd_mirror_retry',
            style: 'display:none;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap;'
        }, [
            E('span', { style: 'font-size:13px;color:#666;' }, _('Switch mirror and retry:')),
            E('select', {
                class: 'cbi-input-select',
                id:    '_upd_retry_mirror',
                style: 'width:auto;'
            }, MIRROR_OPTIONS.map(function(o) {
                var attr = { value: o.value };
                if (o.value === mirror) attr.selected = 'selected';
                return E('option', attr, o.label);
            })),
            E('button', {
                class: 'btn cbi-button-action',
                click: function() {
                    var rm = document.getElementById('_upd_retry_mirror');
                    var m  = document.getElementById('_upd_mirror');
                    if (rm && m) m.value = rm.value;
                    self._checkUpstream();
                }
            }, _('Retry'))
        ]);

        // ── 日志框 ──
        var logEl = E('pre', {
            id:    '_upd_log',
            style: [
                'display:none', 'margin-top:10px',
                'background:#1e1e1e', 'color:#d4d4d4',
                'padding:10px', 'font-size:12px',
                'height:220px', 'overflow-y:auto',
                'border-radius:4px', 'white-space:pre-wrap',
                'font-family:monospace'
            ].join(';')
        });

        return E('div', { class: 'cbi-section' }, [
            E('h3', {}, _('Check & Update')),

            // 选项行
            E('div', { style: 'display:flex;flex-wrap:wrap;gap:12px;align-items:center;' }, [
                E('div', { style: 'display:flex;align-items:center;gap:8px;' }, [
                    E('label', {}, _('Mirror:')),
                    mirrorSel
                ]),
                relTypeRow,
                E('div', { style: 'display:flex;align-items:center;gap:8px;' }, [
                    E('label', {}, _('Variant:')),
                    variantSel
                ])
            ]),

            // 查询按钮 + 状态
            E('div', { style: 'display:flex;align-items:center;gap:10px;margin-top:12px;' }, [
                E('button', {
                    class: 'btn cbi-button-action',
                    id:    '_upd_check_btn',
                    click: function() { self._checkUpstream(); }
                }, _('Check Upstream Version')),
                statusEl
            ]),

            mirrorRetryRow,
            selectsRow,
            logEl
        ]);
    },

    // ══════════════════════════════════════════════════════════
    // § 3  自动更新日志区
    // ══════════════════════════════════════════════════════════
    _buildAutoUpdateLog: function() {
        var self = this;

        var logEl = E('pre', {
            id:    '_auto_log_content',
            style: [
                'display:none', 'margin-top:10px',
                'background:#1e1e1e', 'color:#d4d4d4',
                'padding:10px', 'font-size:12px',
                'height:220px', 'overflow-y:auto',
                'border-radius:4px', 'white-space:pre-wrap',
                'font-family:monospace'
            ].join(';')
        });

        return E('div', { class: 'cbi-section' }, [
            E('h3', {}, _('Auto Update Log')),
            E('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
                E('button', {
                    class: 'btn cbi-button-action',
                    click: function() {
                        self._loadAutoUpdateLog(logEl);
                    }
                }, _('View Auto Update Log')),
                E('span', {
                    id:    '_auto_log_status',
                    style: 'font-size:13px;color:#888;'
                }, '')
            ]),
            logEl
        ]);
    },

    // ══════════════════════════════════════════════════════════
    // § 内部方法
    // ══════════════════════════════════════════════════════════

    // 辅助：获取 DOM 元素
    _el: function(id) { return document.getElementById(id); },

    // 辅助：设置状态文字
    _setStatus: function(id, text, color) {
        var el = this._el(id);
        if (el) { el.textContent = text; el.style.color = color || '#888'; }
    },

    // 辅助：显示/隐藏元素
    _show: function(id, flex) {
        var el = this._el(id);
        if (el) el.style.display = flex ? 'flex' : 'block';
    },
    _hide: function(id) {
        var el = this._el(id);
        if (el) el.style.display = 'none';
    },

    // 辅助：写入日志框
    _appendLog: function(elOrId, text) {
        var el = typeof elOrId === 'string' ? this._el(elOrId) : elOrId;
        if (!el) return;
        el.style.display = 'block';
        el.textContent   = text || '';
        el.scrollTop     = el.scrollHeight;
    },

    // ── 查询上游版本 ──────────────────────────────────────────
    _checkUpstream: function() {
        var self     = this;
        var mirror   = (self._el('_upd_mirror')  || {}).value || 'github';
        var reltype  = (self._el('_upd_reltype') || {}).value || 'stable';
        var variant  = (self._el('_upd_variant') || {}).value || 'lucky';
        var checkBtn = self._el('_upd_check_btn');

        if (checkBtn) checkBtn.disabled = true;
        self._hide('_upd_selects');
        self._hide('_upd_mirror_retry');
        self._hide('_upd_log');
        self._setStatus('_upd_status', _('Checking…'), '#888');

        callGetUpstreamVersion(mirror, reltype, variant)
            .then(function() {
                self._pollStatus('check');
            })
            .catch(function(err) {
                if (checkBtn) checkBtn.disabled = false;
                self._setStatus('_upd_status',
                    _('✗ Failed to start: %s').format(String(err)), '#dc3545');
                self._show('_upd_mirror_retry', true);
            });
    },

    // ── 执行更新 ─────────────────────────────────────────────
    _doUpdate: function() {
        var self   = this;
        var tag    = (self._el('_upd_tag')    || {}).value || '';
        var fname  = (self._el('_upd_file')   || {}).value || '';
        var doBtn  = self._el('_upd_do_btn');

        if (!tag || !fname) {
            self._setStatus('_upd_status',
                _('✗ Please check upstream version first'), '#dc3545');
            return;
        }

        if (doBtn) doBtn.disabled = true;
        self._hide('_upd_mirror_retry');
        self._appendLog('_upd_log', _('Preparing download…'));
        self._setStatus('_upd_status', _('Downloading…'), '#888');

        callDoUpdate(tag, fname)
            .then(function(r) {
                if (!r || r.result !== 'ok') {
                    if (doBtn) doBtn.disabled = false;
                    self._setStatus('_upd_status',
                        _('✗ Failed to start download'), '#dc3545');
                    self._show('_upd_mirror_retry', true);
                    return;
                }
                self._pollStatus('download');
            })
            .catch(function(err) {
                if (doBtn) doBtn.disabled = false;
                self._setStatus('_upd_status',
                    _('✗ Error: %s').format(String(err)), '#dc3545');
                self._show('_upd_mirror_retry', true);
            });
    },

    // ── 轮询状态 ─────────────────────────────────────────────
    _pollStatus: function(phase) {
        var self     = this;
        var checkBtn = self._el('_upd_check_btn');
        var doBtn    = self._el('_upd_do_btn');
        var dots     = 0;
        var done     = false;
        var timer    = null;
        var timeout  = null;

        function stopAll() {
            done = true;
            if (timer)   { clearInterval(timer);  timer   = null; }
            if (timeout) { clearTimeout(timeout);  timeout = null; }
        }

        timer = setInterval(function() {
            if (done) return;
            dots++;
            var dot = '.'.repeat(dots % 4 + 1);

            callGetUpdateStatus().then(function(s) {
                if (done || !s) return;

                // 进行中
                if (s.status === 'checking') {
                    self._setStatus('_upd_status', _('Checking') + dot, '#888');
                    return;
                }
                if (s.status === 'downloading') {
                    if (s.log) self._appendLog('_upd_log', s.log);
                    self._setStatus('_upd_status', _('Downloading') + dot, '#888');
                    return;
                }
                if (s.status === 'installing') {
                    if (s.log) self._appendLog('_upd_log', s.log);
                    self._setStatus('_upd_status', _('Installing…'), '#888');
                    return;
                }

                // 终态
                stopAll();

                if (s.status === 'ready') {
                    // 查询完成，填充版本/文件下拉
                    if (checkBtn) checkBtn.disabled = false;
                    self._setStatus('_upd_status',
                        _('✓ Found %d version(s)').format((s.releases || []).length),
                        '#28a745');
                    self._populateReleases(s.releases || []);
                    self._show('_upd_selects', true);
                    return;
                }

                if (s.status === 'done') {
                    if (doBtn) doBtn.disabled = false;
                    self._setStatus('_upd_status',
                        _('✓ Update complete: %s').format(s.installed || ''), '#28a745');
                    if (s.log) self._appendLog('_upd_log', s.log);
                    // 刷新当前版本表格
                    self._refreshCurrentInfo();
                    return;
                }

                if (s.status === 'error') {
                    if (checkBtn) checkBtn.disabled = false;
                    if (doBtn)    doBtn.disabled    = false;
                    self._setStatus('_upd_status',
                        _('✗ %s').format(s.msg || _('Unknown error')), '#dc3545');
                    if (s.log) self._appendLog('_upd_log', s.log);
                    self._show('_upd_mirror_retry', true);
                    return;
                }

            }).catch(function() {});
        }, 1500);

        // 超时保护
        var ms = phase === 'check' ? 60000 : 600000;
        timeout = setTimeout(function() {
            if (done) return;
            stopAll();
            if (checkBtn) checkBtn.disabled = false;
            if (doBtn)    doBtn.disabled    = false;
            self._setStatus('_upd_status', _('✗ Timeout, please retry'), '#dc3545');
            self._show('_upd_mirror_retry', true);
        }, ms);
    },

    // ── 填充版本/文件下拉 ────────────────────────────────────
    _populateReleases: function(releases) {
        var self    = this;
        var tagSel  = self._el('_upd_tag');
        var fileSel = self._el('_upd_file');
        if (!tagSel || !fileSel) return;

        self._releases = releases;
        tagSel.innerHTML = '';
        releases.forEach(function(r) {
            tagSel.appendChild(E('option', { value: r.tag }, r.tag));
        });

        function updateFiles() {
            var tag = tagSel.value;
            var rel = null;
            for (var i = 0; i < releases.length; i++) {
                if (releases[i].tag === tag) { rel = releases[i]; break; }
            }
            fileSel.innerHTML = '';
            if (!rel || !rel.filenames) return;

            // 读取用户在 config.js 里设置的架构
            var arch    = uci.get('lucky', 'lucky', 'arch') || '';
            var matched = -1;
            rel.filenames.forEach(function(fname, idx) {
                fileSel.appendChild(E('option', { value: fname }, fname));
                if (matched < 0 && arch && fname.indexOf(arch) !== -1)
                    matched = idx;
            });
            if (matched >= 0) fileSel.selectedIndex = matched;
        }

        tagSel.onchange = updateFiles;
        updateFiles();
    },

    // ── 刷新当前版本表格 ─────────────────────────────────────
    _refreshCurrentInfo: function() {
        var self = this;
        L.resolveDefault(callGetSystemInfo(), {}).then(function(sys) {
            self._sysinfo = sys;
            [
                ['_lucky_cur_version',  sys.version],
                ['_lucky_cur_variant',  sys.variant],
                ['_lucky_cur_arch',     sys.arch]
            ].forEach(function(pair) {
                var el = self._el(pair[0]);
                if (el) el.textContent = pair[1] || _('Unknown');
            });
        });
    },

    // ── 读取自动更新日志 ─────────────────────────────────────
    _loadAutoUpdateLog: function(logEl) {
        var self = this;
        self._setStatus('_auto_log_status', _('Loading…'), '#888');

        callGetAutoUpdateLog().then(function(res) {
            var content = (res && res.log) ? res.log : _('(No log available)');
            self._appendLog(logEl, content);
            self._setStatus('_auto_log_status', '', '#888');
        }).catch(function(err) {
            self._setStatus('_auto_log_status',
                _('✗ Failed to load log: %s').format(String(err)), '#dc3545');
        });
    }
});
