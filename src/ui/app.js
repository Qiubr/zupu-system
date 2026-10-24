/**
 * 应用主控：状态、路由、数据加载（挂 window.ZP.app）
 */
(function (global) {
  'use strict';
  var ZP = (global.ZP = global.ZP || {});
  var ui = ZP.ui;
  var repo = ZP.repo;

  var ROUTES = [
    { key: 'members', label: '成员管理', icon: '👪' },
    { key: 'tree', label: '世系图', icon: '🌳' },
    { key: 'data', label: '数据管理', icon: '🗄️' }
  ];

  var state = {
    route: 'members',
    persons: [],
    marriages: [],
    branches: [],
    meta: {},
    map: new Map(),
    childrenMap: new Map(),
    genesis: null
  };

  /** 重新从数据库加载全部数据 */
  async function reload() {
    var res = await Promise.all([
      repo.listPersons(),
      repo.listMarriages(),
      repo.listBranches(),
      repo.getAllMeta()
    ]);
    state.persons = res[0];
    state.marriages = res[1];
    state.branches = res[2];
    state.meta = res[3];
    state.map = new Map();
    state.persons.forEach(function (p) { state.map.set(p.id, p); });
    state.childrenMap = ZP.lineage.buildChildrenMap(state.persons);
    state.genesis = ZP.lineage.buildForest(state.persons, state.marriages);
    renderStats();
    return state;
  }

  function renderStats() {
    var persons = state.persons;
    var gens = persons.map(function (p) { return Number(p.generation) || 0; }).filter(Boolean);
    var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
    set('statPersons', persons.length);
    set('statBranches', state.branches.length);
    set('statGenerations', gens.length ? (Math.max.apply(null, gens) - Math.min.apply(null, gens) + 1) : 0);
  }

  function renderBrand() {
    var clanName = state.meta.clanName || '族谱管理系统';
    var el = document.getElementById('brandName');
    if (el) el.textContent = clanName;
    var t = document.getElementById('topTitle');
    var cur = ROUTES.filter(function (r) { return r.key === state.route; })[0];
    if (t && cur) t.textContent = cur.label;
  }

  function renderNav() {
    var nav = document.getElementById('nav');
    if (!nav) return;
    nav.innerHTML = ROUTES.map(function (r) {
      return '<button class="nav-item' + (r.key === state.route ? ' active' : '') + '" data-route="' + r.key + '">' +
        '<span class="ico">' + r.icon + '</span>' + ui.esc(r.label) + '</button>';
    }).join('') +
      '<div class="nav-sep"></div>' +
      '<div class="nav-foot">数据存于本机浏览器<br>请定期导出备份</div>';

    ui.$$('[data-route]', nav).forEach(function (btn) {
      btn.addEventListener('click', function () { navigate(btn.getAttribute('data-route')); });
    });
  }

  function navigate(route) {
    state.route = route;
    renderNav();
    renderBrand();
    renderView();
  }

  function renderView() {
    var main = document.getElementById('main');
    if (!main) return;
    var view = ZP.views[state.route];
    main.scrollTop = 0;
    if (!view) { main.innerHTML = '<div class="empty">页面不存在</div>'; return; }
    view.render(main, state);
  }

  async function refresh() {
    await reload();
    renderView();
  }

  async function boot() {
    try {
      await repo.init();
      await reload();
      renderNav();
      renderBrand();
      renderView();
    } catch (err) {
      console.error(err);
      document.getElementById('main').innerHTML =
        '<div class="empty"><div class="big">⚠️</div><p>初始化失败：' + ui.esc(err && err.message || err) + '</p></div>';
    }
  }

  ZP.app = {
    state: state,
    boot: boot,
    reload: reload,
    refresh: refresh,
    navigate: navigate,
    renderView: renderView,
    renderStats: renderStats
  };

  document.addEventListener('DOMContentLoaded', boot);
})(window);
