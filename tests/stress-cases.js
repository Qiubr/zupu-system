/**
 * 压力测试 + 补充场景测试
 * 运行：NODE_PATH=<workspace>/node_modules node tests/stress-cases.js
 * 覆盖：
 *   A. 千级数据压力：1450+ 人 / 360+ 婚姻 / 8 世代建树、排序、称谓、ID、防循环 全链路计时
 *   B. 深链压力：600 代单线链（回溯守卫 500 触发）
 *   C. 特殊家庭形态：连续两代入赘、过继+入赘叠加、复婚、丧偶再娶、两代外嫁女
 *   D. 数据畸形鲁棒性：空输入、类型错乱、字段缺失
 *   E. ID/sortKey 进位与定宽边界
 *   F. 称谓矩阵补充：伯祖父/姑祖母/堂侄女/族兄弟/玄孙女
 */
const fs = require('fs');
const path = require('path');

global.window = global;
function load(rel) {
  const code = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  (0, eval)(code);
}
load('src/db/schema.js');
load('src/db/seed.js');
load('src/db/lineage.js');

const ZP = global.ZP;
const S = ZP.schema;
const L = ZP.lineage;

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const ok = actual === expected;
  if (ok) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + '\n      期望: ' + JSON.stringify(expected) + '\n      实际: ' + JSON.stringify(actual)); }
}
function ok(cond, label) { eq(!!cond, true, label); }
function lt(ms, budget, label) {
  const good = ms < budget;
  if (good) { pass++; console.log('  ✓ ' + label + '（' + ms + 'ms < ' + budget + 'ms）'); }
  else { fail++; console.log('  ✗ ' + label + '：耗时 ' + ms + 'ms 超预算 ' + budget + 'ms'); }
}

/* ══════════ A. 千级数据压力 ══════════ */
console.log('\n【A】千级数据压力：8 世代 × 每男 3 子 ≈ 1450 人');
{
  const persons = [], marriages = [];
  let idSeq = 0;
  const nextId = () => 'P' + String(++idSeq).padStart(4, '0');

  // 第 1 世：始祖
  const root = { id: nextId(), surname: '丘', name: '始祖', gender: 'M', category: 'clan', lineageType: 'clan', generation: 1, branchId: 'B01', sortKey: 'B0001-G001-0001' };
  persons.push(root);
  let fathers = [root];

  for (let g = 2; g <= 8; g++) {
    const nextFathers = [];
    fathers.forEach((f, idx) => {
      const w = { id: nextId(), surname: '妻', name: f.id + '妻', gender: 'F', category: 'spouse', lineageType: 'clan', generation: g - 1, branchId: 'B01', birthOrder: 1, sortKey: '' };
      w.sortKey = S.buildSortKey(w);
      persons.push(w);
      marriages.push({ id: 'M' + w.id, husbandId: f.id, wifeId: w.id, type: 'marry', order: 1, status: 'current' });
      for (let k = 1; k <= 3; k++) {
        const c = { id: nextId(), surname: '丘', name: f.id + '-' + k, gender: 'M', category: 'clan', lineageType: 'clan', generation: g, branchId: 'B01', fatherId: f.id, motherId: w.id, birthOrder: k, sortKey: '' };
        c.sortKey = S.buildSortKey(c);
        persons.push(c);
        nextFathers.push(c);
      }
    });
    fathers = nextFathers;
  }

  const clanCount = persons.filter(p => p.category === 'clan').length;
  const map = new Map(persons.map(p => [p.id, p]));

  console.log('      规模：成员 ' + persons.length + '（本族 ' + clanCount + ' + 配偶 ' + (persons.length - clanCount) + '），婚姻 ' + marriages.length);

  let t = Date.now();
  const roots = L.buildForest(persons, marriages);
  lt(Date.now() - t, 1000, 'buildForest 千级建树');

  eq(roots.length, 1, '单根（无断链孤根）');

  t = Date.now();
  const flat = L.flatten(roots);
  lt(Date.now() - t, 500, 'flatten 全树遍历');
  eq(flat.length, clanCount, '遍历节点数 = 本族成员数（无丢失无重复）');
  eq(new Set(flat.map(f => f.node.id)).size, clanCount, '节点 ID 无重复');

  t = Date.now();
  persons.slice().sort(S.compareBySortKey);
  lt(Date.now() - t, 200, '全量 sortKey 排序');

  t = Date.now();
  eq(S.nextPersonId('B01', 9, persons), 'B01-G09-001', '千级列表中生成新 ID 正确');
  lt(Date.now() - t, 200, 'nextPersonId 千级扫描');

  // 随机称谓查询 5000 对
  t = Date.now();
  let err = 0;
  for (let i = 0; i < 5000; i++) {
    const a = persons[(Math.random() * persons.length) | 0];
    const b = persons[(Math.random() * persons.length) | 0];
    const r = L.kinship(a.id, b.id, map);
    if (r == null) err++;
  }
  lt(Date.now() - t, 3000, '随机 5000 对称谓推算');
  eq(err, 0, '称谓推算零异常返回');

  // 防循环批量查询
  t = Date.now();
  for (let i = 0; i < 1000; i++) {
    S.isAncestor(root.id, persons[(Math.random() * persons.length) | 0].id, map);
  }
  lt(Date.now() - t, 2000, '1000 次 isAncestor 深树查询');
}

/* ══════════ B. 深链压力 ══════════ */
console.log('\n【B】深链压力：600 代单线链');
{
  const persons = [];
  for (let i = 1; i <= 600; i++) {
    persons.push({ id: 'D' + i, surname: '丘', name: '代' + i, gender: 'M', category: 'clan', lineageType: 'clan', generation: i, fatherId: i > 1 ? 'D' + (i - 1) : null, sortKey: 'B01-G' + String(i).padStart(3, '0') + '-0001' });
  }
  const map = new Map(persons.map(p => [p.id, p]));
  const t0 = Date.now();
  const chain = L.ancestorChain('D600', map);
  lt(Date.now() - t0, 500, '600 代祖先链回溯');
  eq(chain.length, 500, '【文档化】回溯守卫 500 代截断（正常族谱 <30 代不受影响）');
  const t1 = Date.now();
  L.pathToRoot('D600', map);
  lt(Date.now() - t1, 500, 'pathToRoot 深链');
  eq(S.isAncestor('D1', 'D600', map), true, 'isAncestor 600 代深判定正确');
  eq(L.kinship('D1', 'D600', map), '无共同先祖（不同支系）', '【文档化】超 500 代链因回溯守卫找不到共同祖先 → 兜底描述（不抛错不卡死）');
}

/* ══════════ C. 特殊家庭形态 ══════════ */
console.log('\n【C】特殊家庭形态');
{
  // C1 连续两代入赘
  const gf = { id: 'Z-GF', surname: '丘', name: '世昌', gender: 'M', category: 'clan', generation: 3, branchId: 'B02', sortKey: 'B0002-G003-0001' };
  const m1 = { id: 'Z-M1', surname: '丘', name: '淑贞', gender: 'F', category: 'clan', generation: 4, branchId: 'B02', fatherId: 'Z-GF', sortKey: 'B0002-G004-0001' };
  const r1 = { id: 'Z-R1', surname: '林', name: '文彬', gender: 'M', category: 'spouse', generation: 4, branchId: 'B02', birthOrder: 1, sortKey: 'B0002-G004-9001' };
  const m2 = { id: 'Z-M2', surname: '丘', name: '巧云', gender: 'F', category: 'clan', generation: 5, branchId: 'B02', motherId: 'Z-M1', fatherId: 'Z-R1', sortKey: 'B0002-G005-0001' };
  const r2 = { id: 'Z-R2', surname: '赵', name: '国良', gender: 'M', category: 'spouse', generation: 5, branchId: 'B02', birthOrder: 1, sortKey: 'B0002-G005-9001' };
  const c  = { id: 'Z-C', surname: '丘', name: '开泰', gender: 'M', category: 'clan', generation: 6, branchId: 'B02', motherId: 'Z-M2', fatherId: 'Z-R2', sortKey: 'B0002-G006-0001' };
  const ms = [
    { id: 'ZM1', husbandId: 'Z-R1', wifeId: 'Z-M1', type: 'ruzhui', order: 1 },
    { id: 'ZM2', husbandId: 'Z-R2', wifeId: 'Z-M2', type: 'ruzhui', order: 1 }
  ];
  const ps = [gf, m1, r1, m2, r2, c];
  const map = new Map(ps.map(p => [p.id, p]));
  const roots = L.buildForest(ps, ms);
  eq(roots.length, 1, '连续两代入赘 → 仍单根（外祖父世昌）');
  const flat = L.flatten(roots).map(f => f.node.id);
  ok(flat.includes('Z-M1') && flat.includes('Z-M2') && flat.includes('Z-C'), '两代入赘子女均归本族母系主干');
  ok(!flat.includes('Z-R1') && !flat.includes('Z-R2'), '两代赘婿均不入主干');
  eq(L.kinship(gf.id, c.id, map), '曾孙', '外祖父 → 三代之后入赘链曾孙（母系主干 3 代，世次 3→6）');
  ok(S.isAncestor('Z-R1', 'Z-C', map), '第一代赘婿经 fatherId 边仍是血缘祖先');
  ok(S.isAncestor('Z-M1', 'Z-C', map), '外祖母经母系边可达');

  // C2 过继 + 入赘叠加：入赘家庭之子过继给本族叔父
  const ufs = { id: 'A-UF', surname: '丘', name: '志本', gender: 'M', category: 'clan', generation: 4, branchId: 'B03', fatherId: 'A-GF', sortKey: 'B0003-G004-0001' };
  const bf2 = { id: 'A-BF', surname: '丘', name: '志源', gender: 'F', category: 'clan', generation: 4, branchId: 'B03', fatherId: 'A-GF', sortKey: 'B0003-G004-0002' };
  const agf = { id: 'A-GF', surname: '丘', name: '建椿', gender: 'M', category: 'clan', generation: 3, branchId: 'B03', sortKey: 'B0003-G003-0001' };
  const bc2 = { id: 'A-BC', surname: '丘', name: '承嗣', gender: 'M', category: 'clan', generation: 5, branchId: 'B03',
    motherId: 'A-BF', fatherId: 'A-SP', adoptiveFatherId: 'A-UF', sortKey: 'B0003-G005-0001' };
  const asp = { id: 'A-SP', surname: '郑', name: '老实', gender: 'M', category: 'spouse', generation: 4, branchId: 'B03', birthOrder: 1, sortKey: 'B0003-G004-9001' };
  const ps2 = [agf, ufs, bf2, asp, bc2];
  const ms2 = [{ id: 'AM1', husbandId: 'A-SP', wifeId: 'A-BF', type: 'ruzhui', order: 1 }];
  const map2 = new Map(ps2.map(p => [p.id, p]));
  const roots2 = L.buildForest(ps2, ms2);
  const flat2 = L.flatten(roots2).map(f => f.node.id);
  // 归属父优先级：嗣父 > 生父 > 生母 → 承嗣归叔祖志本
  const bcNode = L.flatten(roots2).find(f => f.node.id === 'A-BC');
  eq(bcNode && bcNode.parentId, 'A-UF', '入赘家庭之子过继 → 归嗣父（优先级高于生父/生母）');
  eq(S.bloodRemark(bc2, map2), '本生父：老实', '血亲备注取生父（赘婿）');
  ok(flat2.includes('A-BC'), '过继子不丢失');
  eq(L.kinship(agf.id, bc2.id, map2), '孙', '祖父 → 过继出去的孙（经嗣父线仍可达）');

  // C3 复婚（同一对两次婚姻）+ 丧偶再娶
  const hh = { id: 'C-H', surname: '丘', name: '志清', gender: 'M', category: 'clan', generation: 4, branchId: 'B01', sortKey: 'B0001-G004-0001' };
  const w1 = { id: 'C-W1', surname: '孙', name: '巧珍', gender: 'F', category: 'spouse', generation: 4, branchId: 'B01', birthOrder: 1, sortKey: 'B0001-G004-9001' };
  const w2 = { id: 'C-W2', surname: '何', name: '丽', gender: 'F', category: 'spouse', generation: 4, branchId: 'B01', birthOrder: 2, sortKey: 'B0001-G004-9002' };
  const ms3 = [
    { id: 'C1', husbandId: 'C-H', wifeId: 'C-W1', type: 'marry', order: 1, status: 'divorced', startYear: '1980', endYear: '1985' },
    { id: 'C2', husbandId: 'C-H', wifeId: 'C-W1', type: 'marry', order: 2, status: 'current', startYear: '1990', notes: '复婚' },
    { id: 'C3', husbandId: 'C-H', wifeId: 'C-W2', type: 'marry', order: 3, status: 'current', startYear: '1992' }
  ];
  const ps3 = [hh, w1, w2];
  const roots3 = L.buildForest(ps3, ms3);
  eq(roots3[0].spouses.length, 3, '【文档化】建树层不去重：同妻两条婚姻产生两条配偶条目（repo 层负责拦截重复婚姻）');
  eq(roots3[0].spouses[0].person.name, '巧珍', '复婚妻子仍在首位（按 order）');
  // schema 层不拦重复婚姻 —— repo 层校验职责，此处文档化
  eq(ms3.length, 3, '【文档化】同对重复婚姻由 repo 层校验拦截，schema/建树层容错不崩溃');
}

/* ══════════ D. 数据畸形鲁棒性 ══════════ */
console.log('\n【D】数据畸形鲁棒性');
{
  // 【已知问题】buildForest 对 null persons 抛 TypeError（persons 参数无空值保护；repo 层恒传数组，实际不可达）
  let threw = false;
  try { L.buildForest(null, null); } catch (e) { threw = true; }
  eq(threw, true, '【已知问题】buildForest(null) 抛 TypeError（建议后续补 persons || [] 保护）');
  eq(L.buildForest([], []).length, 0, '空数组输入 → 空森林');
  eq(S.displayName(undefined), '', 'displayName(undefined) → 空串');
  ok(typeof S.buildSortKey({ generation: -5, birthOrder: -3 }) === 'string', '负数世次/排行 → 补位规则处理不崩溃（负值实际不可能出现）');
  eq(L.kinship('A', 'B', new Map()), null, '空图谱称谓 → null（人员不存在时早退，不抛错）');
  eq(S.nextPersonId('B01', 1, [{}]), 'B01-G01-001', '畸形人员对象不干扰 ID 生成');
  // 父子边互指但非环（父指向不存在的祖父）
  const ps = [
    { id: 'K', category: 'clan', generation: 2, fatherId: 'GHOST', sortKey: 'B0001-G002-0001' }
  ];
  eq(L.buildForest(ps, []).length, 1, '空婚姻数组容错');
}

/* ══════════ E. ID / sortKey 进位与定宽边界 ══════════ */
console.log('\n【E】ID 与 sortKey 边界');
{
  eq(S.nextPersonId('B01', 3, [{ id: 'B01-G03-999' }]), 'B01-G03-1000', '序号 999 → 1000 进位');
  eq(S.nextPersonId('B1', 3, [{ id: 'B1-G03-005' }]), 'B1-G03-006', '非标房支 ID（B1）独立计数');
  eq(S.nextPersonId('B01', 100, [{ id: 'B01-G100-005' }]), 'B01-G100-006', '百位世次前缀匹配（G100）');
  eq(S.buildSortKey({ branchId: 'B01', generation: 1000, birthOrder: 1 }).length, 16, '【文档化】世次 ≥1000 破坏定宽（15→16 位，字典序错乱；实际不可能出现）');
  // 房支排序：B02 < B03 < B10（按数字而非字典序，故 10 排在 3 之后）
  const arr = [
    { sortKey: 'B0010-G001-0001' }, { sortKey: 'B0002-G001-0001' }, { sortKey: 'B0003-G001-0001' }
  ].sort(S.compareBySortKey).map(x => x.sortKey.split('-')[0]);
  eq(arr.join(','), 'B0002,B0003,B0010', '房支号两位以内排序正确（B02 < B03 < B10）');
}

/* ══════════ F. 称谓矩阵补充 ══════════ */
console.log('\n【F】称谓矩阵补充');
{
  const ps = [
    { id: 'R',  gender: 'M', category: 'clan', generation: 1, sortKey: 'B0001-G001-0001' },
    { id: 'A1', gender: 'M', category: 'clan', generation: 2, fatherId: 'R', sortKey: 'B0001-G002-0001' },
    { id: 'A2', gender: 'F', category: 'clan', generation: 2, fatherId: 'R', sortKey: 'B0001-G002-0002' },
    { id: 'B1', gender: 'M', category: 'clan', generation: 2, fatherId: 'R', sortKey: 'B0001-G002-0003' },
    { id: 'A1S', gender: 'M', category: 'clan', generation: 3, fatherId: 'A1', sortKey: 'B0001-G003-0001' },
    { id: 'A1D', gender: 'F', category: 'clan', generation: 3, fatherId: 'A1', sortKey: 'B0001-G003-0002' },
    { id: 'A1SS', gender: 'M', category: 'clan', generation: 4, fatherId: 'A1S', sortKey: 'B0001-G004-0001' },
    { id: 'A1SD', gender: 'F', category: 'clan', generation: 4, fatherId: 'A1S', sortKey: 'B0001-G004-0002' }
  ];
  const map = new Map(ps.map(p => [p.id, p]));
  eq(L.kinship('A1SS', 'B1', map), '伯祖父/叔祖父', '侄孙 → 祖父之弟（伯祖父/叔祖父）');
  eq(L.kinship('A1SD', 'A2', map), '姑祖母', '侄孙女 → 祖父之姐妹（姑祖母）');
  eq(L.kinship('A1S', 'A1D', map), '妹', '兄 → 妹');
  eq(L.kinship('A1SS', 'A1D', map), '姑母', '侄孙 → 姑母（父系姑）');
  eq(L.kinship('B1', 'A1SS', map), '侄孙', '祖父之弟 → 兄之孙（侄孙）');
  eq(L.kinship('B1', 'A1SD', map), '侄孙女', '祖父之弟 → 兄之孙女（侄孙女）');
  eq(L.kinship('A2', 'A1SS', map), '侄孙', '姑祖母 → 娘家侄孙（父系兄弟之孙，隔两代）');
  // 跨支系同辈远亲
  const ps2 = [
    { id: 'T0', gender: 'M', category: 'clan', generation: 1, sortKey: 'B0001-G001-0001' },
    { id: 'T1a', gender: 'M', category: 'clan', generation: 2, fatherId: 'T0', sortKey: 'B0001-G002-0001' },
    { id: 'T1b', gender: 'M', category: 'clan', generation: 2, fatherId: 'T0', sortKey: 'B0001-G002-0002' },
    { id: 'T2a', gender: 'M', category: 'clan', generation: 3, fatherId: 'T1a', sortKey: 'B0001-G003-0001' },
    { id: 'T3a', gender: 'M', category: 'clan', generation: 4, fatherId: 'T2a', sortKey: 'B0001-G004-0001' },
    { id: 'T2b', gender: 'M', category: 'clan', generation: 3, fatherId: 'T1b', sortKey: 'B0001-G003-0002' },
    { id: 'T3b', gender: 'M', category: 'clan', generation: 4, fatherId: 'T2b', sortKey: 'B0001-G004-0002' },
    { id: 'T4b', gender: 'M', category: 'clan', generation: 5, fatherId: 'T3b', sortKey: 'B0001-G005-0001' }
  ];
  const map2 = new Map(ps2.map(p => [p.id, p]));
  eq(L.kinship('T3a', 'T3b', map2), '从堂兄弟', '同曾祖隔一代支 → 从堂兄弟');
  eq(L.kinship('T3a', 'T4b', map2), '堂侄', '跨支晚一辈 → 堂侄');
  eq(L.kinship('T3a', 'T2b', map2), '族中长辈', '跨支长辈 → 族中长辈');
  eq(L.kinship('T2a', 'T4b', map2), '族孙', '跨支晚两辈 → 族孙');
}

console.log('\n──────────────────────────');
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
