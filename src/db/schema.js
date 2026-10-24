/**
 * 族谱管理系统 · 数据模型定义
 * 定稿 v1.0 — 2026-09-17    详见 docs/data-model.md
 *
 * 五实体：persons / marriages / branches / photos / meta
 * 设计要点：
 *  - 血亲(fatherId/motherId) 与 嗣亲(adoptiveFatherId/adoptiveMotherId) 分离
 *  - 婚姻独立成表，支撑多配偶与 入赘/出赘
 *  - generation(世次·数字) 与 generationName(字辈·字) 分离
 *  - sortKey 预计算，千级节点排序 O(1)
 *
 * 形态：普通 script（挂 window.ZP），兼容 file:// 双击打开，无任何外部依赖。
 */
(function (global) {
  'use strict';
  var ZP = (global.ZP = global.ZP || {});

  var DB_NAME = 'zupu-db';
  var DB_VERSION = 1;

  /**
   * 原生 IndexedDB objectStore 定义
   * keyPath 为主键；indexes 为二级索引。字段为空(null/undefined)的记录不进入该索引。
   */
  var STORE_DEFS = {
    persons: {
      keyPath: 'id',
      indexes: [
        { name: 'surname', keyPath: 'surname' },
        { name: 'name', keyPath: 'name' },
        { name: 'namePinyin', keyPath: 'namePinyin' },
        { name: 'gender', keyPath: 'gender' },
        { name: 'category', keyPath: 'category' },
        { name: 'lineageType', keyPath: 'lineageType' },
        { name: 'generation', keyPath: 'generation' },
        { name: 'branchId', keyPath: 'branchId' },
        { name: 'fatherId', keyPath: 'fatherId' },
        { name: 'motherId', keyPath: 'motherId' },
        { name: 'adoptiveFatherId', keyPath: 'adoptiveFatherId' },
        { name: 'sortKey', keyPath: 'sortKey' }
      ]
    },
    marriages: {
      keyPath: 'id',
      indexes: [
        { name: 'husbandId', keyPath: 'husbandId' },
        { name: 'wifeId', keyPath: 'wifeId' },
        { name: 'type', keyPath: 'type' },
        { name: 'status', keyPath: 'status' }
      ]
    },
    branches: {
      keyPath: 'id',
      indexes: [
        { name: 'parentBranchId', keyPath: 'parentBranchId' },
        { name: 'sortOrder', keyPath: 'sortOrder' }
      ]
    },
    photos: {
      keyPath: 'id',
      indexes: [{ name: 'personId', keyPath: 'personId' }]
    },
    meta: { keyPath: 'key', indexes: [] }
  };

  /** 成员分类 */
  var CATEGORY = { CLAN: 'clan', SPOUSE: 'spouse' };

  /** 谱系归属 */
  var LINEAGE = { CLAN: 'clan', OUT_MARRIED: 'outMarried', EXTERNAL: 'external' };

  /** 婚姻方式 */
  var MARRIAGE_TYPE = { MARRY: 'marry', RUZHUI: 'ruzhui', CHUZHUI: 'chuzhui' };

  /** 婚姻状态 */
  var MARRIAGE_STATUS = { CURRENT: 'current', DIVORCED: 'divorced', WIDOWED: 'widowed' };

  /** 性别 */
  var GENDER = { MALE: 'M', FEMALE: 'F' };

  /** 枚举中文label，供 UI 下拉与列表展示 */
  var LABELS = {
    category: { clan: '本族', spouse: '配偶' },
    lineageType: { clan: '本宗', outMarried: '外嫁女', external: '外系' },
    marriageType: { marry: '嫁娶', ruzhui: '入赘', chuzhui: '出赘' },
    marriageStatus: { current: '存续', divorced: '离异', widowed: '丧偶' },
    gender: { M: '男', F: '女' }
  };

  /**
   * 房支段排序键：字母前缀 + 数字补零到 4 位
   * 直接 padStart 会把 'B9' 变成 '0B9'（排到最前）、且 'B01' 与 'B001' 视为两支，
   * 这里先拆出数字再补零，保证 B9 < B10、B01 与 B001 归一。
   */
  function branchSegment(branchId) {
    var s = String(branchId == null || branchId === '' ? 'B00' : branchId).trim();
    var m = /^([A-Za-z]*)(\d+)$/.exec(s);
    if (m) return (m[1] || 'B') + m[2].padStart(4, '0');
    return s.padStart(5, '0');   // 非「字母+数字」编号：整体右对齐，至少保证稳定
  }

  /**
   * 预计算排序键：房支 > 世次 > [本族|配偶] > 排行
   * 同世次内本族在前、配偶在后（配偶 birthOrder 兼作婚姻次序）
   * 例 B0001-G003-0002（本族行3排行2）、B0001-G002-9001（配偶第1任）
   */
  function buildSortKey(person) {
    var branch = branchSegment(person.branchId);
    var gen = String(Number(person.generation || 99)).padStart(3, '0');
    var catRank = person.category === CATEGORY.SPOUSE ? '9' : '0';
    var order = String(Number(person.birthOrder == null ? 99 : person.birthOrder)).padStart(3, '0');
    return branch + '-G' + gen + '-' + catRank + order;
  }

  /** sortKey 升序比较器（Array.sort 用） */
  function compareBySortKey(a, b) {
    return String(a.sortKey || '').localeCompare(String(b.sortKey || ''));
  }

  /**
   * 展示名（派生）：
   *  - 配偶 → 姓 + 氏 + 名，如「李氏秀英」
   *  - 外系成员（随母姓等）→ 姓 + 名，如「陈明」（保留姓避免歧义）
   *  - 本族 → 名
   */
  function displayName(person) {
    if (!person) return '';
    if (person.category === CATEGORY.SPOUSE && person.surname) {
      return person.surname + '氏' + (person.name || '');
    }
    if (person.lineageType === LINEAGE.EXTERNAL && person.surname) {
      return person.surname + (person.name || '');
    }
    return person.name || '';
  }

  /** 谱中关系标注，如「配李氏秀英」 */
  function spouseLabel(person) {
    return '配' + displayName(person);
  }

  /**
   * 血亲备注：有嗣父时标注本生父（由 fatherId 派生，不落库）
   */
  function bloodRemark(person, personMap) {
    if (!person || !person.adoptiveFatherId) return '';
    var bio = personMap && personMap.get ? personMap.get(person.fatherId) : null;
    return bio ? '本生父：' + bio.name : '';
  }

  /**
   * 防循环：判断 candidateId 是否可能是 targetId 的祖先
   * 沿 父/母/嗣父/嗣母 四条边回溯
   */
  function isAncestor(candidateId, targetId, personMap) {
    if (!candidateId || !targetId) return false;
    var seen = new Set();
    var stack = [targetId];
    while (stack.length) {
      var cur = stack.pop();
      if (cur === candidateId) return true;
      if (seen.has(cur)) continue;
      seen.add(cur);
      var p = personMap.get(cur);
      if (!p) continue;
      [p.fatherId, p.motherId, p.adoptiveFatherId, p.adoptiveMotherId]
        .filter(Boolean)
        .forEach(function (pid) { stack.push(pid); });
    }
    return false;
  }

  /**
   * 生成下一个人物 ID：房支-世次-序号，例 B01-G03-002
   * 序号在同 房支+世次 内递增
   */
  function nextPersonId(branchId, generation, persons) {
    var b = branchId || 'B01';
    var g = Number(generation || 1);
    var prefix = b + '-G' + String(g).padStart(2, '0') + '-';
    var max = 0;
    (persons || []).forEach(function (p) {
      if (p.id && p.id.indexOf(prefix) === 0) {
        var n = parseInt(p.id.slice(prefix.length), 10);
        if (!isNaN(n) && n > max) max = n;
      }
    });
    return prefix + String(max + 1).padStart(3, '0');
  }

  /** 配偶分组键：同一人的多任配偶归入一组（用于列表展示） */
  function spouseKeyOf(person) {
    return person && person.category === CATEGORY.SPOUSE ? (person.branchId || '') + '#' + (person.generation || '') : null;
  }

  ZP.schema = {
    DB_NAME: DB_NAME,
    DB_VERSION: DB_VERSION,
    STORE_DEFS: STORE_DEFS,
    CATEGORY: CATEGORY,
    LINEAGE: LINEAGE,
    MARRIAGE_TYPE: MARRIAGE_TYPE,
    MARRIAGE_STATUS: MARRIAGE_STATUS,
    GENDER: GENDER,
    LABELS: LABELS,
    buildSortKey: buildSortKey,
    compareBySortKey: compareBySortKey,
    displayName: displayName,
    spouseLabel: spouseLabel,
    bloodRemark: bloodRemark,
    isAncestor: isAncestor,
    nextPersonId: nextPersonId,
    spouseKeyOf: spouseKeyOf
  };
})(window);
