/**
 * 世系计算：建树、路径、称谓推算（挂 window.ZP.lineage）
 *
 * 建树规则（与 docs/data-model.md 一致）：
 *  - 归属父：嗣父 adoptiveFatherId > 生父 fatherId > 生母 motherId（外嫁女子女只挂母）
 *  - 主干仅含本族成员（category=clan）；配偶作为节点的附属展示
 *  - 子节点按 sortKey 排序
 */
(function (global) {
  'use strict';
  var ZP = (global.ZP = global.ZP || {});
  var S = ZP.schema;

  /**
   * 建树时使用的归属父/母 ID
   * 优先级：嗣父 > 生父 > 生母；提供 personMap 时优先落在「本族主干」上的那位，
   * 若首选是配偶（如赘婿、外姓配氏）或无谱籍者，自动退到下一位本族父母，
   * 避免入赘/随母入谱者因断链变成孤根。
   * @param {object} p
   * @param {Map} [personMap] id -> person
   */
  function lineageParentId(p, personMap) {
    var order = [p.adoptiveFatherId, p.fatherId, p.motherId];
    if (!personMap) return order.filter(Boolean)[0] || null;

    var fallback = null;
    for (var i = 0; i < order.length; i++) {
      var id = order[i];
      if (!id) continue;
      var per = personMap.get(id);
      if (!per) continue;
      if (per.category === S.CATEGORY.SPOUSE) {   // 配偶不入主干，留作兜底
        if (!fallback) fallback = id;
        continue;
      }
      return id;
    }
    return fallback;
  }

  /**
   * 构建世系森林
   * @param {Array} persons
   * @param {Array} marriages
   * @returns {Array} roots —— 根节点数组（通常为始祖）
   */
  function buildForest(persons, marriages) {
    var map = new Map();
    persons.forEach(function (p) { map.set(p.id, p); });

    var nodeMap = new Map();
    persons.forEach(function (p) {
      if (p.category === S.CATEGORY.SPOUSE) return; // 配偶不入主干
      nodeMap.set(p.id, { id: p.id, person: p, spouses: [], children: [], parentId: null, generation: Number(p.generation) || 1 });
    });

    // 挂配偶（含多配偶，按 order）
    (marriages || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); })
      .forEach(function (m) {
        var h = nodeMap.get(m.husbandId), w = nodeMap.get(m.wifeId);
        var host = h || w;
        if (!host) return;
        var spousePerson = h ? map.get(m.wifeId) : map.get(m.husbandId);
        if (spousePerson) host.spouses.push({ marriage: m, person: spousePerson });
      });

    // 挂父子关系
    var roots = [];
    nodeMap.forEach(function (node) {
      var pid = lineageParentId(node.person, map);
      var parent = pid ? nodeMap.get(pid) : null;
      if (parent && parent !== node) {
        node.parentId = parent.id;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    // 排序：同级按 sortKey
    function sortRec(nodes) {
      nodes.sort(function (a, b) { return S.compareBySortKey(a.person, b.person); });
      nodes.forEach(function (n) { sortRec(n.children); });
    }
    sortRec(roots);

    return roots;
  }

  /** 前序遍历，返回 [{node, depth, parentId}] */
  function flatten(roots) {
    var out = [];
    (function walk(nodes, depth) {
      nodes.forEach(function (n) {
        out.push({ node: n, depth: depth, parentId: n.parentId });
        walk(n.children, depth + 1);
      });
    })(roots, 0);
    return out;
  }

  /** 从 personId 回溯到根的 id 路径（含自身，从根到自身） */
  function pathToRoot(personId, personMap) {
    var path = [];
    var cur = personId;
    var guard = 0;
    while (cur && guard++ < 500) {
      path.unshift(cur);
      var p = personMap.get(cur);
      if (!p) break;
      cur = lineageParentId(p, personMap);
    }
    return path;
  }

  /** 祖先链（含自身）id 集合 */
  function ancestorChain(personId, personMap) {
    var chain = [];
    var cur = personId;
    var guard = 0;
    while (cur && guard++ < 500) {
      chain.push(cur);
      var p = personMap.get(cur);
      if (!p) break;
      cur = lineageParentId(p, personMap);
    }
    return chain;
  }

  /**
   * 称谓推算（基础版）
   * 两人各上行至最近共同祖先，按代数差 + 旁系程度推导。
   * @returns {string|null} 如「堂兄」「伯父」「侄孙」；无法判定返回描述性兜底
   */
  function kinship(aId, bId, personMap) {
    if (!aId || !bId) return null;
    if (aId === bId) return '本人';
    var a = personMap.get(aId), b = personMap.get(bId);
    if (!a || !b) return null;

    var chainA = ancestorChain(aId, personMap);
    var setA = new Set(chainA);
    var chainB = ancestorChain(bId, personMap);

    var lca = null;
    for (var i = 0; i < chainB.length; i++) {
      if (setA.has(chainB[i])) { lca = chainB[i]; break; }
    }
    if (!lca) return '无共同先祖（不同支系）';

    var da = chainA.indexOf(lca);       // a 到共同祖先的代数
    var db = chainB.indexOf(lca);
    var male = b.gender === S.GENDER.MALE;

    // 同一人 / 直系
    if (da === 0) { // a 是 b 的祖先
      return bIsDescendant(db, male); // db 代晚辈
    }
    if (db === 0) { // b 是 a 的祖先
      return bIsAncestor(da, male);
    }

    if (db < da) { // b 是 a 的长辈
      var up = da - db;
      if (db === 1) return up === 1 ? (male ? '伯父/叔父' : '姑母') : (male ? '伯祖父/叔祖父' : '姑祖母');
      return up === 1 ? '族中长辈' : '族中长辈（远支）';
    }
    if (db > da) { // b 是 a 的晚辈
      var down = db - da;
      if (da === 1) return down === 1 ? (male ? '侄' : '侄女') : (male ? '侄孙' : '侄孙女');
      return down === 1 ? (male ? '堂侄' : '堂侄女') : (male ? '族孙' : '族孙女');
    }

    // 同辈
    if (da === 1) return siblingTerm(a, b, male);
    if (da === 2) return male ? '堂兄弟' : '堂姐妹';
    if (da === 3) return male ? '从堂兄弟' : '从堂姐妹';
    return male ? '族兄弟' : '族姐妹';

    function bIsDescendant(n, isMale) {
      if (n === 1) return isMale ? '子' : '女';
      if (n === 2) return isMale ? '孙' : '孙女';
      if (n === 3) return isMale ? '曾孙' : '曾孙女';
      if (n === 4) return isMale ? '玄孙' : '玄孙女';
      return (isMale ? '来孙' : '来孙女') + '（' + n + '代后）';
    }
    function bIsAncestor(n, isMale) {
      if (n === 1) return isMale ? '父' : '母';
      if (n === 2) return isMale ? '祖父' : '祖母';
      if (n === 3) return isMale ? '曾祖父' : '曾祖母';
      if (n === 4) return isMale ? '高祖父' : '高祖母';
      return (isMale ? '先祖' : '先祖') + '（上溯 ' + n + ' 代）';
    }
  }

  /** 同辈：按出生年/排行判断兄/弟/姐/妹 */
  function siblingTerm(a, b, bMale) {
    var older = compareAge(a, b) <= 0; // a 更年长
    if (bMale) return older ? '弟' : '兄';
    return older ? '妹' : '姐';
  }

  /** a 是否年长于 b：先比出生年，再比排行 */
  function compareAge(a, b) {
    var ya = parseInt(a.birthDate, 10), yb = parseInt(b.birthDate, 10);
    if (!isNaN(ya) && !isNaN(yb) && ya !== yb) return ya - yb;
    var oa = a.birthOrder == null ? 99 : a.birthOrder;
    var ob = b.birthOrder == null ? 99 : b.birthOrder;
    return oa - ob;
  }

  ZP.lineage = {
    lineageParentId: lineageParentId,
    buildForest: buildForest,
    flatten: flatten,
    pathToRoot: pathToRoot,
    ancestorChain: ancestorChain,
    kinship: kinship,
    compareAge: compareAge
  };
})(window);
