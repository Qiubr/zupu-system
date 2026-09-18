/**
 * 视图：数据管理（宗族信息 · 房支 · 备份恢复 · 统计）
 */
(function (global) {
  'use strict';
  var ZP = (global.ZP = global.ZP || {});
  var ui = ZP.ui, S = ZP.schema, repo = ZP.repo;
  var views = (ZP.views = ZP.views || {});

  var _state = null;

  function render(container, state) {
    _state = state;
    var persons = state.persons;

    container.innerHTML =
      // 宗族信息
      '<div class="card">' +
        '<div class="card-head"><h3>宗族信息</h3><span class="hint">用于封面、导出与字辈参考</span></div>' +
        '<div class="card-body">' +
          '<div class="form-grid">' +
            '<div class="field"><label>宗族名称</label><input class="input" id="setClanName" value="' + ui.esc(state.meta.clanName || '') + '" placeholder="如 甬上王氏"></div>' +
            '<div class="field"><label>本族姓氏</label><input class="input" id="setSurname" value="' + ui.esc(state.meta.surname || '') + '" placeholder="如 王"></div>' +
            '<div class="field span-2"><label>字辈诗 <span class="help">仅作参考，不做强校验</span></label><input class="input" id="setPoem" value="' + ui.esc(state.meta.generationPoem || '') + '" placeholder="如 守德建志承先泽"></div>' +
          '</div>' +
          '<div style="margin-top:14px"><button class="btn btn-primary" id="setSave">保存宗族信息</button></div>' +
        '</div>' +
      '</div>' +

      // 统计
      '<div class="card">' +
        '<div class="card-head"><h3>数据统计</h3></div>' +
        '<div class="card-body"><div id="dataStats"></div></div>' +
      '</div>' +

      // 房支
      '<div class="card">' +
        '<div class="card-head"><h3>房支管理</h3><button class="btn btn-sm btn-primary" id="brAdd">＋ 新增房支</button></div>' +
        '<div class="card-body tight" id="branchWrap"></div>' +
      '</div>' +

      // 备份恢复
      '<div class="card">' +
        '<div class="card-head"><h3>备份与恢复</h3><span class="hint">数据存于本机浏览器，建议定期导出备份</span></div>' +
        '<div class="card-body">' +
          '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
            '<button class="btn btn-primary" id="expBtn">⬇ 导出全部数据（JSON）</button>' +
            '<button class="btn" id="impBtn">⬆ 从 JSON 导入</button>' +
            '<button class="btn" id="seedBtn">重置为示例数据</button>' +
            '<button class="btn btn-danger" id="clearBtn">清空全部数据</button>' +
          '</div>' +
          '<input type="file" id="impFile" accept=".json,application/json" style="display:none">' +
          '<p class="muted" style="font-size:12.5px;margin:14px 0 0">' +
            '导出的 JSON 含成员、婚姻、房支与设置，可用于换机迁移或长期存档。' +
            '导入为<b>整库覆盖</b>，请先确认已备份现有数据。' +
          '</p>' +
        '</div>' +
      '</div>';

    paintStats(state);
    paintBranches(state);
    bind(container, state);
  }

  /* ───────── 统计 ───────── */

  function paintStats(state) {
    var host = ui.$('#dataStats');
    if (!host) return;
    var persons = state.persons;
    var gens = persons.map(function (p) { return Number(p.generation) || 0; }).filter(Boolean);
    var alive = persons.filter(function (p) { return !p.deathDate; }).length;
    var adopted = persons.filter(function (p) { return p.adoptiveFatherId; }).length;
    var outMarried = persons.filter(function (p) { return p.lineageType === S.LINEAGE.OUT_MARRIED; }).length;
    var external = persons.filter(function (p) { return p.lineageType === S.LINEAGE.EXTERNAL; }).length;

    var items = [
      ['成员总数', persons.length, ''],
      ['本族 / 配偶', persons.filter(function (p) { return p.category === S.CATEGORY.CLAN; }).length + ' / ' + persons.filter(function (p) { return p.category === S.CATEGORY.SPOUSE; }).length, ''],
      ['婚姻记录', state.marriages.length, ''],
      ['房支数', state.branches.length, ''],
      ['世代跨度', gens.length ? (Math.min.apply(null, gens) + ' – ' + Math.max.apply(null, gens) + ' 世') : '—', ''],
      ['在世 / 已故', alive + ' / ' + (persons.length - alive), ''],
      ['过继', adopted, ''],
      ['外嫁女 / 外系', outMarried + ' / ' + external, '']
    ];

    host.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px">' +
      items.map(function (it) {
        return '<div style="padding:12px 14px;background:var(--surface-alt);border:1px solid var(--line);border-radius:6px">' +
          '<div class="muted" style="font-size:12px">' + it[0] + '</div>' +
          '<div style="font-size:19px;font-weight:600;margin-top:3px;font-variant-numeric:tabular-nums">' + ui.esc(it[1]) + '</div>' +
        '</div>';
      }).join('') + '</div>';
  }

  /* ───────── 房支 ───────── */

  function paintBranches(state) {
    var wrap = ui.$('#branchWrap');
    if (!wrap) return;
    if (!state.branches.length) {
      wrap.innerHTML = '<div class="empty"><p>暂无房支，点击右上角新增</p></div>';
      return;
    }
    var html = '<table class="table"><thead><tr>' +
      '<th style="width:80px">编号</th><th>房名</th><th>上级房支</th><th>房祖</th>' +
      '<th style="width:70px">排序</th><th style="width:150px"></th></tr></thead><tbody>';
    state.branches.forEach(function (b) {
      var parent = state.branches.filter(function (x) { return x.id === b.parentBranchId; })[0];
      var founder = b.founderPersonId ? state.map.get(b.founderPersonId) : null;
      var memberCount = state.persons.filter(function (p) { return p.branchId === b.id; }).length;
      html += '<tr>' +
        '<td class="mono">' + ui.esc(b.id) + '</td>' +
        '<td class="name-cell">' + ui.esc(b.name) + ' <span class="muted" style="font-weight:400;font-size:12px">' + memberCount + ' 人</span></td>' +
        '<td class="muted">' + ui.esc(parent ? parent.name : '—') + '</td>' +
        '<td class="muted">' + ui.esc(founder ? S.displayName(founder) : '—') + '</td>' +
        '<td class="num">' + ui.esc(b.sortOrder || '') + '</td>' +
        '<td class="actions">' +
          '<button class="btn btn-sm" data-bredit="' + ui.esc(b.id) + '">编辑</button>' +
          '<button class="btn btn-sm btn-ghost" data-brdel="' + ui.esc(b.id) + '">删除</button>' +
        '</td></tr>';
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;

    ui.$$('[data-bredit]', wrap).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var b = state.branches.filter(function (x) { return x.id === btn.getAttribute('data-bredit'); })[0];
        openBranchForm(b, state);
      });
    });
    ui.$$('[data-brdel]', wrap).forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var id = btn.getAttribute('data-brdel');
        var b = state.branches.filter(function (x) { return x.id === id; })[0];
        var used = state.persons.filter(function (p) { return p.branchId === id; }).length;
        if (used) {
          ui.toast('「' + b.name + '」下仍有 ' + used + ' 名成员，不能删除', 'err');
          return;
        }
        var yes = await ui.confirmDialog('确认删除房支「' + b.name + '」？', { danger: true, okText: '删除' });
        if (!yes) return;
        await repo.deleteBranch(id);
        ui.toast('已删除房支', 'ok');
        ZP.app.refresh();
      });
    });
  }

  function openBranchForm(branch, state) {
    var isNew = !branch;
    var b = branch || { id: '', name: '', parentBranchId: null, founderPersonId: null, sortOrder: state.branches.length + 1 };

    var parentOpts = '<option value="">（无 · 顶级房支）</option>' + state.branches
      .filter(function (x) { return x.id !== b.id; })
      .map(function (x) { return '<option value="' + ui.esc(x.id) + '"' + (b.parentBranchId === x.id ? ' selected' : '') + '>' + ui.esc(x.name) + '</option>'; }).join('');

    var founderOpts = '<option value="">（未指定）</option>' + state.persons.map(function (p) {
      return '<option value="' + ui.esc(p.id) + '"' + (b.founderPersonId === p.id ? ' selected' : '') + '>' + ui.esc(S.displayName(p)) + ' · ' + ui.esc(p.id) + '</option>';
    }).join('');

    var mask = ui.openModal({
      title: isNew ? '新增房支' : '编辑房支',
      width: '560px',
      body: '<div class="form-grid">' +
        '<div class="field"><label>房支编号<span class="req">*</span></label><input class="input" name="id" value="' + ui.esc(b.id) + '" placeholder="如 B03"' + (isNew ? '' : ' readonly style="background:var(--bg-sunken)"') + '></div>' +
        '<div class="field"><label>房名<span class="req">*</span></label><input class="input" name="name" value="' + ui.esc(b.name) + '" placeholder="如 三房"></div>' +
        '<div class="field"><label>上级房支</label><select class="select" name="parentBranchId">' + parentOpts + '</select></div>' +
        '<div class="field"><label>排序</label><input class="input" type="number" name="sortOrder" value="' + ui.esc(b.sortOrder) + '"></div>' +
        '<div class="field span-2"><label>房祖</label><select class="select" name="founderPersonId">' + founderOpts + '</select></div>' +
        '</div><div id="brErrors"></div>',
      footer: '<div class="spacer"></div><button class="btn" data-close>取消</button>' +
        '<button class="btn btn-primary" id="brSave">保存</button>'
    });

    mask.querySelector('#brSave').addEventListener('click', async function () {
      var data = {
        id: mask.querySelector('[name="id"]').value.trim(),
        name: mask.querySelector('[name="name"]').value.trim(),
        parentBranchId: mask.querySelector('[name="parentBranchId"]').value || null,
        founderPersonId: mask.querySelector('[name="founderPersonId"]').value || null,
        sortOrder: mask.querySelector('[name="sortOrder"]').value
      };
      if (!data.id || !data.name) {
        mask.querySelector('#brErrors').innerHTML = '<div class="alert alert-error">编号与房名不能为空</div>';
        return;
      }
      if (isNew && state.branches.some(function (x) { return x.id === data.id; })) {
        mask.querySelector('#brErrors').innerHTML = '<div class="alert alert-error">房支编号「' + ui.esc(data.id) + '」已存在</div>';
        return;
      }
      await repo.saveBranch(data);
      ui.closeModal();
      ui.toast(isNew ? '已新增房支' : '已保存房支', 'ok');
      ZP.app.refresh();
    });
  }

  /* ───────── 备份 / 恢复 / 设置 ───────── */

  function bind(container, state) {
    ui.$('#setSave').addEventListener('click', async function () {
      await repo.setMeta('clanName', ui.$('#setClanName').value.trim());
      await repo.setMeta('surname', ui.$('#setSurname').value.trim());
      await repo.setMeta('generationPoem', ui.$('#setPoem').value.trim());
      ui.toast('宗族信息已保存', 'ok');
      ZP.app.reload().then(function () {
        var el = document.getElementById('brandName');
        if (el) el.textContent = ui.$('#setClanName').value.trim() || '族谱管理系统';
      });
    });

    ui.$('#expBtn').addEventListener('click', async function () {
      var text = await repo.exportJSON();
      var name = (state.meta.clanName || '族谱') + '-备份-' + stamp() + '.json';
      downloadText(text, name);
      ui.toast('已导出 ' + name, 'ok');
    });

    ui.$('#impBtn').addEventListener('click', function () { ui.$('#impFile').click(); });

    ui.$('#impFile').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = async function () {
        var yes = await ui.confirmDialog(
          '导入将【覆盖】当前全部数据，且不可撤销。\n建议先导出备份。确认继续？',
          { danger: true, okText: '覆盖导入' }
        );
        if (!yes) { e.target.value = ''; return; }
        try {
          var res = await repo.importJSON(reader.result);
          ui.toast('导入成功：' + res.persons + ' 名成员，' + res.marriages + ' 条婚姻', 'ok');
          ZP.app.reload().then(function () { ZP.app.renderView(); });
        } catch (err) {
          ui.toast('导入失败：' + err.message, 'err');
        }
        e.target.value = '';
      };
      reader.readAsText(file, 'utf-8');
    });

    ui.$('#seedBtn').addEventListener('click', async function () {
      var yes = await ui.confirmDialog(
        '将清空现有数据并重新载入示例族谱（10 人）。\n此操作不可撤销，确认继续？',
        { danger: true, okText: '重置' }
      );
      if (!yes) return;
      await repo.resetToSeed();
      ui.toast('已重置为示例数据', 'ok');
      ZP.app.reload().then(function () { ZP.app.renderView(); });
    });

    ui.$('#clearBtn').addEventListener('click', async function () {
      var yes = await ui.confirmDialog(
        '将清空全部成员、婚姻与房支数据（保留宗族信息）。\n此操作不可撤销，强烈建议先导出备份。确认清空？',
        { danger: true, okText: '全部清空' }
      );
      if (!yes) return;
      await ZP.idb.clearAll();
      ui.toast('数据已清空', 'warn');
      ZP.app.reload().then(function () { ZP.app.renderView(); });
    });

    ui.$('#brAdd').addEventListener('click', function () { openBranchForm(null, state); });
  }

  function stamp() {
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }

  function downloadText(text, filename) {
    var blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  views.data = { render: render };
})(window);
