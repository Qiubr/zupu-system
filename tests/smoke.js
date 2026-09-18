/**
 * 核心逻辑冒烟测试（Node 环境，不起浏览器）
 * 运行：node tests/smoke.js
 * 覆盖：种子数据规模 · 派生函数 · 防循环 · 世次 ID 生成 · 建树归属 · 称谓推算
 */
const fs = require('fs');
const path = require('path');

global.window = global;

function load(rel) {
  const code = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  // 用间接 eval 在全局作用域执行，使各文件的 IIFE 挂到 window(=global)
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

const persons = ZP.SEED.persons;
const marriages = ZP.SEED.marriages;
const map = new Map(persons.map(p => [p.id, p]));

console.log('\n[0] 种子数据规模');
eq(persons.length, 42, '成员 42 人');
eq(marriages.length, 15, '婚姻 15 条');
eq(ZP.SEED.branches.length, 3, '房支 3 个（长房/二房/三房）');
const gens = [...new Set(persons.map(p => Number(p.generation)))].sort((a, b) => a - b);
eq(gens.join(','), '1,2,3,4,5,6', '覆盖 1–6 世（>4 代）');
const poem = ZP.SEED.meta.filter(m => m.key === 'generationPoem')[0].value;
const genNames = gens.map(g => (persons.find(p => Number(p.generation) === g && p.generationName) || {}).generationName || '·').join('');
eq(genNames, '守德建志承先', '字辈与字辈诗前六字一致（' + poem + '）');
ok(persons.filter(p => p.category === 'spouse').length === 15, '配偶 15 人（含赘婿与外姓女）');
ok(persons.filter(p => p.lineageType === 'external').length === 2, '外系成员 2 人（随母入谱）');
ok(persons.filter(p => p.adoptiveFatherId).length === 1, '过继 1 例');
ok(marriages.some(m => m.type === 'ruzhui'), '含入赘婚姻');
ok(marriages.some(m => m.type === 'chuzhui'), '含出赘婚姻');
ok(marriages.some(m => m.status === 'divorced'), '含离异婚姻');
ok(persons.filter(p => !p.deathDate).length > 0, '含在世成员（无卒年）');

console.log('\n[1] 派生函数');
eq(S.buildSortKey({ branchId: 'B01', generation: 3, birthOrder: 2 }), 'B01-G003-0002', 'buildSortKey 定宽拼接');
eq(S.buildSortKey({ branchId: 'B01', generation: 2, birthOrder: 1, category: 'spouse' }), 'B01-G002-9001', '配偶排在同世次本族之后');
eq(S.displayName(map.get('B01-G02-002')), '李氏秀英', '配偶展示名 = 姓+氏+名');
eq(S.displayName(map.get('B01-G03-001')), '建国', '本族成员展示名 = 名');
eq(S.displayName(map.get('B01-G04-002')), '陈明', '外系成员保留姓氏');
eq(S.spouseLabel(map.get('B01-G02-002')), '配李氏秀英', '谱中标注「配…」');
eq(S.bloodRemark(map.get('B01-G04-001'), map), '本生父：建华', '过继者自动标注本生父');
eq(S.bloodRemark(map.get('B01-G04-003'), map), '', '非过继者无本生父标注');

console.log('\n[2] 防循环');
ok(S.isAncestor('B01-G01-001', 'B01-G04-001', map), '始祖是志强的祖先');
eq(S.isAncestor('B01-G04-001', 'B01-G01-001', map), false, '志强不是始祖的祖先');
eq(S.isAncestor('B01-G03-001', 'B01-G03-001', map), true, '自身视为祖先（自环拦截用）');
ok(S.isAncestor('B01-G02-001', 'B01-G04-001', map), '德福经嗣父链仍是志强祖先');

console.log('\n[3] ID 生成');
eq(S.nextPersonId('B01', 3, persons), 'B01-G03-006', '长房三世代下一个序号为 006');
eq(S.nextPersonId('B02', 2, persons), 'B02-G02-003', '二房二世代下一个序号为 003');
eq(S.nextPersonId('B03', 1, persons), 'B03-G01-001', '三房一世从 001 起');
eq(S.nextPersonId('B01', 6, persons), 'B01-G06-002', '六世代续号');

console.log('\n[4] 建树归属');
const roots = L.buildForest(persons, marriages);
eq(roots.length, 1, '全族只有 1 个根（始祖守义），无断链孤根');
const root = roots[0];
eq(root.id, 'B01-G01-001', '根为始祖');
eq(root.children.map(c => c.id).join(','), 'B01-G02-001,B02-G02-001,B03-G02-001', '始祖三子分三房');

function findNode(id, nodes) {
  for (const n of nodes) {
    if (n.id === id) return n;
    const got = findNode(id, n.children);
    if (got) return got;
  }
  return null;
}
function depthOf(nodes) {
  let d = 0;
  for (const n of nodes) d = Math.max(d, 1 + depthOf(n.children));
  return d;
}
eq(depthOf(roots), 6, '世系深度 6 代（始祖 → 先禾）');

const defu = findNode('B01-G02-001', roots);
ok(defu, '找到德福节点');
eq(defu.spouses.length, 2, '德福有 2 位配偶（多配偶）');
eq(defu.spouses.map(s => S.displayName(s.person)).join('、'), '李氏秀英、张氏桂芳', '配偶按 order 排列');

const adopter = findNode('B01-G03-001', roots); // 建国
ok(adopter, '找到建国节点');
eq(adopter.children.map(c => c.id).join(','), 'B01-G04-001,B01-G04-003,B01-G04-006', '建国名下：嗣子志强 + 亲子志刚 + 女志敏');

const bio = findNode('B01-G03-002', roots); // 建华（生父）
eq(bio.children.length, 0, '生父建华名下无子（已过继出去）');

const outLady = findNode('B01-G03-003', roots); // 秀兰（外嫁女）
ok(outLady, '找到外嫁女秀兰节点');
eq(outLady.children.map(c => c.id).join(','), 'B01-G04-002', '外嫁女子随母入谱（仅挂 motherId）');

const zhimin = findNode('B01-G04-006', roots); // 志敏（招赘）
eq(zhimin.children.map(c => c.id).join(','), 'B01-G05-003', '入赘所生承轩归生母志敏名下（不挂赘婿）');
const zhining = findNode('B02-G04-002', roots); // 志宁（外嫁女）
eq(zhining.children.map(c => c.id).join(','), 'B02-G05-004', '二房外嫁女之子嘉轩随母入谱');

const zhian = findNode('B02-G04-003', roots); // 志安（出赘）
ok(zhian, '找到出赘者志安节点（本人仍在谱）');
eq(zhian.children.length, 0, '出赘者后代不入本谱主线');

const jianjun = findNode('B02-G03-001', roots);
eq(jianjun.children.map(c => c.id).sort().join(','), 'B02-G04-001,B02-G04-002', '二房建军有子女志远、志宁');
ok(findNode('B03-G05-001', roots), '三房世系亦达第 5 世');

console.log('\n[5] 称谓推算');
eq(L.kinship('B01-G03-001', 'B01-G03-001', map), '本人', '自己 → 本人');
eq(L.kinship('B01-G03-001', 'B01-G03-002', map), '弟', '建国 → 建华（弟）');
eq(L.kinship('B01-G03-002', 'B01-G03-001', map), '兄', '建华 → 建国（兄）');
ok(['伯父/叔父', '父'].includes(L.kinship('B01-G04-001', 'B01-G03-002', map)), '志强 → 生父建华（长辈）');
eq(L.kinship('B01-G03-003', 'B01-G04-002', map), '子', '秀兰 → 其子陈明');
eq(L.kinship('B01-G01-001', 'B01-G03-001', map), '孙', '始祖 → 建国（孙）');
eq(L.kinship('B01-G03-001', 'B01-G01-001', map), '祖父', '建国 → 始祖（祖父）');
eq(L.kinship('B01-G02-001', 'B01-G02-001', map), '本人', '同一人');
eq(L.kinship('B01-G01-001', 'B01-G06-001', map), '来孙（5代后）', '始祖 → 先禾（第 6 世·来孙）');
eq(L.kinship('B01-G02-001', 'B02-G02-001', map), '弟', '长房德福 → 二房德禄（弟）');
eq(L.kinship('B01-G04-001', 'B02-G04-001', map), '从堂兄弟', '长房志强 ↔ 二房志远（同曾祖·从堂）');

console.log('\n[6] 校验规则');
const mapNoSelf = new Map(map); mapNoSelf.delete('B01-G04-001');
eq(S.isAncestor('B01-G04-001', 'B01-G01-001', map) ? 'cycle' : 'ok', 'ok', '志强不能作为始祖的父（不成环）');
ok(ZP.repo === undefined, 'repo 依赖 DOM/IDB，不在本测试加载（预期）');

console.log('\n──────────────────────────');
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
