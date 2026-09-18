/**
 * 仓储层：业务读写 + 校验（零依赖，挂 window.ZP.repo）
 * 上接 idb.js（存储），下对 UI 提供语义化接口。
 */
(function (global) {
  'use strict';
  var ZP = (global.ZP = global.ZP || {});
  var S = ZP.schema;
  var idb = ZP.idb;

  /* ───────────────────────── 初始化 ───────────────────────── */

  /** 打开数据库；若 persons 为空则载入示例种子数据 */
  async function init() {
    await idb.open();
    var n = await idb.count('persons');
    if (n === 0 && ZP.SEED) {
      await idb.bulkPut('persons', ZP.SEED.persons);
      await idb.bulkPut('marriages', ZP.SEED.marriages);
      await idb.bulkPut('branches', ZP.SEED.branches);
      await idb.bulkPut('meta', ZP.SEED.meta);
    }
  }

  /** 清空并重新载入示例数据 */
  async function resetToSeed() {
    await idb.clearAll();
    await idb.clear('meta');
    if (ZP.SEED) {
      await idb.bulkPut('persons', ZP.SEED.persons);
      await idb.bulkPut('marriages', ZP.SEED.marriages);
      await idb.bulkPut('branches', ZP.SEED.branches);
      await idb.bulkPut('meta', ZP.SEED.meta);
    }
  }

  /* ───────────────────────── 查询 ───────────────────────── */

  /** 全部成员，按 sortKey（房支>世次>本族/配偶>排行）升序；运行时重算键以兼容历史数据格式 */
  async function listPersons() {
    var all = await idb.getAll('persons');
    return all.sort(function (a, b) {
      return S.buildSortKey(a).localeCompare(S.buildSortKey(b));
    });
  }

  function getPerson(id) { return idb.get('persons', id); }

  /** 构建 id -> person 映射（校验与派生算常用） */
  async function personMap() {
    var all = await idb.getAll('persons');
    var m = new Map();
    all.forEach(function (p) { m.set(p.id, p); });
    return m;
  }

  function listBranches() {
    return idb.getAll('branches').then(function (arr) {
      return arr.sort(function (a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });
    });
  }

  function listMarriages() { return idb.getAll('marriages'); }

  /** 某人的全部婚姻（按 order 排序） */
  async function marriagesOf(personId) {
    var arr = await idb.getAll('marriages');
    return arr
      .filter(function (m) { return m.husbandId === personId || m.wifeId === personId; })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  }

  /** 某人的配偶（Person 数组，按 order） */
  async function spousesOf(personId, map) {
    var ms = await marriagesOf(personId);
    var m = map || (await personMap());
    return ms.map(function (x) {
      var sid = x.husbandId === personId ? x.wifeId : x.husbandId;
      return { marriage: x, person: m.get(sid) };
    }).filter(function (o) { return !!o.person; });
  }

  /** 某人的子女（含血亲与嗣亲，去重） */
  async function childrenOf(personId) {
    var all = await idb.getAll('persons');
    return all.filter(function (p) {
      return p.fatherId === personId || p.motherId === personId ||
             p.adoptiveFatherId === personId || p.adoptiveMotherId === personId;
    }).sort(S.compareBySortKey);
  }

  function getMeta(key) {
    return idb.get('meta', key).then(function (r) { return r ? r.value : null; });
  }

  function getAllMeta() {
    return idb.getAll('meta').then(function (arr) {
      var o = {};
      arr.forEach(function (r) { o[r.key] = r.value; });
      return o;
    });
  }

  function setMeta(key, value) { return idb.put('meta', { key: key, value: value }); }

  async function stats() {
    var persons = await idb.getAll('persons');
    var marriages = await idb.getAll('marriages');
    var branches = await idb.getAll('branches');
    var gens = persons.map(function (p) { return Number(p.generation) || 0; });
    return {
      persons: persons.length,
      marriages: marriages.length,
      branches: branches.length,
      clan: persons.filter(function (p) { return p.category === S.CATEGORY.CLAN; }).length,
      spouse: persons.filter(function (p) { return p.category === S.CATEGORY.SPOUSE; }).length,
      minGeneration: gens.length ? Math.min.apply(null, gens.filter(Boolean)) : 0,
      maxGeneration: gens.length ? Math.max.apply(null, gens) : 0
    };
  }

  /* ───────────────────────── 校验 ───────────────────────── */

  /** 年份解析：取文本中的 3–4 位数字，无法识别返回 null（支持「1932」「1932-05」「1932.5」） */
  function parseYear(s) {
    var m = /(\d{3,4})/.exec(String(s == null ? '' : s));
    return m ? Number(m[1]) : null;
  }

  /** 父母/嗣父母四路的元信息：字段名 · 中文名 · 期望性别 · 性别中文 */
  var PARENT_REFS = [
    ['fatherId', '生父', S.GENDER.MALE, '男'],
    ['motherId', '生母', S.GENDER.FEMALE, '女'],
    ['adoptiveFatherId', '嗣父', S.GENDER.MALE, '男'],
    ['adoptiveMotherId', '嗣母', S.GENDER.FEMALE, '女']
  ];

  /**
   * 汇总校验问题（字段级，供表单实时提示与提交拦截共用）
   * @returns {Array<{field:string, level:'error'|'warn', msg:string}>}
   */
  function collectIssues(p, map, isNew) {
    var issues = [];
    function err(field, msg) { issues.push({ field: field, level: 'error', msg: msg }); }
    function warn(field, msg) { issues.push({ field: field, level: 'warn', msg: msg }); }

    /* ── 必填 ── */
    if (!p.surname || !String(p.surname).trim()) err('surname', '姓氏不能为空');
    if (!p.name || !String(p.name).trim()) err('name', '名字不能为空');
    if (p.gender !== S.GENDER.MALE && p.gender !== S.GENDER.FEMALE) err('gender', '请选择性别');
    if (p.category !== S.CATEGORY.CLAN && p.category !== S.CATEGORY.SPOUSE) err('category', '请选择成员分类');

    var gen = Number(p.generation);
    if (!gen || gen < 1 || gen % 1 !== 0) err('generation', '世次必须为不小于 1 的整数');

    /* ── ID：非空 + 唯一 + 推荐格式 ── */
    var pid = String(p.id || '').trim();
    if (!pid) err('id', '成员 ID 不能为空');
    else {
      if (isNew && map && map.has(pid)) err('id', 'ID「' + pid + '」已存在，请更换');
      if (!/^[A-Za-z0-9]+-G\d{2,}-\d{3,}$/.test(pid)) {
        warn('id', 'ID 建议采用「房支-G世次-序号」格式（如 B01-G03-002），否则新增时序号可能重号');
      }
    }

    /* ── 自指与成环（错误级，阻断） ── */
    PARENT_REFS.forEach(function (ref) {
      var key = ref[0], label = ref[1], rid = p[key];
      if (!rid) return;
      if (rid === pid) err(key, '不能把自己设为' + label);
      else if (map && S.isAncestor(pid, rid, map)) {
        err(key, '关系成环：「' + rid + '」是本人的后代，不能作为' + label);
      }
    });

    /* ── 生父与嗣父重复（提醒级） ── */
    if (p.fatherId && p.adoptiveFatherId && p.fatherId === p.adoptiveFatherId) {
      warn('adoptiveFatherId', '嗣父与生父为同一人，若无过继关系建议留空');
    }

    if (map) {
      PARENT_REFS.forEach(function (ref) {
        var key = ref[0], label = ref[1], rid = p[key];
        if (!rid) return;
        var per = map.get(rid);
        if (!per) return;

        // 父母性别
        if (per.gender && per.gender !== ref[2]) {
          warn(key, label + '「' + (per.name || rid) + '」性别为' +
            (per.gender === S.GENDER.MALE ? '男' : '女') + '，与「' + ref[3] + '」不符');
        }
        // 世次一致（提醒级）
        if (Number(per.generation) && Number(per.generation) + 1 !== gen) {
          warn(key, label + '「' + (per.name || rid) + '」为第 ' + per.generation +
            ' 世，按规则本人应为第 ' + (Number(per.generation) + 1) + ' 世');
        }
      });
    }

    /* ── 谱系归属 ── */
    if (p.lineageType === S.LINEAGE.OUT_MARRIED && p.gender === S.GENDER.MALE) {
      warn('lineageType', '「外嫁女」通常为女性，请确认归属是否填错');
    }

    /* ── 生卒 ── */
    var by = parseYear(p.birthDate), dy = parseYear(p.deathDate);
    if (by === null && p.birthDate && String(p.birthDate).trim()) {
      warn('birthDate', '出生年份无法识别，建议形如「1932」或「1932-05」');
    }
    if (dy === null && p.deathDate && String(p.deathDate).trim()) {
      warn('deathDate', '去世年份无法识别，建议形如「1965」或「1965-03」');
    }
    if (by !== null && dy !== null && dy < by) {
      warn('deathDate', '去世年（' + dy + '）早于出生年（' + by + '），请核对');
    }

    return issues;
  }

  /**
   * 校验成员数据
   * @param {object} p  待保存的成员
   * @param {Map} map   id->person 映射（更新场景请先删去自身旧记录）
   * @param {boolean} isNew
   * @returns {{errors:string[], warnings:string[], issues:Array}}
   */
  function validatePerson(p, map, isNew) {
    var issues = collectIssues(p, map, isNew);
    return {
      errors: issues.filter(function (i) { return i.level === 'error'; }).map(function (i) { return i.msg; }),
      warnings: issues.filter(function (i) { return i.level === 'warn'; }).map(function (i) { return i.msg; }),
      issues: issues
    };
  }

  /* ───────────────────────── 写入 ───────────────────────── */

  /**
   * 新增或更新成员。返回 {ok, errors, warnings, person}
   * 校验不通过则不落库。
   */
  async function savePerson(person, isNew) {
    var map = await personMap();
    if (!isNew) map.delete(person.id); // 更新时排除自身旧记录（防自环误判）
    var v = validatePerson(person, map, !!isNew);
    if (v.errors.length) return { ok: false, errors: v.errors, warnings: v.warnings };

    var now = Date.now();
    var record = Object.assign({}, person);
    record.generation = Number(record.generation);
    record.birthOrder = record.birthOrder == null || record.birthOrder === ''
      ? null : Number(record.birthOrder);
    record.sortKey = S.buildSortKey(record);
    record.updatedAt = now;
    if (isNew) record.createdAt = now;

    // null 归一化，避免空字符串进索引
    ['fatherId', 'motherId', 'adoptiveFatherId', 'adoptiveMotherId', 'portraitId']
      .forEach(function (k) { if (!record[k]) record[k] = null; });

    await idb.put('persons', record);
    return { ok: true, errors: [], warnings: v.warnings, person: record };
  }

  /**
   * 删除成员。存在引用（子女 / 婚姻）时拒绝，返回原因。
   */
  async function deletePerson(id) {
    var blocked = [];

    var all = await idb.getAll('persons');
    var asParent = all.filter(function (p) {
      return p.id !== id && (p.fatherId === id || p.motherId === id ||
        p.adoptiveFatherId === id || p.adoptiveMotherId === id);
    });
    if (asParent.length) {
      blocked.push('有 ' + asParent.length + ' 名成员以他为父母/嗣父母（如：' +
        asParent.slice(0, 3).map(function (p) { return p.name; }).join('、') + '）');
    }

    var ms = await idb.getAll('marriages');
    var rel = ms.filter(function (m) { return m.husbandId === id || m.wifeId === id; });
    if (rel.length) blocked.push('存在 ' + rel.length + ' 条婚姻记录');

    if (blocked.length) return { ok: false, errors: blocked };

    await idb.del('persons', id);
    return { ok: true, errors: [] };
  }

  /**
   * 新增/更新婚姻
   * 校验：双方必选且存在 · 不可同一人 · 无序对不可重复（错误级）；
   *       性别常规 · 年份倒置（提醒级）
   */
  async function saveMarriage(m) {
    var errors = [];
    var warnings = [];

    if (!m.husbandId || !m.wifeId) errors.push('夫妻双方都必须选择');
    if (m.husbandId && m.husbandId === m.wifeId) errors.push('夫妻不能是同一人');
    if (!m.type) errors.push('请选择婚姻方式');

    var map = await personMap();
    var h = m.husbandId ? map.get(m.husbandId) : null;
    var w = m.wifeId ? map.get(m.wifeId) : null;
    if (m.husbandId && !h) errors.push('夫方成员不存在（' + m.husbandId + '）');
    if (m.wifeId && !w) errors.push('妻方成员不存在（' + m.wifeId + '）');

    if (!errors.length) {
      var all = await idb.getAll('marriages');
      var dup = all.filter(function (x) {
        if (x.id === m.id) return false;
        return (x.husbandId === m.husbandId && x.wifeId === m.wifeId) ||
               (x.husbandId === m.wifeId && x.wifeId === m.husbandId);   // 无序对，避免换序重录
      });
      if (dup.length) errors.push('这对夫妻的婚姻记录已存在');
    }

    if (!errors.length) {
      if (h.gender === S.GENDER.FEMALE || w.gender === S.GENDER.MALE) {
        warnings.push('双方性别为 夫·' + (h.gender === S.GENDER.MALE ? '男' : '女') +
          '／妻·' + (w.gender === S.GENDER.MALE ? '男' : '女') + '，与「夫男妻女」不符，请确认');
      }
      var sy = parseYear(m.startYear), ey = parseYear(m.endYear);
      if (sy !== null && ey !== null && ey < sy) {
        warnings.push('结束年（' + ey + '）早于起始年（' + sy + '），请核对');
      }
      if (ey === null && m.endYear && String(m.endYear).trim()) {
        warnings.push('结束年无法识别，建议形如「1965」');
      }
      var bh = parseYear(h.birthDate), bw = parseYear(w.birthDate);
      if (sy !== null) {
        if (bh !== null && sy < bh) warnings.push('起始年（' + sy + '）早于夫方出生年（' + bh + '），请核对');
        else if (bw !== null && sy < bw) warnings.push('起始年（' + sy + '）早于妻方出生年（' + bw + '），请核对');
      }
    }

    if (errors.length) return { ok: false, errors: errors, warnings: warnings };

    var record = Object.assign({}, m);
    if (!record.id) record.id = 'M-' + Date.now();
    record.order = Number(record.order) || 1;
    await idb.put('marriages', record);
    return { ok: true, errors: [], warnings: warnings, marriage: record };
  }

  function deleteMarriage(id) { return idb.del('marriages', id); }

  async function saveBranch(b) {
    var record = Object.assign({}, b);
    if (!record.id) record.id = 'B' + String(Date.now()).slice(-4);
    record.sortOrder = Number(record.sortOrder) || 1;
    await idb.put('branches', record);
    return record;
  }

  function deleteBranch(id) { return idb.del('branches', id); }

  /* ───────────────────────── 备份 / 恢复 ───────────────────────── */

  async function exportJSON() {
    var data = {
      _meta: { app: 'zupu-system', version: S.DB_VERSION, exportedAt: new Date().toISOString() },
      persons: await idb.getAll('persons'),
      marriages: await idb.getAll('marriages'),
      branches: await idb.getAll('branches'),
      meta: await idb.getAll('meta')
    };
    return JSON.stringify(data, null, 2);
  }

  /** 导入 JSON 覆盖现有数据 */
  async function importJSON(text) {
    var data = JSON.parse(text);
    if (!data || !Array.isArray(data.persons)) throw new Error('文件格式不正确：缺少 persons 数组');
    await idb.clearAll();
    await idb.clear('meta');
    await idb.bulkPut('persons', data.persons || []);
    await idb.bulkPut('marriages', data.marriages || []);
    await idb.bulkPut('branches', data.branches || []);
    await idb.bulkPut('meta', data.meta || []);
    return {
      persons: (data.persons || []).length,
      marriages: (data.marriages || []).length
    };
  }

  ZP.repo = {
    init: init,
    resetToSeed: resetToSeed,
    listPersons: listPersons,
    getPerson: getPerson,
    personMap: personMap,
    listBranches: listBranches,
    listMarriages: listMarriages,
    marriagesOf: marriagesOf,
    spousesOf: spousesOf,
    childrenOf: childrenOf,
    getMeta: getMeta,
    getAllMeta: getAllMeta,
    setMeta: setMeta,
    stats: stats,
    validatePerson: validatePerson,
    savePerson: savePerson,
    deletePerson: deletePerson,
    saveMarriage: saveMarriage,
    deleteMarriage: deleteMarriage,
    saveBranch: saveBranch,
    deleteBranch: deleteBranch,
    exportJSON: exportJSON,
    importJSON: importJSON
  };
})(window);
