/**
 * 视图：成员管理（列表 + 检索 + 详情 + 增删改入口）
 */
(function (global) {
  'use strict';
  var ZP = (global.ZP = global.ZP || {});
  var ui = ZP.ui, S = ZP.schema, repo = ZP.repo;
  var views = (ZP.views = ZP.views || {});

  var filter = { q: '', branchId: '', category: '' };
  var _state = null;
  var _spouseMap = new Map();

  /* ───────── 渲染 ───────── */

  function render(container, state) {
    _state = state;
    _spouseMap = buildSpouseMap(state);

    container.innerHTML =
      '<div class="card">' +
        '<div class="toolbar">' +
          '<input class="input search" id="mlSearch" type="search" placeholder="搜索 姓名 / 拼音 / ID" value="' + ui.esc(filter.q) + '">' +
          '<select class="select auto" id="mlBranch">' + branchOptions(state) + '</select>' +
          '<select class="select auto" id="mlCategory">' +
            '<option value="">全部类别</option>' +
            '<option value="clan"' + (filter.category === 'clan' ? ' selected' : '') + '>本族</option>' +
            '<option value="spouse"' + (filter.category === 'spouse' ? ' selected' : '') + '>配偶</option>' +
          '</select>' +
          '<span class="spacer"></span>' +
          '<span class="muted" id="mlCount"></span>' +
          '<button class="btn btn-primary" id="mlAdd">＋ 新增成员</button>' +
        '</div>' +
        '<div class="card-body tight" id="mlTableWrap"></div>' +
      '</div>';

    ui.$('#mlSearch').addEventListener('input', ui.debounce(function (e) {
      filter.q = e.target.value.trim();
      paintTable();
    }, 160));
    ui.$('#mlBranch').addEventListener('change', function (e) { filter.branchId = e.target.value; paintTable(); });
    ui.$('#mlCategory').addEventListener('change', function (e) { filter.category = e.target.value; paintTable(); });
    ui.$('#mlAdd').addEventListener('click', function () {
      ZP.views.memberForm.open(null, state, function () { ZP.app.refresh(); });
    });

    paintTable();
  }

  function branchOptions(state) {
    var out = '<option value="">全部房支</option>';
    state.branches.forEach(function (b) {
      out += '<option value="' + ui.esc(b.id) + '"' + (filter.branchId === b.id ? ' selected' : '') + '>' +
        ui.esc(b.name) + '</option>';
    });
    return out;
  }

  function matches(p, state) {
    if (filter.branchId && p.branchId !== filter.branchId) return false;
    if (filter.category && p.category !== filter.category) return false;
    if (filter.q) {
      var q = filter.q.toLowerCase();
      var hay = [
        p.name, p.surname, p.namePinyin, p.generationName, p.id,
        p.nativePlace, p.occupation, p.education, p.bio, p.notes,
        S.displayName(p),
        p.category === S.CATEGORY.SPOUSE ? S.spouseLabel(p) : ''
      ].join(' ').toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }

  function hasFilter() { return !!(filter.q || filter.branchId || filter.category); }

  function paintTable() {
    var state = _state;
    var wrap = ui.$('#mlTableWrap');
    if (!wrap) return;

    var rows = state.persons.filter(function (p) { return matches(p, state); });
    var cnt = ui.$('#mlCount');
    if (cnt) cnt.textContent = '共 ' + rows.length + ' / ' + state.persons.length + ' 人';

    if (!rows.length) {
      wrap.innerHTML = '<div class="empty"><div class="big">📭</div>' +
        (hasFilter() ? '<p>没有符合当前条件的成员</p>' : '<p>暂无成员记录</p>') +
        (hasFilter() ? '<button class="btn" id="mlClearFilter">清除筛选条件</button> ' : '') +
        '<button class="btn btn-primary" id="mlEmptyAdd">＋ 新增成员</button></div>';

      var clr = ui.$('#mlClearFilter');
      if (clr) clr.addEventListener('click', function () {
        filter.q = ''; filter.branchId = ''; filter.category = '';
        ZP.app.renderView();
      });
      var b = ui.$('#mlEmptyAdd');
      if (b) b.addEventListener('click', function () { ZP.views.memberForm.open(null, state, function () { ZP.app.refresh(); }); });
      return;
    }

    var html = '<table class="table"><thead><tr>' +
      '<th style="width:78px">世次</th>' +
      '<th>姓名 / 谱中称谓</th>' +
      '<th style="width:56px">性别</th>' +
      '<th style="width:112px">生卒</th>' +
      '<th>父母</th>' +
      '<th style="width:84px">房支</th>' +
      '<th style="width:74px">归属</th>' +
      '<th style="width:150px"></th>' +
      '</tr></thead><tbody>';

    rows.forEach(function (p) {
      html += rowHtml(p, state);
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;

    ui.$$('[data-act]', wrap).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var act = btn.getAttribute('data-act');
        if (act === 'view') showDetail(id);
        else if (act === 'edit') ZP.views.memberForm.open(state.map.get(id), state, function () { ZP.app.refresh(); });
        else if (act === 'del') removePerson(id);
      });
    });
    ui.$$('[data-open]', wrap).forEach(function (el) {
      el.addEventListener('click', function () { showDetail(el.getAttribute('data-open')); });
    });
  }

  function rowHtml(p, state) {
    var spouses = _spouseMap.get(p.id) || [];
    var spouseText = spouses.map(function (s) {
      return S.spouseLabel(s) + (s.deathDate ? '（已故）' : '');
    }).join('、');
    var branch = state.branches.filter(function (b) { return b.id === p.branchId; })[0];

    var lineageTag = p.lineageType === S.LINEAGE.OUT_MARRIED ? '<span class="tag tag-out">外嫁女</span>'
      : p.lineageType === S.LINEAGE.EXTERNAL ? '<span class="tag tag-external">外系</span>'
      : '<span class="tag tag-clan">本宗</span>';

    var catTag = p.category === S.CATEGORY.SPOUSE ? '<span class="tag tag-spouse">配偶</span> ' : '';

    var genText = 'G' + (p.generation || '?') + (p.generationName ? ' · ' + p.generationName + '字辈' : '');

    return '<tr>' +
      '<td class="num">' + ui.esc(genText) + '</td>' +
      '<td class="name-cell">' +
        '<a href="javascript:void(0)" data-open="' + ui.esc(p.id) + '">' + ui.esc(S.displayName(p)) + '</a>' +
        catTag +
        (spouses.length ? '<div class="muted" style="font-size:12px;font-weight:400">' + ui.esc(spouseText) + '</div>' : '') +
        (p.notes ? '<div class="muted" style="font-size:12px;font-weight:400">' + ui.esc(p.notes) + '</div>' : '') +
      '</td>' +
      '<td>' + (p.gender === S.GENDER.MALE ? '男' : '女') + '</td>' +
      '<td class="num">' + ui.esc(ui.lifeSpan(p) || '—') + '</td>' +
      '<td class="muted" style="font-size:12.5px">' + parentsText(p, state) + '</td>' +
      '<td>' + ui.esc(branch ? branch.name : (p.branchId || '—')) + '</td>' +
      '<td>' + lineageTag + '</td>' +
      '<td class="actions">' +
        '<button class="btn btn-sm btn-ghost" data-act="view" data-id="' + ui.esc(p.id) + '">详情</button>' +
        '<button class="btn btn-sm" data-act="edit" data-id="' + ui.esc(p.id) + '">编辑</button>' +
        '<button class="btn btn-sm btn-ghost" data-act="del" data-id="' + ui.esc(p.id) + '" title="删除">🗑</button>' +
      '</td>' +
    '</tr>';
  }

  function parentsText(p, state) {
    var parts = [];
    var f = p.fatherId ? state.map.get(p.fatherId) : null;
    var m = p.motherId ? state.map.get(p.motherId) : null;
    var af = p.adoptiveFatherId ? state.map.get(p.adoptiveFatherId) : null;
    if (f) parts.push('父 ' + ui.esc(S.displayName(f)));
    if (m) parts.push('母 ' + ui.esc(S.displayName(m)));
    if (af) parts.push('<b>嗣父 ' + ui.esc(S.displayName(af)) + '</b>');
    return parts.length ? parts.join(' / ') : '—';
  }

  function buildSpouseMap(state) {
    var m = new Map();
    var ms = state.marriages.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    ms.forEach(function (mar) {
      var h = state.map.get(mar.husbandId), w = state.map.get(mar.wifeId);
      if (!h || !w) return;
      if (!m.has(h.id)) m.set(h.id, []);
      if (!m.has(w.id)) m.set(w.id, []);
      m.get(h.id).push(w);
      m.get(w.id).push(h);
    });
    return m;
  }

  /* ───────── 详情 ───────── */

  function showDetail(id) {
    var state = _state;
    var p = state.map.get(id);
    if (!p) return;

    var spouseItems = (_spouseMap.get(id) || []).map(function (s) {
      var k = ZP.lineage.kinship(id, s.id, state.map);
      return relItem(s, k || '配偶');
    }).join('');

    var childItems = [];
    state.persons.forEach(function (c) {
      if (c.fatherId === id || c.motherId === id || c.adoptiveFatherId === id || c.adoptiveMotherId === id) {
        var k = ZP.lineage.kinship(id, c.id, state.map);
        childItems.push(relItem(c, k || '子女'));
      }
    });

    var parentItems = [];
    [['fatherId', '父'], ['motherId', '母'], ['adoptiveFatherId', '嗣父'], ['adoptiveMotherId', '嗣母']]
      .forEach(function (pair) {
        var pid = p[pair[0]];
        if (!pid) return;
        var per = state.map.get(pid);
        if (!per) return;
        parentItems.push(relItem(per, pair[1]));
      });

    var facts = [
      ['姓　　名', ui.esc(p.surname + (p.surname && p.name ? '' : '') ) + ui.esc(p.name || '')],
      ['谱中称谓', ui.esc(p.category === S.CATEGORY.SPOUSE ? S.spouseLabel(p) : S.displayName(p))],
      ['性　　别', p.gender === S.GENDER.MALE ? '男' : '女'],
      ['类　　别', ui.esc(S.LABELS.category[p.category] || '—')],
      ['谱系归属', ui.esc(S.LABELS.lineageType[p.lineageType] || '—')],
      ['世次字辈', 'G' + ui.esc(p.generation) + (p.generationName ? ' · ' + ui.esc(p.generationName) + '字辈' : '') + (p.birthOrder ? ' · 行' + ui.esc(p.birthOrder) : '')],
      ['生　　卒', ui.esc(ui.lifeSpan(p) || '—') + (p.deathDate ? ' <span class="tag tag-dead">已故</span>' : '')],
      ['房　　支', ui.esc((state.branches.filter(function (b) { return b.id === p.branchId; })[0] || {}).name || p.branchId || '—')]
    ];
    // 次要信息：归入「其他信息」折叠区，默认收起
    var otherFacts = [
      ['籍　　贯', ui.esc(p.nativePlace || '—')],
      ['职　　业', ui.esc(p.occupation || '—')],
      ['学　　历', ui.esc(p.education || '—')],
      ['ID', '<span class="mono">' + ui.esc(p.id) + '</span>']
    ];
    if (p.bio) otherFacts.push(['简　　介', ui.esc(p.bio)]);
    if (p.notes) otherFacts.push(['备　　注', ui.esc(p.notes)]);

    var body =
      '<dl class="detail-list">' +
        facts.map(function (f) { return '<dt>' + f[0] + '</dt><dd>' + f[1] + '</dd>'; }).join('') +
      '</dl>' +
      '<div class="fieldset-title fieldset-toggle" id="dtlOtherToggle" style="margin:2px 0 6px">其他信息<span class="arrow">▸</span></div>' +
      '<dl class="detail-list" id="dtlOtherWrap" style="display:none">' +
        otherFacts.map(function (f) { return '<dt>' + f[0] + '</dt><dd>' + f[1] + '</dd>'; }).join('') +
      '</dl>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:18px">' +
        '<div><div class="fieldset-title" style="margin:0 0 6px">亲属关系</div>' +
          '<ul class="rel-list">' + (parentItems.join('') || '<li class="muted">无记载</li>') + spouseItems + '</ul></div>' +
        '<div><div class="fieldset-title" style="margin:0 0 6px">子女</div>' +
          '<ul class="rel-list">' + (childItems.join('') || '<li class="muted">无记载</li>') + '</ul></div>' +
      '</div>';

    var mask = ui.openModal({
      title: '成员详情',
      width: '700px',
      body: body,
      footer: '<div class="spacer"></div>' +
        '<button class="btn" data-close>关闭</button>' +
        '<button class="btn btn-primary" id="dtlEdit">编辑此成员</button>'
    });
    mask.querySelector('#dtlEdit').addEventListener('click', function () {
      ui.closeModal();
      ZP.views.memberForm.open(p, state, function () { ZP.app.refresh(); });
    });
    // 「其他信息」折叠/展开
    var otherToggle = mask.querySelector('#dtlOtherToggle');
    var otherWrap = mask.querySelector('#dtlOtherWrap');
    otherToggle.addEventListener('click', function () {
      var open = otherWrap.style.display === 'none';
      otherWrap.style.display = open ? '' : 'none';
      otherToggle.classList.toggle('open', open);
    });
    ui.$$('[data-open]', mask).forEach(function (el) {
      el.addEventListener('click', function () { showDetail(el.getAttribute('data-open')); });
    });
  }

  function relItem(person, kinLabel) {
    return '<li><a href="javascript:void(0)" data-open="' + ui.esc(person.id) + '">' +
      ui.esc(S.displayName(person)) + '</a>' +
      '<span class="muted">' + ui.esc(kinLabel) + '</span></li>';
  }

  /* ───────── 删除 ───────── */

  async function removePerson(id) {
    var state = _state;
    var p = state.map.get(id);
    if (!p) return;
    var yes = await ui.confirmDialog(
      '确认删除成员「' + S.displayName(p) + '」？\n若其被他人引用为父母或存在婚姻记录，将无法删除。',
      { danger: true, okText: '删除' }
    );
    if (!yes) return;

    var res = await repo.deletePerson(id);
    if (!res.ok) {
      ui.openModal({
        title: '无法删除',
        width: '460px',
        body: '<div class="alert alert-warn" style="margin:0">该成员仍被引用：<ul>' +
          res.errors.map(function (e) { return '<li>' + ui.esc(e) + '</li>'; }).join('') +
          '</ul>请先解除相关关系。</div>',
        footer: '<div class="spacer"></div><button class="btn btn-primary" data-close>知道了</button>'
      });
      return;
    }
    ui.toast('已删除「' + S.displayName(p) + '」', 'ok');
    ZP.app.refresh();
  }

  views.members = {
    render: render,
    refresh: paintTable,
    showDetail: showDetail
  };
})(window);
