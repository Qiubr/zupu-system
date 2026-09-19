/**
 * 边界场景测试（补充 smoke.js 未覆盖的边界）
 * 运行：NODE_PATH=<workspace>/node_modules node tests/edge-cases.js
 * 覆盖：派生函数缺字段 · 防循环死循环 · ID 生成异常输入 · 建树断链/回退/环数据 · 称谓推算边界
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

console.log('\n[1] buildSortKey 缺字段与异常输入');
eq(S.buildSortKey({}), 'B00-G099-9099'.replace('9', '0').replace(/^B00-G099/, 'B00-G099') === '' ? '' : 'B00-G099-0099', '全空字段 → B00/G99/排行99');
eq(S.buildSortKey({ generation: '3' }), 'B00-G003-0099', '世次传字符串数字 → 正常转数值');
eq(S.buildSortKey({ generation: NaN }), 'B00-G099-0099', '世次 NaN → 按 99 兜底');
eq(S.buildSortKey({ branchId: 'B01', generation: 3, birthOrder: '2' }), 'B01-G003-0002', '排行传字符串 → 正常转数值');
eq(S.buildSortKey({ branchId: 'B01', generation: 3, category: 'spouse' }), 'B01-G003-9099', '无排行配偶 → 排行 99');

console.log('\n[2] displayName / spouseLabel / bloodRemark 边界');
eq(S.displayName(null), '', 'null 入参 → 空串');
eq(S.displayName({ category: 'spouse', name: '秀英' }), '秀英', '配偶缺姓氏 → 退回仅名');
eq(S.displayName({ lineageType: 'external', surname: '陈' }), '陈', '外系缺名 → 仅姓');
eq(S.displayName({ category: 'spouse', lineageType: 'external', surname: '王', name: '梅花' }), '王氏梅花', '配偶优先于外系分支');
eq(S.spouseLabel({ surname: '王', name: '梅花' }), '配梅花', '非配偶走 spouseLabel → 仅拼名（无「氏」）');
eq(S.bloodRemark({ adoptiveFatherId: 'X1', fatherId: 'F1' }, new Map()), '', 'personMap 无生父记录 → 空标注');
eq(S.bloodRemark({ fatherId: 'F1' }, new Map([['F1', { name: '建华' }]])), '', '无嗣父 → 不标注');

console.log('\n[3] isAncestor 环数据不死循环');
// 构造 A.father=B, B.father=A 的环
const cycMap = new Map([
  ['A', { id: 'A', fatherId: 'B' }],
  ['B', { id: 'B', fatherId: 'A' }]
]);
const t0 = Date.now();
eq(S.isAncestor('C', 'A', cycMap), false, '环外 C 不是 A 的祖先（环不干扰）');
eq(S.isAncestor('B', 'A', cycMap), true, '环内 B 是 A 的父（经环可达）');
ok(Date.now() - t0 < 200, '环数据回溯在 200ms 内终止（不死循环）');
eq(S.isAncestor('', 'A', cycMap), false, '空 candidateId → false');
eq(S.isAncestor('A', '', cycMap), false, '空 targetId → false');
eq(S.isAncestor('X', 'Y', new Map()), false, '空 personMap → false 不抛错');

console.log('\n[4] nextPersonId 异常输入');
eq(S.nextPersonId('B01', 3, []), 'B01-G03-001', '空列表 → 从 001 起');
eq(S.nextPersonId('B01', 3, null), 'B01-G03-001', 'persons 未传 → 从 001 起');
eq(S.nextPersonId('B01', '3', []), 'B01-G03-001', '世次传字符串 → 前缀正确');
eq(S.nextPersonId('B01', 3, [{ id: 'B01-G03-abc' }, { id: 'B01-G03-007' }]), 'B01-G03-008', '非数字序号跳过，取最大 007 → 008');
eq(S.nextPersonId('B01', 3, [{ id: 'B01-G03-005' }, { id: 'B01-G03-002' }]), 'B01-G03-006', '序号不连续 → 取最大+1（不复用空洞）');
eq(S.nextPersonId('B01', 3, [{ id: 'B01-G030-009' }]), 'B01-G03-001', '旧格式 G030 不误匹配 G03 前缀');
eq(S.nextPersonId(null, 1, []), 'B01-G01-001', '房支未传 → 默认 B01');

console.log('\n[5] spouseKeyOf');
eq(S.spouseKeyOf(null), null, 'null → null');
eq(S.spouseKeyOf({ category: 'clan', branchId: 'B01', generation: 3 }), null, '本族成员 → null');
eq(S.spouseKeyOf({ category: 'spouse', branchId: 'B02', generation: 4 }), 'B02#4', '配偶 → 房支#世次 分组键');
eq(S.spouseKeyOf({ category: 'spouse' }), '#', '配偶缺房支与世次 → 空值分组键（边界，可接受）');

console.log('\n[6] buildForest 断链与回退');
// 6.1 父亲是配偶（赘婿）→ 回退本族母亲
{
  const ps = [
    { id: 'M1', surname: '丘', name: '志敏', category: 'clan', lineageType: 'clan', generation: 4, branchId: 'B01', sortKey: 'B01-G004-0001' },
    { id: 'S1', surname: '王', name: '大山', category: 'spouse', lineageType: 'clan', generation: 4, branchId: 'B01', sortKey: 'B01-G004-9001' },
    { id: 'C1', surname: '丘', name: '承轩', category: 'clan', lineageType: 'clan', generation: 5, branchId: 'B01', fatherId: 'S1', motherId: 'M1', sortKey: 'B01-G005-0001' }
  ];
  const ms = [{ id: 'MR1', husbandId: 'S1', wifeId: 'M1', type: 'ruzhui', order: 1 }];
  const roots = L.buildForest(ps, ms);
  eq(roots.length, 1, '入赘家庭单根（志敏）');
  eq(roots[0].id, 'M1', '子归本族生母（不挂赘婿）');
  eq(roots[0].spouses.length, 1, '赘婿作为配偶挂在母亲节点上');
  eq(roots[0].spouses[0].person.id, 'S1', '配偶挂载正确');
}
// 6.2 只有 fatherId 指向配偶 → 兜底挂配偶
{
  const ps = [
    { id: 'S2', surname: '李', name: '四', category: 'spouse', generation: 3, branchId: 'B01', sortKey: 'B01-G003-9001' },
    { id: 'C2', category: 'clan', generation: 4, branchId: 'B01', fatherId: 'S2', sortKey: 'B01-G004-0001' }
  ];
  const roots = L.buildForest(ps, []);
  eq(roots.length, 1, '仅挂配偶父 → 子女不丢（自成根）');
  eq(roots[0].id, 'C2', '配偶不入主干，故子女为根（而非挂在配偶下）');
}
// 6.3 fatherId 指向不存在的人 → 断链变根
{
  const ps = [
    { id: 'C3', category: 'clan', generation: 4, branchId: 'B01', fatherId: 'GHOST', sortKey: 'B01-G004-0001' }
  ];
  const roots = L.buildForest(ps, []);
  eq(roots.length, 1, '父亲 ID 不存在 → 断链者成为根（不消失）');
  eq(roots[0].id, 'C3', '断链根为该成员');
}
// 6.4 环数据（repo 层有防环，此处验证 API 层行为）
{
  const ps = [
    { id: 'RA', category: 'clan', generation: 1, fatherId: 'RB', sortKey: 'B01-G001-0001' },
    { id: 'RB', category: 'clan', generation: 2, fatherId: 'RA', sortKey: 'B01-G002-0001' }
  ];
  const roots = L.buildForest(ps, []);
  const flat = L.flatten(roots).map(f => f.node.id);
  ok(!flat.includes('RA') && !flat.includes('RB'), '【已知问题】环数据两节点均不入森林（静默丢失，依赖 repo 层防环拦截）');
  eq(roots.length, 0, '环数据 → 零根（文档化现状）');
}
// 6.5 多配偶按 order 排序（order 乱序传入）
{
  const ps = [
    { id: 'H1', category: 'clan', generation: 2, branchId: 'B01', sortKey: 'B01-G002-0001' },
    { id: 'W1', surname: '张', name: '一', category: 'spouse', sortKey: 'B01-G002-9002' },
    { id: 'W2', surname: '李', name: '二', category: 'spouse', sortKey: 'B01-G002-9001' }
  ];
  const ms = [
    { id: 'M2', husbandId: 'H1', wifeId: 'W1', type: 'marry', order: 2 },
    { id: 'M1', husbandId: 'H1', wifeId: 'W2', type: 'marry', order: 1 }
  ];
  const roots = L.buildForest(ps, ms);
  eq(roots[0].spouses.map(s => s.person.name).join(','), '二,一', '配偶按 marriage.order 排序（order 乱序传入也正确）');
}
// 6.6 子女同级按 sortKey 排序
{
  const ps = [
    { id: 'P', category: 'clan', generation: 1, branchId: 'B01', sortKey: 'B01-G001-0001' },
    { id: 'K2', category: 'clan', generation: 2, branchId: 'B01', fatherId: 'P', birthOrder: 2, sortKey: 'B01-G002-0002' },
    { id: 'K1', category: 'clan', generation: 2, branchId: 'B01', fatherId: 'P', birthOrder: 1, sortKey: 'B01-G002-0001' }
  ];
  const roots = L.buildForest(ps, []);
  eq(roots[0].children.map(c => c.id).join(','), 'K1,K2', '同父子女按 sortKey 排序');
}

console.log('\n[7] pathToRoot / ancestorChain');
{
  const ps = [
    { id: 'G1', category: 'clan', generation: 1, sortKey: 'B01-G001-0001' },
    { id: 'G2', category: 'clan', generation: 2, fatherId: 'G1', sortKey: 'B01-G002-0001' },
    { id: 'G3', category: 'clan', generation: 3, fatherId: 'G2', sortKey: 'B01-G003-0001' }
  ];
  const map = new Map(ps.map(p => [p.id, p]));
  eq(L.pathToRoot('G3', map).join(','), 'G1,G2,G3', '路径从根到自身');
  eq(L.pathToRoot('G1', map).join(','), 'G1', '始祖路径仅自身');
  eq(L.pathToRoot('NOPE', map).join(','), 'NOPE', '不存在的 ID → 仅含自身（不抛错）');
  eq(L.ancestorChain('G3', map).join(','), 'G3,G2,G1', '祖先链从自身到根（与 pathToRoot 逆序）');
}

console.log('\n[8] kinship 称谓推算边界');
{
  // 独立小家系：G → F, S（F、S 兄妹）→ F 之子 N
  const ps = [
    { id: 'G', gender: 'M', category: 'clan', generation: 1, sortKey: 'B01-G001-0001' },
    { id: 'F', gender: 'M', category: 'clan', generation: 2, fatherId: 'G', birthDate: '1960', sortKey: 'B01-G002-0001' },
    { id: 'S', gender: 'F', category: 'clan', lineageType: 'outMarried', generation: 2, fatherId: 'G', birthDate: '1963', sortKey: 'B01-G002-0002' },
    { id: 'N', gender: 'M', category: 'clan', generation: 3, fatherId: 'F', birthDate: '1985', sortKey: 'B01-G003-0001' }
  ];
  const map = new Map(ps.map(p => [p.id, p]));
  eq(L.kinship(null, 'F', map), null, '空 ID → null');
  eq(L.kinship('NOPE', 'F', map), null, '不存在的人 → null');
  eq(L.kinship('F', 'F', map), '本人', '自身 → 本人');
  eq(L.kinship('G', 'N', map), '孙', '祖父 → 孙子');
  eq(L.kinship('N', 'G', map), '祖父', '孙子 → 祖父');
  eq(L.kinship('S', 'N', map), '侄', '姑母 → 侄子（父系兄妹之子）');
  eq(L.kinship('N', 'S', map), '姑母', '侄子 → 姑母');
  ok(['伯父/叔父', '父'].includes(L.kinship('N', 'S', map)) === false, '侄子对姑母不误判为伯叔');
  eq(L.kinship('F', 'S', map), '妹', '兄 → 妹（按出生年 1960<1963）');
  eq(L.kinship('S', 'F', map), '兄', '妹 → 兄');
  // 无共同祖先
  const ps2 = [
    { id: 'X1', gender: 'M', category: 'clan', generation: 1, sortKey: 'B09-G001-0001' },
    { id: 'Y1', gender: 'M', category: 'clan', generation: 1, sortKey: 'B08-G001-0001' }
  ];
  const map2 = new Map(ps2.map(p => [p.id, p]));
  eq(L.kinship('X1', 'Y1', map2), '无共同先祖（不同支系）', '无共同祖先 → 兜底描述');
  // 五代以上
  const chain = [];
  for (let i = 1; i <= 6; i++) {
    chain.push({ id: 'D' + i, gender: 'M', category: 'clan', generation: i, fatherId: i > 1 ? 'D' + (i - 1) : null, sortKey: 'B01-G00' + i + '-0001' });
  }
  const map3 = new Map(chain.map(p => [p.id, p]));
  eq(L.kinship('D1', 'D6', map3), '来孙（5代后）', '高祖 → 6 世来孙');
  eq(L.kinship('D6', 'D1', map3), '先祖（上溯 5 代）', '6 世 → 上溯 5 代先祖');
  eq(L.kinship('D1', 'D5', map3), '玄孙', '高祖 → 玄孙（4 代直系）');
  // 真正的旁支：D2 的弟弟 D2B → 其孙 N2；D2 对 N2 应为「侄孙」
  chain.push({ id: 'D2B', gender: 'M', category: 'clan', generation: 2, fatherId: 'D1', sortKey: 'B01-G002-0002' });
  chain.push({ id: 'N1', gender: 'M', category: 'clan', generation: 3, fatherId: 'D2B', sortKey: 'B01-G003-0099' });
  chain.push({ id: 'N2', gender: 'M', category: 'clan', generation: 4, fatherId: 'N1', sortKey: 'B01-G004-0099' });
  const map3b = new Map(chain.map(p => [p.id, p]));
  eq(L.kinship('D2', 'N2', map3b), '侄孙', '旁支：兄之孙 → 侄孙（同祖父）');
  // compareAge 双缺 → 按排行兜底
  const ps4 = [
    { id: 'E1', gender: 'M', category: 'clan', generation: 1, sortKey: 'B01-G001-0001' },
    { id: 'E2', gender: 'M', category: 'clan', generation: 2, fatherId: 'E1', sortKey: 'B01-G002-0001' },
    { id: 'E3', gender: 'M', category: 'clan', generation: 2, fatherId: 'E1', sortKey: 'B01-G002-0002' }
  ];
  const map4 = new Map(ps4.map(p => [p.id, p]));
  eq(L.kinship('E2', 'E3', map4), '弟', '双缺出生年排行 → 默认前者年长（文档化现状）');
}

console.log('\n[9] compareAge');
eq(L.compareAge({ birthDate: '1960', birthOrder: 2 }, { birthDate: '1963', birthOrder: 1 }), -3, '出生年优先于排行');
eq(L.compareAge({ birthDate: '1960', birthOrder: 2 }, { birthDate: '1960', birthOrder: 1 }), 1, '同年 → 比排行');
eq(L.compareAge({ birthOrder: 5 }, { birthOrder: 3 }), 2, '无出生年 → 比排行');
eq(L.compareAge({}, {}), 0, '双全缺 → 视为同龄（0）');

console.log('\n[10] 种子数据一致性抽查（血缘边完整性）');
{
  const map = new Map(ZP.SEED.persons.map(p => [p.id, p]));
  const broken = ZP.SEED.persons.filter(p =>
    p.fatherId && !map.has(p.fatherId) ||
    p.motherId && !map.has(p.motherId) ||
    p.adoptiveFatherId && !map.has(p.adoptiveFatherId)
  ).map(p => p.id);
  eq(broken.join(','), '', '种子数据无悬挂引用（所有父/母/嗣父边均可达）');
  const dupIds = ZP.SEED.persons.map(p => p.id).filter((id, i, arr) => arr.indexOf(id) !== i);
  eq(dupIds.join(','), '', '种子数据无重复 ID');
  const genMismatch = ZP.SEED.persons.filter(p => {
    const dad = p.fatherId && map.get(p.fatherId);
    return dad && Number(p.generation) !== Number(dad.generation) + 1;
  }).map(p => p.id);
  eq(genMismatch.join(','), '', '种子数据世次全部 = 父世次 + 1');
}

console.log('\n──────────────────────────');
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
