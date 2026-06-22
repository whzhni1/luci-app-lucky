'use strict';

window.luckyUI = (function() {

    var CSS = {
        card: [
            'background:#fff',
            'border-radius:12px',
            'box-shadow:0 2px 8px rgba(0,0,0,0.08)',
            'padding:20px 24px',
            'box-sizing:border-box'
        ].join(';'),

        scroll: [
            'overflow-x:auto',
            'overflow-y:visible',
            '-webkit-overflow-scrolling:touch'
        ].join(';'),

        inputBg: [
            'background:#f8f9fa',
            'border:1px solid #dee2e6',
            'border-radius:6px',
            'padding:5px 10px',
            'font-size:14px',
            'color:#333',
            'box-sizing:border-box'
        ].join(';'),

        grid: function(cols, gap) {
            return [
                'display:grid',
                'grid-template-columns:repeat(' + (cols || 3) + ',1fr)',
                'gap:' + (gap || 16) + 'px',
                'margin-bottom:16px'
            ].join(';');
        },

        gridAuto: function(minW, gap) {
            return [
                'display:grid',
                'grid-template-columns:repeat(auto-fit,minmax(' +
                    (minW || 260) + 'px,1fr))',
                'gap:' + (gap || 16) + 'px',
                'margin-bottom:16px'
            ].join(';');
        },

        cardTitle: 'font-size:13px;color:#888;margin-bottom:6px;font-weight:500;',
        cardValue:  'font-size:22px;font-weight:700;color:#222;white-space:nowrap;' +
                    'overflow:hidden;text-overflow:ellipsis;',
        cardSub:    'font-size:12px;color:#aaa;margin-top:4px;',

        formRow: [
            'display:flex',
            'align-items:flex-start',
            'padding:12px 0',
            'border-bottom:1px solid #f0f0f0',
            'gap:12px'
        ].join(';'),

        formLabel: 'min-width:130px;font-weight:500;font-size:14px;' +
                   'padding-top:4px;flex-shrink:0;',
        formDesc:  'font-size:12px;color:#aaa;margin-top:4px;',

        log: [
            'display:none',
            'margin-top:10px',
            'background:#1e1e1e',
            'color:#d4d4d4',
            'padding:10px',
            'font-size:12px',
            'height:200px',
            'overflow-y:auto',
            'border-radius:8px',
            'white-space:pre-wrap',
            'font-family:monospace'
        ].join(';'),

        btn: {
            primary: [
                'background:#1976d2', 'color:#fff',
                'border:1px solid #1565c0', 'border-radius:6px',
                'padding:6px 16px', 'font-size:13px',
                'cursor:pointer', 'white-space:nowrap'
            ].join(';'),
            success: [
                'background:#388e3c', 'color:#fff',
                'border:1px solid #2e7d32', 'border-radius:6px',
                'padding:6px 16px', 'font-size:13px',
                'cursor:pointer', 'white-space:nowrap'
            ].join(';'),
            danger: [
                'background:#f5f5f5', 'color:#d32f2f',
                'border:1px solid #f5c6cb', 'border-radius:6px',
                'padding:6px 16px', 'font-size:13px',
                'cursor:pointer', 'white-space:nowrap'
            ].join(';'),
            icon: [
                'background:#f0f4ff', 'color:#1976d2',
                'border:1px solid #c5d8f8', 'border-radius:8px',
                'width:32px', 'height:32px',
                'display:inline-flex', 'align-items:center', 'justify-content:center',
                'cursor:pointer', 'padding:4px',
                'transition:background 0.2s'
            ].join(';')
        }
    };

    function injectToggleStyle() {
        if (document.getElementById('_lucky_toggle_style')) return;
        var style = document.createElement('style');
        style.id  = '_lucky_toggle_style';
        style.textContent = [
            '.lucky-toggle-wrap {',
            '  position:relative;',
            '  display:inline-block;',
            '  width:44px; height:22px;',
            '  cursor:pointer; flex-shrink:0;',
            '}',
            '.lucky-toggle-wrap input {',
            '  opacity:0; width:0; height:0; position:absolute;',
            '}',
            '.lucky-toggle-slider {',
            '  position:absolute;',
            '  top:0; left:0; right:0; bottom:0;',
            '  background:#e5e7eb;',
            '  border:1px solid #dee2e6;',
            '  border-radius:22px;',
            '  transition:background 0.2s, border-color 0.2s;',
            '  cursor:pointer;',
            '}',
            '.lucky-toggle-slider:before {',
            '  content:"";',
            '  position:absolute;',
            '  width:16px; height:16px;',
            '  left:2px; top:2px;',
            '  background:#fff;',
            '  border-radius:50%;',
            '  box-shadow:0 1px 2px rgba(0,0,0,0.2);',
            '  transition:transform 0.2s;',
            '}',
            '.lucky-toggle-wrap input:checked + .lucky-toggle-slider {',
            '  background:#1976d2;',
            '  border-color:#1565c0;',
            '}',
            '.lucky-toggle-wrap input:checked + .lucky-toggle-slider:before {',
            '  transform:translateX(22px);',
            '}',
            '.lucky-icon-btn:hover {',
            '  background:#dceaff !important;',
            '}',
            '.lucky-toast {',
            '  position:fixed;',
            '  top:50%;',
            '  left:50%;',
            '  transform:translate(-50%,-50%) scale(0.92);',
            '  z-index:99999;',
            '  background:#fff;',
            '  border-radius:14px;',
            '  box-shadow:0 8px 40px rgba(0,0,0,0.18);',
            '  padding:32px 40px;',
            '  min-width:260px;',
            '  max-width:420px;',
            '  text-align:center;',
            '  opacity:0;',
            '  transition:opacity 0.22s, transform 0.22s;',
            '  pointer-events:none;',
            '}',
            '.lucky-toast.show {',
            '  opacity:1;',
            '  transform:translate(-50%,-50%) scale(1);',
            '  pointer-events:auto;',
            '}',
            '.lucky-toast-overlay {',
            '  position:fixed;',
            '  inset:0;',
            '  z-index:99998;',
            '  background:rgba(0,0,0,0.18);',
            '  opacity:0;',
            '  transition:opacity 0.22s;',
            '}',
            '.lucky-toast-overlay.show {',
            '  opacity:1;',
            '}'
        ].join('\n');
        document.head.appendChild(style);
    }

    function buildToggle(id, checked, onChange) {
        injectToggleStyle();
        var input = E('input', {
            type: 'checkbox',
            id: id,
            checked: checked ? 'checked' : null
        });
        if (onChange) input.addEventListener('change', onChange);
        return E('label', { class: 'lucky-toggle-wrap', for: id }, [
            input,
            E('span', { class: 'lucky-toggle-slider' })
        ]);
    }

    function buildRestartBtn(onClick, title) {
        injectToggleStyle();
        var btn = E('button', {
            type: 'button',
            class: 'lucky-icon-btn',
            title: title || _('Restart'),
            style: CSS.btn.icon,
            click: onClick
        }, [
            (function() {
                var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('viewBox', '0 0 24 24');
                svg.setAttribute('fill', 'none');
                svg.setAttribute('stroke', 'currentColor');
                svg.setAttribute('stroke-width', '2');
                svg.setAttribute('width', '16');
                svg.setAttribute('height', '16');
                var p1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                p1.setAttribute('d', 'M23 4v6h-6');
                var p2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                p2.setAttribute('d', 'M20.49 15a9 9 0 1 1-2.12-9.36L23 10');
                svg.appendChild(p1);
                svg.appendChild(p2);
                return svg;
            })()
        ]);
        return btn;
    }

    function showToast(opts) {
        injectToggleStyle();
        var ok      = opts.ok !== false;
        var title   = opts.title || (ok ? _('Success') : _('Failed'));
        var msg     = opts.msg   || '';
        var timeout = opts.timeout != null ? opts.timeout : (ok ? 2000 : 0);

        var overlay = E('div', { class: 'lucky-toast-overlay' });
        var iconEl  = E('div', {
            style: 'font-size:44px;margin-bottom:12px;line-height:1;'
        }, ok ? '✅' : '❌');
        var titleEl = E('div', {
            style: 'font-size:17px;font-weight:700;color:' +
                   (ok ? '#2e7d32' : '#c62828') + ';margin-bottom:8px;'
        }, title);
        var msgEl   = E('div', {
            style: 'font-size:14px;color:#555;'
        }, msg);

        var closeBtn = E('button', {
            style: CSS.btn.primary +
                   ';margin-top:20px;min-width:80px;',
            click: close
        }, _('OK'));

        var toast = E('div', { class: 'lucky-toast' }, [
            iconEl, titleEl, msgEl,
            ok && timeout > 0 ? '' : closeBtn
        ]);

        function close() {
            overlay.classList.remove('show');
            toast.classList.remove('show');
            window.setTimeout(function() {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                if (toast.parentNode)   toast.parentNode.removeChild(toast);
            }, 240);
        }

        overlay.addEventListener('click', function() {
            if (!ok || timeout === 0) close();
        });

        document.body.appendChild(overlay);
        document.body.appendChild(toast);

        window.setTimeout(function() {
            overlay.classList.add('show');
            toast.classList.add('show');
        }, 10);

        if (ok && timeout > 0) {
            window.setTimeout(close, timeout);
        }

        return close;
    }

    function buildBar(id) {
        return E('div', {
            style: 'background:#eee;border-radius:4px;height:8px;' +
                   'margin-top:8px;overflow:hidden;'
        }, [
            E('div', {
                id: id,
                style: 'height:100%;border-radius:4px;background:#4caf50;width:0%;' +
                       'transition:width 0.5s ease,background 0.3s;'
            })
        ]);
    }

    function setBar(id, pct) {
        var el = document.getElementById(id);
        if (!el) return;
        var p = Math.min(100, Math.max(0, pct || 0));
        el.style.width      = p + '%';
        el.style.background = p >= 90 ? '#f44336' : p >= 70 ? '#f0ad4e' : '#4caf50';
    }

    function buildCard(title, children) {
        var inner = E('div', { style: CSS.scroll },
            Array.isArray(children) ? children : [children]
        );
        return E('div', { style: CSS.card + ';margin-bottom:16px;' }, [
            title ? E('h3', { style: 'margin:0 0 16px;font-size:16px;' }, title) : '',
            inner
        ]);
    }

    function buildFormRow(type, id, label, value, desc, extra) {
        var elId = '_f_' + id, ctrl;

        if (type === 'toggle') {
            ctrl = buildToggle(elId, value === '1', null);

        } else if (type === 'checkbox') {
            ctrl = E('label', {
                style: 'display:inline-flex;align-items:center;' +
                       'gap:8px;cursor:pointer;'
            }, [
                E('input', {
                    type: 'checkbox', id: elId,
                    checked: value === '1' ? 'checked' : null
                }),
                E('span', {}, _('Enable'))
            ]);

        } else if (type === 'select') {
            ctrl = E('select', {
                id: elId,
                style: CSS.inputBg + ';width:auto;max-width:100%;cursor:pointer;'
            }, (extra || []).map(function(o) {
                return E('option', {
                    value: o.v,
                    selected: o.v === value ? 'selected' : null,
                    style: 'background:#fff;color:#333;'
                }, o.l);
            }));

        } else if (type === 'custom') {
            ctrl = extra;

        } else {
            var extraAttrs = typeof extra === 'object' && !Array.isArray(extra)
                ? extra : {};
            var finalStyle = CSS.inputBg + ';width:100%;max-width:300px;' +
                             (extraAttrs.style || '');
            ctrl = E('input', Object.assign({}, extraAttrs, {
                type: type, id: elId,
                value: value || '',
                style: finalStyle
            }));
        }

        return E('div', { id: '_row_' + id, style: CSS.formRow }, [
            E('label', { for: elId, style: CSS.formLabel }, label),
            E('div', { style: 'flex:1;min-width:0;' }, [
                ctrl,
                desc ? E('div', { style: CSS.formDesc }, desc) : ''
            ])
        ]);
    }

    function fval(id) {
        var e = document.getElementById('_f_' + id);
        return e ? (e.type === 'checkbox' ? (e.checked ? '1' : '0') : e.value || '') : '';
    }

    function rowVis(id, show) {
        var e = document.getElementById('_row_' + id);
        if (e) e.style.display = show ? '' : 'none';
    }

    function setText(id, t, c) {
        var e = document.getElementById(id);
        if (!e) return;
        e.textContent = t;
        if (c !== undefined) e.style.color = c;
    }

    function setVis(id, show, d) {
        var e = document.getElementById(id);
        if (e) e.style.display = show ? (d || 'block') : 'none';
    }

    return {
        CSS:             CSS,
        buildBar:        buildBar,
        setBar:          setBar,
        buildCard:       buildCard,
        buildFormRow:    buildFormRow,
        buildToggle:     buildToggle,
        buildRestartBtn: buildRestartBtn,
        showToast:       showToast,
        fval:            fval,
        rowVis:          rowVis,
        setText:         setText,
        setVis:          setVis
    };
})();