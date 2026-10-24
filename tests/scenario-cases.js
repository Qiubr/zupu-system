/**
 * 实际宗法场景模拟测试（多段婚姻 / 入赘 / 出赘 / 过继组合）
 * 运行：NODE_PATH=<workspace>/node_modules node tests/scenario-cases.js
 * 用例数据为虚构人物，覆盖：
 *   场景一：男主三段婚姻（离异→丧偶→在世），三房子女
 *   场景二：男方入赘（子女随母姓、赘婿不入主干）
 *   场景三：本族男子出赘（本人留谱、后代不入主线）
 *   场景四：兄无子过继弟之子 + 嗣父两任妻子
 *   场景五：跨场景组合校验（防循环、世次一致、ID 生成）
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

/** 场景数据构造工具 */
let seq = 0;
function P(o) {
  return Object.assign({
    id: 'X' + (++seq), category: 'clan', lineageType: 'clan',
    createdAt: 1, updatedAt: 1
  }, o);
}
function SK(p) { p.sortKey = S.buildSortKey(p); return p; }

/* ══════════ 场景一：三段婚姻 ══════════ */
console.log('\n【场景一】男主三段婚姻：元配离异 → 续弦丧偶 → 三任在世');
{
  const H = SK(P({ id: 'B01-G03-001', surname: '丘', name: '建国', gender: 'M', generation: 3, branchId: 'B01', birthDate: '1940' }));
  const W1 = SK(P({ id: 'B01-G03-901', surname: '张', name: '兰英', gender: 'F', category: 'spouse', generation: 3, branchId: 'B01', birthOrder: 1, birthDate: '1942' }));
  const W2 = SK(P({ id: 'B01-G03-902', surname: '李', name: '玉梅', gender: 'F', category: 'spouse', generation: 3, branchId: 'B01', birthOrder: 2, birthDate: '1945' }));
  const W3 = SK(P({ id: 'B01-G03-903', surname: '王', name: '秀珍', gender: 'F', category: 'spouse', generation: 3, branchId: 'B01', birthOrder: 3, birthDate: '1950' }));
  const K1 = SK(P({ id: 'B01-G04-001', surname: '丘', name: '志刚', gender: 'M', generation: 4, branchId: 'B01', fatherId: H.id, motherId: W1.id, birthOrder: 1, birthDate: '1962' }));
  const K2 = SK(P({ id: 'B01-G04-002', surname: '丘', name: '志芳', gender: 'F', generation: 4, branchId: 'B01', fatherId: H.id, motherId: W2.id, birthOrder: 2, birthDate: '1966' }));
  const K3 = SK(P({ id: 'B01-G04-003', surname: '丘', name: '志勇', gender: 'M', generation: 4, branchId: 'B01', fatherId: H.id, motherId: W3.id, birthOrder: 3, birthDate: '1972' }));

  const ms = [
    { id: 'M1', husbandId: H.id, wifeId: W1.id, type: 'marry', order: 1, status: 'divorced', startYear: '1961', endYear: '1970' },
    { id: 'M2', husbandId: H.id, wifeId: W2.id, type: 'marry', order: 2, status: 'widowed', startYear: '1971', endYear: '1988' },
    { id: 'M3', husbandId: H.id, wifeId: W3.id, type: 'marry', order: 3, status: 'current', startYear: '1990' }
  ];
  const ps = [H, W1, W2, W3, K1, K2, K3];
  const map = new Map(ps.map(p => [p.id, p]));
  const roots = L.buildForest(ps, ms);

  eq(roots.length, 1, '单根：建国');
  eq(roots[0].spouses.length, 3, '三任妻子全部挂载');
  eq(roots[0].spouses.map(s => s.person.name).join(','), '兰英,玉梅,秀珍', '妻子按 order（元配→续弦→三任）排列');
  eq(roots[0].spouses[0].marriage.status, 'divorced', '元配婚姻状态 = 离异');
  eq(roots[0].spouses[1].marriage.status, 'widowed', '续弦婚姻状态 = 丧偶');
  eq(roots[0].spouses[2].marriage.status, 'current', '三任婚姻状态 = 存续');
  eq(roots[0].children.map(c => c.id).join(','), 'B01-G04-001,B01-G04-002,B01-G04-003', '三房子女按排行排序');
  eq(S.displayName(W1), '张氏兰英', '配偶展示名「张氏兰英」');
  eq(S.spouseLabel(W3), '配王氏秀珍', '三任标注「配王氏秀珍」');
  eq(L.kinship(K1.id, K2.id, map), '妹', '异母妹：志刚 → 志芳（同父异母）');
  eq(L.kinship(K2.id, K1.id, map), '兄', '志芳 → 志刚（兄）');
  eq(L.kinship(K1.id, K3.id, map), '弟', '同父异母兄弟推算不因异母中断');
  eq(L.kinship(H.id, K3.id, map), '子', '建国 → 三子志勇');
  // 各房子女的生母称谓
  eq(L.kinship(W1.id, K1.id, map), '无共同先祖（不同支系）', '【已知限制】生母对亲子称谓不可达（称谓图只走父亲主干链，母亲边不参与）');
  // 排序键：配偶按婚姻次序排在同世次本族之后
  const sorted = [H, W1, W2, W3].sort(S.compareBySortKey).map(p => p.name).join(',');
  eq(sorted, '建国,兰英,玉梅,秀珍', '同世次本族在前、三任配偶按次序排后');
}

/* ══════════ 场景二：男方入赘 ══════════ */
console.log('\n【场景二】男方入赘：子女随母姓、赘婿不入主干');
{
  const GF = SK(P({ id: 'B02-G03-001', surname: '丘', name: '守业', gender: 'M', generation: 3, branchId: 'B02' }));
  const M  = SK(P({ id: 'B02-G04-001', surname: '丘', name: '志敏', gender: 'F', generation: 4, branchId: 'B02', fatherId: GF.id, birthOrder: 2, birthDate: '1968' }));
  const R  = SK(P({ id: 'B02-G04-901', surname: '王', name: '大山', gender: 'M', category: 'spouse', generation: 4, branchId: 'B02', birthOrder: 1, birthDate: '1966' }));
  const C1 = SK(P({ id: 'B02-G05-001', surname: '丘', name: '承轩', gender: 'M', generation: 5, branchId: 'B02', fatherId: R.id, motherId: M.id, birthOrder: 1, birthDate: '1992' }));
  const C2 = SK(P({ id: 'B02-G05-002', surname: '丘', name: '承慧', gender: 'F', generation: 5, branchId: 'B02', motherId: M.id, birthOrder: 2, birthDate: '1995' }));

  const ms = [{ id: 'M1', husbandId: R.id, wifeId: M.id, type: 'ruzhui', order: 1, status: 'current', startYear: '1990' }];
  const ps = [GF, M, R, C1, C2];
  const map = new Map(ps.map(p => [p.id, p]));
  const roots = L.buildForest(ps, ms);

  eq(roots.length, 1, '单根：外祖父守业（不入赘者不产生孤根）');
  const mNode = roots[0].children.find(c => c.id === M.id);
  ok(mNode, '志敏挂在外祖父名下');
  eq(mNode.children.map(c => c.id).join(','), 'B02-G05-001,B02-G05-002', '两名子女均归生母志敏名下');
  eq(mNode.spouses.length, 1, '赘婿王大山挂在志敏名下为配偶');
  eq(mNode.spouses[0].person.id, R.id, '赘婿挂载对象正确');
  eq(mNode.spouses[0].marriage.type, 'ruzhui', '婚姻方式 = 入赘');
  eq(S.displayName(R), '王氏大山', '赘婿展示名保留娘家姓「王氏大山」');
  eq(S.displayName(C1), '承轩', '入赘子女随母姓 → 本族展示名');
  eq(L.kinship(M.id, C1.id, map), '子', '志敏 → 承轩（子）');
  eq(L.kinship(C1.id, M.id, map), '母', '承轩 → 志敏（母）');
  eq(L.kinship(GF.id, C1.id, map), '孙', '外祖父 → 入赘所生外孙（按母系主干推算）');
  eq(L.kinship(R.id, C1.id, map), '无共同先祖（不同支系）', '【已知限制】赘婿与子女无血缘边可达（婚姻边未参与称谓图）');
  // 防循环：赘婿不能被立为子女的父亲候选造成环（数据面验证 isAncestor 可用）
  eq(S.isAncestor(R.id, C1.id, map), true, '赘婿是子女的血缘父亲（fatherId 边可达）');
}

/* ══════════ 场景三：本族男子出赘 ══════════ */
console.log('\n【场景三】本族男子出赘：本人留谱、后代不入本谱主线');
{
  const F  = SK(P({ id: 'B01-G03-001', surname: '丘', name: '建邦', gender: 'M', generation: 3, branchId: 'B01' }));
  const Z  = SK(P({ id: 'B01-G04-001', surname: '丘', name: '志安', gender: 'M', generation: 4, branchId: 'B01', fatherId: F.id, birthDate: '1970' }));
  const WE = SK(P({ id: 'B01-G04-901', surname: '钱', name: '彩凤', gender: 'F', category: 'spouse', generation: 4, branchId: 'B01', birthOrder: 1, birthDate: '1972' }));
  // 出赘者的子女在外姓家，不入本谱（故 persons 中不录）
  const ms = [{ id: 'M1', husbandId: Z.id, wifeId: WE.id, type: 'chuzhui', order: 1, status: 'current', startYear: '1995' }];
  const ps = [F, Z, WE];
  const map = new Map(ps.map(p => [p.id, p]));
  const roots = L.buildForest(ps, ms);

  eq(roots.length, 1, '单根：建邦');
  const zNode = roots[0].children.find(c => c.id === Z.id);
  ok(zNode, '出赘者志安仍在世系图中（本人不除名）');
  eq(zNode.spouses.length, 1, '外姓妻子挂为配偶');
  eq(zNode.spouses[0].marriage.type, 'chuzhui', '婚姻方式 = 出赘');
  eq(zNode.children.length, 0, '出赘者名下无子女节点（后代不入本谱主线）');
  eq(L.kinship(F.id, Z.id, map), '子', '建邦 → 出赘之子志安（父子关系保留）');
  eq(S.displayName(WE), '钱氏彩凤', '出赘配偶展示名「钱氏彩凤」');
}

/* ══════════ 场景四：过继 + 嗣父两任妻子 ══════════ */
console.log('\n【场景四】兄无子过继弟之子：嗣父有两任妻子');
{
  const GF = SK(P({ id: 'B01-G02-001', surname: '丘', name: '德厚', gender: 'M', generation: 2, branchId: 'B01' }));  // 共同祖父
  const UF = SK(P({ id: 'B01-G03-001', surname: '丘', name: '建业', gender: 'M', generation: 3, branchId: 'B01', fatherId: GF.id, birthDate: '1935' }));  // 嗣父（兄）
  const UW1 = SK(P({ id: 'B01-G03-901', surname: '周', name: '桂香', gender: 'F', category: 'spouse', generation: 3, branchId: 'B01', birthOrder: 1, birthDate: '1937' }));
  const UW2 = SK(P({ id: 'B01-G03-902', surname: '吴', name: '爱莲', gender: 'F', category: 'spouse', generation: 3, branchId: 'B01', birthOrder: 2, birthDate: '1945' }));
  const BF = SK(P({ id: 'B01-G03-002', surname: '丘', name: '建功', gender: 'M', generation: 3, branchId: 'B01', fatherId: GF.id, birthDate: '1940' }));  // 生父（弟）
  const BC = SK(P({ id: 'B01-G04-001', surname: '丘', name: '志远', gender: 'M', generation: 4, branchId: 'B01',
    fatherId: BF.id, adoptiveFatherId: UF.id, birthDate: '1965' }));  // 过继子

  const ms = [
    { id: 'M1', husbandId: UF.id, wifeId: UW1.id, type: 'marry', order: 1, status: 'widowed' },
    { id: 'M2', husbandId: UF.id, wifeId: UW2.id, type: 'marry', order: 2, status: 'current' }
  ];
  const ps = [GF, UF, UW1, UW2, BF, BC];
  const map = new Map(ps.map(p => [p.id, p]));
  const roots = L.buildForest(ps, ms);

  eq(roots.length, 1, '单根：祖父德厚');
  const ufNode = roots[0].children.find(c => c.id === UF.id);
  ok(ufNode, '嗣父建业挂祖父名下');
  eq(ufNode.children.map(c => c.id).join(','), BC.id, '过继子挂嗣父名下');
  eq(ufNode.spouses.length, 2, '嗣父两任妻子照常挂载');
  const bfNode = L.flatten(roots).find(f => f.node.id === BF.id);
  ok(bfNode, '生父建功在世系图中');
  eq(bfNode.node.children.length, 0, '生父建功名下无子（已过继出去）');
  eq(S.bloodRemark(BC, map), '本生父：建功', '过继子自动标注「本生父：建功」');
  eq(L.kinship(UF.id, BC.id, map), '子', '嗣父 → 过继子（宗法为父子）');
  eq(L.kinship(BC.id, BF.id, map), '伯父/叔父', '【宗法特性】过继后对生父称「伯父/叔父」（按嗣父线推算）');
  eq(L.kinship(BC.id, UF.id, map), '父', '过继子 → 嗣父（父）');
  ok(S.isAncestor(BF.id, BC.id, map), '生父仍是血亲祖先（血缘边保留）');
  ok(S.isAncestor(UF.id, BC.id, map), '嗣父经嗣父边成为祖先');
}

/* ══════════ 场景五：组合校验 ══════════ */
console.log('\n【场景五】组合校验：防循环拦截、世次一致、ID 续号');
{
  const ps = ZP.SEED.persons;
  const ms = ZP.SEED.marriages;
  const map = new Map(ps.map(p => [p.id, p]));

  // 世次一致性：所有子女 = 生父世次+1 或 生母世次+1 或 嗣父世次+1
  const bad = ps.filter(p => {
    const cands = [p.fatherId, p.motherId, p.adoptiveFatherId].filter(Boolean).map(id => map.get(id)).filter(Boolean);
    return cands.length > 0 && !cands.some(x => Number(p.generation) === Number(x.generation) + 1);
  }).map(p => p.id);
  eq(bad.join(','), '', '种子数据世次全部与（生/嗣）父辈一致');

  // 防循环：志强不能过继给其后代（曾孙辈）
  eq(S.isAncestor('B01-G04-001', 'B01-G01-001', map) ? '拦截' : '放行', '放行', '正常方向：志强可作始祖晚辈');
  eq(S.isAncestor('B01-G02-001', 'B01-G06-001', map) ? '拦截' : '放行', '拦截', '先禾（6世）不可过继给其祖先德福（2世）—— isAncestor 正确识别');

  // 三段婚姻家庭 ID 续号
  const h3 = [new Map(), null];
  const ids = ['B01-G03-001', 'B01-G03-901', 'B01-G03-902', 'B01-G03-903'].map(id => ({ id }));
  eq(S.nextPersonId('B01', 3, ids), 'B01-G03-904', '三任配偶后续号为 904（含 9xx 配偶序号段）');

  // 多配偶 sortKey 排序（含 901-903 段）
  const w = [903, 901, 902].map(n => ({ sortKey: 'B0001-G003-9' + String(n).padStart(3, '0'), name: 'W' + n }));
  eq(w.sort(S.compareBySortKey).map(x => x.name).join(','), 'W901,W902,W903', '配偶段 sortKey 排序稳定');
}

console.log('\n──────────────────────────');
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
