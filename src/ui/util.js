/**
 * UI 通用工具（挂 window.ZP.ui）
 */
(function (global) {
  'use strict';
  var ZP = (global.ZP = global.ZP || {});
  var ui = (ZP.ui = ZP.ui || {});

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /** HTML 转义 */
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** 拼 HTML 字符串（null/undefined 段自动跳过） */
  function h(strings) {
    var out = '';
    for (var i = 0; i < arguments.length; i++) {
      out += strings[i];
      if (i + 1 < arguments.length) {
        var v = arguments[i + 1];
        out += (v === null || v === undefined || v === false) ? '' : v;
      }
    }
    return out;
  }

  /** 轻提示 */
  function toast(msg, type) {
    var host = $('#toastHost');
    if (!host) return;
    var el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .25s';
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 260);
    }, type === 'err' ? 4200 : 2400);
  }

  /* ───────── 弹层 ───────── */

  var _onClose = null;

  /**
   * 打开弹层
   * @param {{title:string, body:string|HTMLElement, footer:string|HTMLElement, width?:string, onClose?:Function}} opts
   * @returns {HTMLElement} 弹层根
   */
  function openModal(opts) {
    closeModal();
    var mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true">' +
        '<div class="modal-head"><h3>' + esc(opts.title || '') + '</h3>' +
          '<button class="btn btn-ghost btn-sm" data-close>✕</button></div>' +
        '<div class="modal-body"></div>' +
        '<div class="modal-foot"></div>' +
      '</div>';

    var modal = mask.querySelector('.modal');
    if (opts.width) modal.style.maxWidth = opts.width;
    var body = mask.querySelector('.modal-body');
    var foot = mask.querySelector('.modal-foot');

    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);

    if (typeof opts.footer === 'string') foot.innerHTML = opts.footer;
    else if (opts.footer) foot.appendChild(opts.footer);
    else foot.remove();

    mask.addEventListener('click', function (e) {
      if (e.target === mask || e.target.hasAttribute('data-close')) closeModal();
    });
    document.addEventListener('keydown', onEsc);

    $('#modalHost').appendChild(mask);
    _onClose = opts.onClose || null;

    var firstInput = mask.querySelector('input, select, textarea');
    if (firstInput) setTimeout(function () { firstInput.focus(); }, 40);
    return mask;
  }

  function onEsc(e) { if (e.key === 'Escape') closeModal(); }

  function closeModal() {
    document.removeEventListener('keydown', onEsc);
    var host = $('#modalHost');
    if (host) host.innerHTML = '';
    if (_onClose) { var fn = _onClose; _onClose = null; fn(); }
  }

  /** 确认框 → Promise<boolean> */
  function confirmDialog(message, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var settled = false;
      function done(v) { if (!settled) { settled = true; resolve(v); closeModal(); } }

      var mask = openModal({
        title: opts.title || '请确认',
        width: '440px',
        body: '<p style="margin:0;line-height:1.7">' + esc(message).replace(/\n/g, '<br>') + '</p>',
        footer: '<div class="spacer"></div>' +
          '<button class="btn" data-no>取消</button>' +
          '<button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" data-yes>' +
          esc(opts.okText || '确定') + '</button>',
        onClose: function () { done(false); }
      });
      mask.querySelector('[data-yes]').addEventListener('click', function () { done(true); });
      mask.querySelector('[data-no]').addEventListener('click', function () { done(false); });
    });
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms || 200);
    };
  }

  /** 生卒展示：「1898–1965」/「1955–」 */
  function lifeSpan(p) {
    var b = p.birthDate || '', d = p.deathDate || '';
    if (!b && !d) return '';
    return b + '–' + d;
  }

  ui.$ = $;
  ui.$$ = $$;
  ui.esc = esc;
  ui.h = h;
  ui.toast = toast;
  ui.openModal = openModal;
  ui.closeModal = closeModal;
  ui.confirmDialog = confirmDialog;
  ui.debounce = debounce;
  ui.lifeSpan = lifeSpan;
})(window);
