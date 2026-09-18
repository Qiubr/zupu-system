/**
 * 视图：成员录入 / 编辑表单（含配偶管理）
 */
(function (global) {
  'use strict';
  var ZP = (global.ZP = global.ZP || {});
  var ui = ZP.ui, S = ZP.schema, repo = ZP.repo, L = ZP.lineage;
  var views = (ZP.views = ZP.views || {});

  /**
   * 打开表单
   * @param {object|null} person  传入为编辑，null 为新增
   * @param {object} state
   * @param {Function} onDone
   */
  function open(person, state, onDone) {
    var isNew = !person;
    var p = Object.assign({
      id: '', surname: state.meta.surname || '', name: '', namePinyin: '',
      gender: S.GENDER.MALE, category: S.CATEGORY.CLAN, lineageType: S.LINEAGE.CLAN,
      generation: person ? person.generation : (maxGeneration(state) + 1),
      generationName: '', birthOrder: null,
      birthDate: '', deathDate: '',
      fatherId: null, motherId: null, adoptiveFatherId: null, adoptiveMotherId: null,
      branchId: state.branches[0] ? state.branches[0].id : 'B01',
      nativePlace: '', occupation: '', education: '', bio: '', notes: ''
    }, person || {});

    var context = {
      state: state,
      isNew: isNew,
      idTouched: !isNew,
      original: person
    };

    var mask = ui.openModal({
      title: isNew ? '新增成员' : '编辑成员 · ' + S.displayName(p),
      width: '820px',
      body: formHtml(p, state, isNew),
      footer: '<div class="spacer"></div>' +
        '<button class="btn" data-close>取消</button>' +
        '<button class="btn btn-primary" id="mfSave">' + (isNew ? '创建成员' : '保存修改') + '</button>'
    });

    var form = mask.querySelector('#mfForm');
    // 通过 elements 集合按 name 取控件（比 form.name 的命名访问更稳妥，且兼容性更好）
    var f = form.elements;

    // ID 自动生成（新增时；用户手工改过则不再覆盖）
    function autoId() {
      if (!context.isNew || context.idTouched) return;
      f.id.value = S.nextPersonId(f.branchId.value, Number(f.generation.value) || 1, state.persons);
    }

    /** 实时校验：字段一变即重算，错误/提醒直接标在对应字段下方 */
    function revalidate() {
      var data = buildData(form, context);
      var map = new Map(state.map);
      if (!context.isNew) map.delete(data.id);
      var v = repo.validatePerson(data, map, context.isNew);
      paintIssues(form, v);
      return v;
    }

    /** 世次联动：选择父母/嗣父母后，提示「应为第 N+1 世」并可一键采纳 */
    function genHint() {
      var host = form.querySelector('#mfHints');
      if (!host) return;

      var base = null, label = '';
      [['fatherId', '生父'], ['motherId', '生母'], ['adoptiveFatherId', '嗣父'], ['adoptiveMotherId', '嗣母']]
        .forEach(function (pair) {
          if (base !== null) return;
          var rid = f[pair[0]].value;
          if (!rid) return;
          var per = state.map.get(rid);
          if (per && Number(per.generation)) {
            base = Number(per.generation);
            label = pair[1] + '「' + S.displayName(per) + '」';
          }
        });

      var cur = Number(f.generation.value) || 0;
      if (base === null) {
        host.innerHTML = cur ? '<div class="hint-line">未选父母，按当前第 ' + cur + ' 世录入</div>' : '';
        return;
      }

      var sug = base + 1;
      if (cur === sug) {
        host.innerHTML = '<div class="hint-line ok">✓ 依' + ui.esc(label) + '（第 ' + base +
          ' 世）推算，本人第 ' + sug + ' 世 —— 已一致</div>';
        return;
      }
      host.innerHTML = '<div class="hint-line warn">依' + ui.esc(label) + '（第 ' + base +
        ' 世）推算，本人应为第 <b>' + sug + '</b> 世，当前填第 ' + (cur || '?') + ' 世' +
        '<button type="button" class="btn btn-sm" id="mfAdoptGen">采纳第 ' + sug + ' 世</button></div>';

      var btn = host.querySelector('#mfAdoptGen');
      if (btn) btn.addEventListener('click', function () {
        f.generation.value = sug;
        context.idTouched = false;    // 世次变了，ID 需跟随重算
        autoId();
        genHint();
        revalidate();
      });
    }

    function onChange(ev) {
      if (ev && ev.target && ev.target.name === 'id') context.idTouched = true;
      autoId();
      genHint();
      revalidate();
    }
    form.addEventListener('input', onChange);
    form.addEventListener('change', onChange);

    // 分类切换时联动：配偶默认女性
    f.category.addEventListener('change', function () {
      if (f.category.value === S.CATEGORY.SPOUSE && f.gender.value !== S.GENDER.FEMALE) {
        f.gender.value = S.GENDER.FEMALE;
      }
    });

    // 新增时若 ID 被清空并离开焦点，重新给出建议值
    f.id.addEventListener('blur', function () {
      if (context.isNew && !f.id.value.trim()) {
        context.idTouched = false;
        autoId();
        revalidate();
      }
    });

    // Ctrl / Cmd + Enter 快速保存
    form.addEventListener('keydown', function (ev) {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
        ev.preventDefault();
        submit(form, context, onDone);
      }
    });

    autoId();      // 打开即预填建议 ID，减少手工输入
    genHint();
    revalidate();

    // 「其他」区块折叠/展开：默认折叠；编辑时若已有内容则自动展开
    var otherToggle = mask.querySelector('#mfOtherToggle');
    var otherWrap = mask.querySelector('#mfOtherWrap');
    function setOtherOpen(open) {
      otherWrap.style.display = open ? '' : 'none';
      otherToggle.classList.toggle('open', open);
    }
    otherToggle.addEventListener('click', function () {
      setOtherOpen(otherWrap.style.display === 'none');
    });
    if (!isNew && (p.nativePlace || p.occupation || p.education || p.bio || p.notes)) {
      setOtherOpen(true);
    }

    mask.querySelector('#mfSave').addEventListener('click', function () { submit(form, context, onDone); });

    // 婚姻管理（仅编辑模式）
    if (!isNew) {
      bindMarriageSection(mask, p, state, onDone);
    }
    return mask;
  }

  function maxGeneration(state) {
    var g = state.persons.map(function (x) { return Number(x.generation) || 0; });
    return g.length ? Math.max.apply(null, g) : 0;
  }

  /* ───────── 表单 HTML ───────── */

  function formHtml(p, state, isNew) {
    var exclude = descendantsOfAndSelf(isNew ? null : p.id, state);
    var branchOpts = state.branches.map(function (b) {
      return '<option value="' + ui.esc(b.id) + '"' + (p.branchId === b.id ? ' selected' : '') + '>' + ui.esc(b.name) + '</option>';
    }).join('');

    return '<form id="mfForm" autocomplete="off" onsubmit="return false">' +
      '<div class="form-grid">' +

        '<div class="fieldset-title">基本信息</div>' +
        field('姓氏', '<input class="input" name="surname" value="' + ui.esc(p.surname) + '" placeholder="如 王">', true) +
        field('名字', '<input class="input" name="name" value="' + ui.esc(p.name) + '" placeholder="如 建国">', true) +
        field('性别', selectOf('gender', [['M', '男'], ['F', '女']], p.gender), true) +
        field('成员分类', selectOf('category', [['clan', '本族成员'], ['spouse', '配偶（配氏）']], p.category), true) +
        field('谱系归属', selectOf('lineageType', [
          ['clan', '本宗'], ['outMarried', '外嫁女'], ['external', '外系（外嫁女子女）']
        ], p.lineageType), false, '外嫁女其子女可选入谱，填「外系」') +
        field('姓拼音', '<input class="input" name="namePinyin" value="' + ui.esc(p.namePinyin || '') + '" placeholder="jianguo，用于检索">') +

        '<div class="fieldset-title">世次与房支</div>' +
        field('世次 <span class="help">始祖 = 1</span>', '<input class="input" name="generation" type="number" min="1" step="1" value="' + ui.esc(p.generation) + '">', true) +
        field('字辈 <span class="help">不强校验</span>', '<input class="input" name="generationName" value="' + ui.esc(p.generationName || '') + '" placeholder="如 建">') +
        field('排行', '<input class="input" name="birthOrder" type="number" min="0" step="1" value="' + (p.birthOrder == null ? '' : ui.esc(p.birthOrder)) + '">') +
        field('所属房支', '<select class="select" name="branchId">' + branchOpts + '</select>') +

        '<div class="fieldset-title">生卒</div>' +
        field('出生', '<input class="input" name="birthDate" value="' + ui.esc(p.birthDate || '') + '" placeholder="1932（可只填年）">') +
        field('去世 <span class="help">有值即视为已故</span>', '<input class="input" name="deathDate" value="' + ui.esc(p.deathDate || '') + '" placeholder="留空表示在世">') +

        '<div class="fieldset-title">亲属关系</div>' +
        field('生父', personSelect('fatherId', p.fatherId, state, exclude), false) +
        field('生母', personSelect('motherId', p.motherId, state, exclude), false) +
        field('嗣父 <span class="help">过继时填写</span>', personSelect('adoptiveFatherId', p.adoptiveFatherId, state, exclude), false, '填写嗣父后，世系图归属嗣父，并自动标注本生父') +
        field('嗣母', personSelect('adoptiveMotherId', p.adoptiveMotherId, state, exclude), false) +
        '<div id="mfHints"></div>' +

        '<div class="fieldset-title fieldset-toggle" id="mfOtherToggle">其他<span class="arrow">▸</span></div>' +
        '<div id="mfOtherWrap" style="grid-column:1/-1;display:none">' +
          '<div class="form-grid" style="margin-top:4px">' +
            field('籍贯', '<input class="input" name="nativePlace" value="' + ui.esc(p.nativePlace || '') + '">') +
            field('职业', '<input class="input" name="occupation" value="' + ui.esc(p.occupation || '') + '">') +
            field('学历', '<input class="input" name="education" value="' + ui.esc(p.education || '') + '">') +
            field('成员 ID <span class="help">房支-世次-序号</span>', '<input class="input mono" name="id" value="' + ui.esc(p.id) + '"' + (isNew ? '' : ' readonly style="background:var(--bg-sunken)"') + '>', true) +
            field('简介', '<textarea class="textarea" name="bio">' + ui.esc(p.bio || '') + '</textarea>', false, null, true) +
            field('备注', '<input class="input" name="notes" value="' + ui.esc(p.notes || '') + '" placeholder="如 过继给建国为嗣">', false, null, true) +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div id="mfErrors"></div>' +
    '</form>' +
    (isNew ? '' : '<div id="mfMarriage"></div>');
  }

  function field(label, control, required, help, span2) {
    return '<div class="field' + (span2 ? ' span-2' : '') + '">' +
      '<label>' + label + (required ? '<span class="req">*</span>' : '') + '</label>' +
      control +
      (help ? '<span class="help">' + help + '</span>' : '') +
      '</div>';
  }

  function selectOf(name, pairs, value) {
    return '<select class="select" name="' + name + '">' +
      pairs.map(function (pair) {
        return '<option value="' + pair[0] + '"' + (value === pair[0] ? ' selected' : '') + '>' + pair[1] + '</option>';
      }).join('') + '</select>';
  }

  /** 人物下拉：按世次分组，排除指定 id 集合 */
  function personSelect(name, value, state, exclude) {
    var groups = {};
    state.persons.forEach(function (per) {
      if (exclude && exclude.has(per.id)) return;
      var g = Number(per.generation) || 0;
      (groups[g] = groups[g] || []).push(per);
    });
    var gens = Object.keys(groups).map(Number).sort(function (a, b) { return a - b; });
    var opts = '<option value="">（未填写）</option>';
    gens.forEach(function (g) {
      opts += '<optgroup label="第 ' + g + ' 世">';
      groups[g].forEach(function (per) {
        opts += '<option value="' + ui.esc(per.id) + '"' + (value === per.id ? ' selected' : '') + '>' +
          ui.esc(S.displayName(per)) + ' · ' + ui.esc(per.id) + '</option>';
      });
      opts += '</optgroup>';
    });
    return '<select class="select" name="' + name + '">' + opts + '</select>';
  }

  /* ───────── 提交 ───────── */

  /** 从表单收集数据（新增 / 编辑共用） */
  function buildData(form, context) {
    var e = form.elements;
    var data = {
      id: e.id.value.trim(),
      surname: e.surname.value.trim(),
      name: e.name.value.trim(),
      namePinyin: e.namePinyin.value.trim(),
      gender: e.gender.value,
      category: e.category.value,
      lineageType: e.lineageType.value,
      generation: e.generation.value,
      generationName: e.generationName.value.trim(),
      birthOrder: e.birthOrder.value,
      birthDate: e.birthDate.value.trim(),
      deathDate: e.deathDate.value.trim(),
      fatherId: e.fatherId.value || null,
      motherId: e.motherId.value || null,
      adoptiveFatherId: e.adoptiveFatherId.value || null,
      adoptiveMotherId: e.adoptiveMotherId.value || null,
      branchId: e.branchId.value,
      nativePlace: e.nativePlace.value.trim(),
      occupation: e.occupation.value.trim(),
      education: e.education.value.trim(),
      bio: e.bio.value.trim(),
      notes: e.notes.value.trim()
    };
    if (context.original) {
      data.createdAt = context.original.createdAt;
      data.portraitId = context.original.portraitId;
    }
    return data;
  }

  /** 把校验结果画到字段下方（每字段只显示一条：错误优先于提醒） */
  function paintIssues(form, v) {
    ui.$$('.field-msg', form).forEach(function (el) { el.parentNode.removeChild(el); });
    ui.$$('.field', form).forEach(function (el) { el.classList.remove('has-error', 'has-warn'); });

    var top = Object.create(null);
    (v.issues || []).forEach(function (it) {
      var cur = top[it.field];
      if (!cur || (cur.level === 'warn' && it.level === 'error')) top[it.field] = it;
    });

    Object.keys(top).forEach(function (name) {
      var ctl = form.elements[name];
      if (!ctl || !ctl.closest) return;
      var wrap = ctl.closest('.field');
      if (!wrap) return;
      var it = top[name];
      wrap.classList.add(it.level === 'error' ? 'has-error' : 'has-warn');
      var msg = document.createElement('span');
      msg.className = 'field-msg ' + it.level;
      msg.textContent = (it.level === 'error' ? '✕ ' : '⚠ ') + it.msg;
      wrap.appendChild(msg);
    });
  }

  async function submit(form, context, onDone) {
    var data = buildData(form, context);
    var res = await repo.savePerson(data, context.isNew);
    var errBox = form.querySelector('#mfErrors');

    if (!res.ok) {
      // 同步刷新字段级提示，并把焦点送到第一个出错字段
      var map = new Map(context.state.map);
      if (!context.isNew) map.delete(data.id);
      paintIssues(form, repo.validatePerson(data, map, context.isNew));

      errBox.innerHTML = '<div class="alert alert-error" style="margin-top:14px"><b>无法保存：</b><ul>' +
        res.errors.map(function (e) { return '<li>' + ui.esc(e) + '</li>'; }).join('') + '</ul></div>';
      errBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      var bad = form.querySelector('.field.has-error');
      var ctl = bad ? bad.querySelector('input, select, textarea') : null;
      if (ctl) setTimeout(function () { ctl.focus(); }, 260);
      return;
    }

    ui.closeModal();
    ui.toast(context.isNew ? '已创建成员「' + S.displayName(res.person) + '」' : '已保存修改', 'ok');
    (res.warnings || []).slice(0, 3).forEach(function (w, i) {
      setTimeout(function () { ui.toast(w, 'warn'); }, 320 * (i + 1));
    });
    if (onDone) onDone();
  }

  /** 自身 + 全部后代（用于父母下拉排除，防循环） */
  function descendantsOfAndSelf(id, state) {
    var set = new Set();
    if (!id) return set;
    set.add(id);
    var queue = [id];
    var persons = state.persons;
    var guard = 0;
    while (queue.length && guard++ < 5000) {
      var cur = queue.shift();
      persons.forEach(function (p) {
        if (set.has(p.id)) return;
        if (p.fatherId === cur || p.motherId === cur || p.adoptiveFatherId === cur || p.adoptiveMotherId === cur) {
          set.add(p.id);
          queue.push(p.id);
        }
      });
    }
    return set;
  }

  /* ───────── 配偶管理 ───────── */

  function bindMarriageSection(mask, person, state, onDone) {
    var host = mask.querySelector('#mfMarriage');
    if (!host) return;

    async function paint() {
      var list = await repo.spousesOf(person.id, state.map);
      var html = '<div class="fieldset-title" style="margin:20px 0 6px">配偶（' + list.length + '）</div>';
      if (!list.length) {
        html += '<p class="muted" style="font-size:12.5px;margin:0 0 10px">暂无婚姻记录。多配偶可逐条添加，按顺序展示。</p>';
      } else {
        html += '<div style="margin-bottom:10px">';
        list.forEach(function (item) {
          var m = item.marriage, sp = item.person;
          html += '<div class="marriage-row">' +
            '<div>' + ui.esc(S.displayName(sp)) + ' <span class="mono muted">' + ui.esc(sp.id) + '</span></div>' +
            '<div>' + ui.esc(S.LABELS.marriageType[m.type] || m.type) + '</div>' +
            '<div>' + ui.esc(S.LABELS.marriageStatus[m.status] || '—') + '</div>' +
            '<div class="muted">' + ui.esc((m.startYear || '?') + '–' + (m.endYear || '')) + '</div>' +
            '<div class="actions"><button type="button" class="btn btn-sm btn-ghost" data-medit="' + ui.esc(m.id) + '">改</button>' +
            '<button type="button" class="btn btn-sm btn-ghost" data-mdel="' + ui.esc(m.id) + '">删</button></div>' +
          '</div>';
        });
        html += '</div>';
      }
      html += '<button type="button" class="btn btn-sm" id="mfAddMarriage">＋ 添加配偶</button>';
      host.innerHTML = html;

      host.querySelector('#mfAddMarriage').addEventListener('click', function () {
        openMarriageForm(person, state, null, function () { paint(); if (onDone) onDone(); });
      });
      ui.$$('[data-medit]', host).forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-medit');
          repo.listMarriages().then(function (all) {
            var m = all.filter(function (x) { return x.id === id; })[0];
            openMarriageForm(person, state, m, function () { paint(); if (onDone) onDone(); });
          });
        });
      });
      ui.$$('[data-mdel]', host).forEach(function (b) {
        b.addEventListener('click', async function () {
          var yes = await ui.confirmDialog('确认删除这条婚姻记录？', { danger: true, okText: '删除' });
          if (!yes) return;
          await repo.deleteMarriage(b.getAttribute('data-mdel'));
          ui.toast('已删除婚姻记录', 'ok');
          paint();
          if (onDone) onDone();
        });
      });
    }

    paint();
  }

  /** 二级弹层：添加/编辑婚姻 */
  function openMarriageForm(person, state, marriage, onDone) {
    var isEdit = !!marriage;
    var m = Object.assign({
      id: '', husbandId: '', wifeId: '',
      type: S.MARRIAGE_TYPE.MARRY, order: 1, status: S.MARRIAGE_STATUS.CURRENT,
      startYear: '', endYear: '', notes: ''
    }, marriage || {});

    // 已在册的配偶标注出来，避免重复选择（重名/同姓时尤其有用）
    var linked = {};
    state.marriages.forEach(function (mm) {
      if (marriage && mm.id === marriage.id) return;
      if (mm.husbandId === person.id) linked[mm.wifeId] = 1;
      if (mm.wifeId === person.id) linked[mm.husbandId] = 1;
    });

    var candidates = state.persons.filter(function (x) { return x.id !== person.id; });
    var opts = '<option value="">请选择配偶</option>' + candidates.map(function (x) {
      return '<option value="' + ui.esc(x.id) + '">' +
        ui.esc(S.displayName(x)) +
        '（' + (x.gender === S.GENDER.MALE ? '男' : '女') + '） · ' + ui.esc(x.id) +
        (linked[x.id] ? ' · 已有记录' : '') +
        '</option>';
    }).join('');

    var otherId = isEdit ? (m.husbandId === person.id ? m.wifeId : m.husbandId) : '';

    var body = '<div class="form-grid">' +
      field('配偶', '<select class="select" name="spouseId">' + opts + '</select>', true) +
      field('婚姻方式', selectOf('type', [['marry', '嫁娶'], ['ruzhui', '入赘'], ['chuzhui', '出赘']], m.type), true) +
      field('婚姻状态', selectOf('status', [['current', '存续'], ['divorced', '离异'], ['widowed', '丧偶']], m.status)) +
      field('次序 <span class="help">第几任</span>', '<input class="input" type="number" min="1" name="order" value="' + ui.esc(m.order) + '">') +
      field('起始年', '<input class="input" name="startYear" value="' + ui.esc(m.startYear || '') + '">') +
      field('结束年', '<input class="input" name="endYear" value="' + ui.esc(m.endYear || '') + '">') +
      field('备注', '<input class="input" name="notes" value="' + ui.esc(m.notes || '') + '">', false, null, true) +
      '</div><div id="mfmErrors"></div>';

    var mask = ui.openModal({
      title: isEdit ? '编辑婚姻记录' : '添加配偶',
      width: '620px',
      body: body,
      footer: '<div class="spacer"></div><button class="btn" data-close>取消</button>' +
        '<button class="btn btn-primary" id="mfmSave">保存</button>'
    });

    var spSel = mask.querySelector('[name="spouseId"]');
    spSel.value = otherId;

    mask.querySelector('#mfmSave').addEventListener('click', async function () {
      var spouseId = spSel.value;
      var errBox = mask.querySelector('#mfmErrors');
      if (!spouseId) {
        errBox.innerHTML = '<div class="alert alert-error">请选择配偶</div>';
        return;
      }
      var data = {
        id: m.id || '',
        type: mask.querySelector('[name="type"]').value,
        status: mask.querySelector('[name="status"]').value,
        order: mask.querySelector('[name="order"]').value,
        startYear: mask.querySelector('[name="startYear"]').value.trim(),
        endYear: mask.querySelector('[name="endYear"]').value.trim(),
        notes: mask.querySelector('[name="notes"]').value.trim()
      };
      // 按性别归位夫妻
      if (person.gender === S.GENDER.MALE) {
        data.husbandId = person.id;
        data.wifeId = spouseId;
      } else {
        data.husbandId = spouseId;
        data.wifeId = person.id;
      }

      var res = await repo.saveMarriage(data);
      if (!res.ok) {
        errBox.innerHTML = '<div class="alert alert-error"><ul>' +
          res.errors.map(function (e) { return '<li>' + ui.esc(e) + '</li>'; }).join('') + '</ul></div>';
        return;
      }
      ui.closeModal();
      ui.toast(isEdit ? '已更新婚姻记录' : '已添加配偶', 'ok');
      (res.warnings || []).forEach(function (w, i) {
        setTimeout(function () { ui.toast(w, 'warn'); }, 320 * (i + 1));
      });
      if (onDone) onDone();
    });
  }

  views.memberForm = { open: open };
})(window);
