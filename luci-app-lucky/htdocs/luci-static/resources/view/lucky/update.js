'use strict';
'require view';
'require rpc';
'require uci';

var rpcC = function(m, p) { return rpc.declare({ object: 'luci.lucky', method: m, params: p }); };
var api = {
    info: rpcC('get_system_info'),
    updChk: rpcC('get_upstream_version', ['mirror', 'release_type', 'variant']),
    updStat: rpcC('get_update_status'),
    updDo: rpcC('do_update', ['tag', 'filename']),
    luciChk: rpcC('check_luci'),
    luciStat: rpcC('get_luci_update_status'),
    luciDo: rpcC('do_update_luci', ['tag', 'filename']),
    autoLog: rpcC('get_auto_update_log')
};

var $ = function(id) { return document.getElementById(id); };
var txt = function(id, t, c) { var e=$(id); if(e){ e.textContent=t; if(c)e.style.color=c; } };
var vis = function(id, s, d) { var e=$(id); if(e) e.style.display = s ? (d||'block') : 'none'; };
var log = function(id, t) { var e=$(id); if(!e||t==null)return; e.style.display='block'; e.textContent=t; e.scrollTop=e.scrollHeight; };

var infoBlock = function() {
    var th = 'padding:8px 12px;text-align:left;width:160px;', td = 'padding:8px 12px;';
    return E('div', { class: 'cbi-section' }, [
        E('h3', {}, _('Current Status')),
        E('div', { style: 'overflow-x:auto;border:1px solid #ddd;border-radius:8px;' },
            E('table', { style: 'width:100%;min-width:360px;border-collapse:collapse;' },
                [
                    [_('Lucky Version'),'iv'], [_('Luci Version'),'il'], [_('Variant'),'ir'],
                    [_('Architecture'),'ia'], [_('Install Path'),'ip'], [_('Data Directory'),'ic']
                ].map(r => E('tr', {}, [
                    E('th', { style: th }, r[0]),
                    E('td', { style: td, id: r[1] }, E('em', { class: 'spinning' }, _('Loading...')))
                ]))
            )
        )
    ]);
};

return view.extend({
    handleSave: null, handleSaveApply: null, handleReset: null,

    load: function() { return uci.load('lucky'); },

    render: function() {
        var self = this;
        var m = uci.get('lucky', 'lucky', 'mirror') || 'github';
        var r = uci.get('lucky', 'lucky', 'release_type') || 'stable';
        var v = uci.get('lucky', 'lucky', 'variant') || 'lucky';

        var mirrorExt = E('div', { id: 'upd_retry', style: 'display:none;margin-top:8px;align-items:center;gap:8px;flex-wrap:wrap;' }, [
            E('span', { style: 'font-size:13px;' }, _('Switch and retry:')),
            E('select', { class: 'cbi-input-select', id: 'upd_rmir', style: 'width:auto;', change: function() { vis('upd_rext', this.value === 'r66666', 'flex'); } }, [
                E('option', { value: 'github', selected: m==='github'?'selected':null }, 'GitHub'),
                E('option', { value: 'r66666', selected: m==='r66666'?'selected':null }, 'Mirror (release.66666.host)')
            ]),
            E('span', { id: 'upd_rext', style: 'display:'+(m==='r66666'?'flex':'none')+';gap:8px;align-items:center;' }, [
                E('select', { class: 'cbi-input-select', id: 'upd_rrel', style: 'width:auto;' }, [
                    E('option', { value: 'stable', selected: r==='stable'?'selected':null }, _('Stable')),
                    E('option', { value: 'beta', selected: r==='beta'?'selected':null }, _('Beta'))
                ]),
                E('select', { class: 'cbi-input-select', id: 'upd_rvar', style: 'width:auto;' }, [
                    E('option', { value: 'lucky', selected: v==='lucky'?'selected':null }, _('Standard')),
                    E('option', { value: 'wanji', selected: v==='wanji'?'selected':null }, _('Full-featured'))
                ])
            ]),
            E('button', { class: 'btn cbi-button-action', click: function() { self._chk('upd', true); } }, _('Retry'))
        ]);

        var buildB = function(t, tLbl, bLbl, ext) {
            return E('div', { class: 'cbi-section' }, [
                E('h3', {}, tLbl),
                E('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;' }, [
                    E('button', { class: 'btn cbi-button-action', id: t+'_chk', click: function(){ self._chk(t); } }, bLbl),
                    E('span', { id: t+'_stat', style: 'font-size:13px;color:#888;' }, _('Click to check'))
                ]),
                ext || '',
                E('div', { id: t+'_sels', style: 'display:none;margin-top:10px;' },
                    E('div', { style: 'display:flex;flex-wrap:wrap;align-items:center;gap:8px;' }, [
                        E('label', {}, _('Version:')),
                        E('select', { class: 'cbi-input-select', id: t+'_tag', style: 'width:auto;max-width:200px;', change: function(){ self._sel(t); } }),
                        E('label', {}, _('File:')),
                        E('select', { class: 'cbi-input-select', id: t+'_file', style: 'width:auto;max-width:360px;' }),
                        E('button', { class: 'btn cbi-button-apply', id: t+'_do', click: function(){ self._do(t); } }, _('Install Now'))
                    ])
                ),
                E('pre', { id: t+'_log', style: 'display:none;margin-top:10px;background:#1e1e1e;color:#d4d4d4;padding:10px;font-size:12px;height:200px;overflow-y:auto;border-radius:4px;white-space:pre-wrap;font-family:monospace;' })
            ]);
        };

        var content = E('div', { class: 'cbi-map' }, [
            E('h2', {}, _('Lucky — Download & Update')),
            infoBlock(),
            buildB('upd', _('Lucky Binary Update'), _('Check Upstream'), mirrorExt),
            buildB('luci', _('Luci App Update'), _('Check Luci Version')),
            E('div', { class: 'cbi-section' }, [
                E('h3', {}, _('Auto Update Log')),
                E('div', { style: 'display:flex;align-items:center;gap:10px;' }, 
                    E('button', { class: 'btn cbi-button-action', click: function() { L.resolveDefault(api.autoLog(), {}).then(res => log('auto_log', res.log || _('(No log)'))); } }, _('View Log'))
                ),
                E('pre', { id: 'auto_log', style: 'display:none;margin-top:10px;background:#1e1e1e;color:#d4d4d4;padding:10px;font-size:12px;height:200px;overflow-y:auto;border-radius:4px;white-space:pre-wrap;font-family:monospace;' })
            ])
        ]);

        this._info();
        return content;
    },

    _chk: function(t, retry) {
        var self = this, btn = $(t+'_chk');
        if (btn) btn.disabled = true;
        vis(t+'_retry', false); vis(t+'_sels', false); vis(t+'_log', false);
        txt(t+'_stat', _('Checking…'), '#888');

        var p = [];
        if (t === 'upd') {
            var m = uci.get('lucky', 'lucky', 'mirror') || 'github', r = uci.get('lucky', 'lucky', 'release_type') || 'stable', v = uci.get('lucky', 'lucky', 'variant') || 'lucky';
            if (retry) { m = $('upd_rmir').value; r = $('upd_rrel').value; v = $('upd_rvar').value; }
            p = [m, m==='r66666'?r:'', m==='r66666'?v:''];
        }
        
        L.resolveDefault(api[t+'Chk'].apply(null, p), {}).then(res => {
            if (!res || res.result === 'error') {
                if(btn) btn.disabled = false;
                txt(t+'_stat', _('✗ Failed to start check'), '#dc3545');
                if (t === 'upd') vis('upd_retry', true, 'flex');
            } else {
                self._poll(t);
            }
        });
    },

    _do: function(t) {
        var tag = ($(t+'_tag')||{}).value, fn = ($(t+'_file')||{}).value, btn = $(t+'_do');
        if (!tag || !fn) return txt(t+'_stat', _('✗ Please select version and file'), '#dc3545');
        if (btn) btn.disabled = true;
        log(t+'_log', _('Preparing…')); txt(t+'_stat', _('Starting…'), '#888');
        L.resolveDefault(api[t+'Do'](tag, fn), {}).then(res => {
            res && res.result === 'ok' ? this._poll(t) : (btn.disabled = false, txt(t+'_stat', _('✗ Failed'), '#dc3545'));
        });
    },

    _poll: function(t) {
        var self = this, tk = t+'_tm', dots = 0;
        if (self[tk]) clearInterval(self[tk]);
        self[tk] = setInterval(function() {
            dots = (dots % 4) + 1; var dot = '.'.repeat(dots);
            api[t+'Stat']().then(function(s) {
                if (!s) return;
                var st = t+'_stat', lg = t+'_log';
                switch (s.status) {
                    case 'checking': txt(st, _('Checking') + dot); break;
                    case 'downloading': txt(st, _('Downloading') + dot); log(lg, s.log); break;
                    case 'installing': txt(st, _('Installing...'), '#f0ad4e'); log(lg, s.log); break;
                    case 'ready':
                        clearInterval(self[tk]); $(t+'_chk').disabled = false;
                        txt(st, _('✓ Found %d version(s)').format(s.count || 0), '#28a745');
                        if (s.releases) {
                            self['_R'+t] = s.releases;
                            var ts = $(t+'_tag'); ts.innerHTML = '';
                            s.releases.forEach(r => ts.appendChild(E('option', { value: r.tag }, r.tag)));
                            self._sel(t); vis(t+'_sels', true);
                        }
                        break;
                    case 'done':
                        clearInterval(self[tk]); $(t+'_chk').disabled = false; $(t+'_do').disabled = false;
                        log(lg, s.log); txt(st, _('✓ Complete: %s').format(s.installed || ''), '#28a745');
                        self._info(); break;
                    case 'error':
                        clearInterval(self[tk]); $(t+'_chk').disabled = false; $(t+'_do').disabled = false;
                        log(lg, s.log); txt(st, _('✗ %s').format(s.msg || _('Error')), '#dc3545');
                        if (t === 'upd') vis('upd_retry', true, 'flex');
                        break;
                }
            });
        }, 1000);
    },

    _sel: function(t) {
        var rels = this['_R'+t] || [], tv = ($(t+'_tag')||{}).value, fs = $(t+'_file');
        if (!tv || !fs) return;
        var r = rels.find(x => x.tag === tv);
        fs.innerHTML = '';
        if (!r || !r.files) return;
        var b = 0;
        r.files.forEach((f, i) => {
            fs.appendChild(E('option', { value: f.name }, f.name));
            if (f.name === r.best) b = i;
        });
        fs.selectedIndex = b;
    },

    _info: function() {
        L.resolveDefault(api.info(), {}).then(sys => {
            if (!sys) return;
            var m = { iv: sys.version, il: sys.luci_version, ir: sys.variant, ia: sys.arch, ip: sys.binpath, ic: sys.configdir };
            for (var k in m) txt(k, m[k] || _('Unknown'), '');
        });
    }
});
