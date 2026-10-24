/**
 * 种子数据规模测试（10 世 / 200 人量级）
 * 运行：node tests/seed-scale.js
 *
 * 覆盖：
 *   A. 规模结构：人数 · 世代数 · 房支分布 · 本族/配偶构成
 *   B. 数据完整性：ID 唯一 · 无悬挂引用 · 世次递推 · 性别分类自洽 · 婚姻双方有效 · 生卒
 *   C. 世系结构：单根 · 深度 10 · 三房均达第 10 世 · 子女索引等价
 *   D. 跨 10 代称谓：直系 9 代 · 同胞/堂/族 · 上溯
 *   E. 规模性能：建树 · 排序 · 建索引 · 称谓矩阵
 */
const fs = require('fs');
const path = require('path');

global.window = global;

function load(rel) {
  const code = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  (0, eval)(code);            // 间接 eval：各文件 IIFE 挂到 window(=global)
}

load('src/db/schema.js');
load('src/db/seed.js');
load('src/db/lineage.js');

const ZP = global.ZP;
const S = ZP.schema;
const L = ZP.lineage;
const persons = ZP.SEED.persons;
const marriages = ZP.SEED.marriages;
const branches = ZP.SEED.branches;
const map = new Map(persons.map(p => [p.id, p]));

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const good = actual === expected;
  if (good) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + '\n      期望: ' + JSON.stringify(expected) + '\n      实际: ' + JSON.stringify(actual)); }
}
function ok(cond, label, extra) {
  if (cond) { pass++; console.log('  ✓ ' + label + (extra ? '（' + extra + '）' : '')); }
  else { fail++; console.log('  ✗ ' + label + (extra ? '\n      ' + extra : '')); }
}
function lt(actual, max, label) {
  if (actual < max) { pass++; console.log('  ✓ ' + label + '（' + actual + 'ms < ' + max + 'ms）'); }
  else { fail++; console.log('  ✗ ' + label + '（' + actual + 'ms ≥ ' + max + 'ms）'); }
}

const byGen = {};
persons.forEach(function (p) { (byGen[p.generation] = byGen[p.generation] || []).push(p); });
const gens = Object.keys(byGen).map(Number).sort((a, b) => a - b);

/* ══════════ A. 规模结构 ══════════ */
console.log('\n【A】规模结构');
ok(persons.length >= 190 && persons.length <= 210, '总人数落在 200 人量级', persons.length + ' 人');
eq(gens.length, 10, '覆盖 10 个世代');
eq(gens.join(','), '1,2,3,4,5,6,7,8,9,10', '世代连续无断代（1–10）');
ok(gens.every(g => byGen[g].length >= 2), '每个世代至少有 2 人',
  gens.map(g => 'G' + g + ':' + byGen[g].length).join(' '));

branches.forEach(function (b) {
  const n = persons.filter(p => p.branchId === b.id).length;
  ok(n > 20, '房支「' + b.name + '」人数充足', n + ' 人');
});
const g10 = byGen[10];
eq(branches.every(b => g10.some(p => p.branchId === b.id)), true, '三个房支均延续到第 10 世');
ok(g10.length >= 15, '第 10 世规模合理', g10.length + ' 人');

const clan = persons.filter(p => p.category === S.CATEGORY.CLAN);
const spouse = persons.filter(p => p.category === S.CATEGORY.SPOUSE);
ok(clan.length > spouse.length, '本族多于配偶', clan.length + ' / ' + spouse.length);
ok(persons.filter(p => p.lineageType === S.LINEAGE.OUT_MARRIED).length >= 5, '含多名外嫁女',
  persons.filter(p => p.lineageType === S.LINEAGE.OUT_MARRIED).length + ' 人');
ok(persons.filter(p => !p.deathDate).length > 10, '含足量在世成员（末两代）',
  persons.filter(p => !p.deathDate).length + ' 人');

/* ══════════ B. 数据完整性 ══════════ */
console.log('\n【B】数据完整性');
eq(persons.length - new Set(persons.map(p => p.id)).size, 0, 'ID 无重复');

const dangling = persons.filter(function (p) {
  return ['fatherId', 'motherId', 'adoptiveFatherId', 'adoptiveMotherId'].some(function (k) {
    return p[k] && !map.has(p[k]);
  });
});
eq(dangling.length, 0, '父/母/嗣父/嗣母引用均可达（无悬挂）');

const genBad = persons.filter(function (p) {
  const f = p.fatherId && map.get(p.fatherId);
  const m = p.motherId && map.get(p.motherId);
  return (f && Number(p.generation) !== Number(f.generation) + 1) ||
         (m && Number(p.generation) !== Number(m.generation) + 1);
});
eq(genBad.length, 0, '世次 = 生父/生母世次 + 1', genBad.slice(0, 3).map(p => p.id).join(','));

const adoptBad = persons.filter(function (p) {
  const af = p.adoptiveFatherId && map.get(p.adoptiveFatherId);
  return af && Number(p.generation) !== Number(af.generation) + 1;
});
eq(adoptBad.length, 0, '过继者世次 = 嗣父世次 + 1');

const genderBad = persons.filter(function (p) {
  if (p.category === S.CATEGORY.SPOUSE) return false;
  return p.lineageType === S.LINEAGE.OUT_MARRIED && p.gender !== S.GENDER.FEMALE;
});
eq(genderBad.length, 0, '外嫁女均为女性');

const parentGenderBad = persons.filter(function (p) {
  const f = p.fatherId && map.get(p.fatherId);
  const m = p.motherId && map.get(p.motherId);
  return (f && f.gender === S.GENDER.FEMALE) || (m && m.gender === S.GENDER.MALE);
});
eq(parentGenderBad.length, 0, '生父为男、生母为女（赘婿除外时由生母承载）',
  parentGenderBad.slice(0, 3).map(p => p.id).join(','));

const marryBad = marriages.filter(function (m) {
  const h = map.get(m.husbandId), w = map.get(m.wifeId);
  return !h || !w || h.gender !== S.GENDER.MALE || w.gender !== S.GENDER.FEMALE;
});
eq(marryBad.length, 0, '每条婚姻双方存在且夫男妻女');

const dupPairs = {};
let dupCount = 0;
marriages.forEach(function (m) {
  const k = [m.husbandId, m.wifeId].sort().join('|');
  if (dupPairs[k]) dupCount++;
  dupPairs[k] = 1;
});
eq(dupCount, 0, '无重复婚姻（同一无序对）');

const spouseGenBad = [];
marriages.forEach(function (m) {
  const h = map.get(m.husbandId), w = map.get(m.wifeId);
  if (h && w && Number(h.generation) !== Number(w.generation)) spouseGenBad.push(m.id);
});
eq(spouseGenBad.length, 0, '配偶与本族成员同世次', spouseGenBad.slice(0, 3).join(','));

const lifeBad = persons.filter(function (p) {
  const b = parseInt(p.birthDate, 10), d = parseInt(p.deathDate, 10);
  return !isNaN(b) && !isNaN(d) && d < b;
});
eq(lifeBad.length, 0, '卒年均不早于生年');

const earlyDead = persons.filter(p => Number(p.generation) <= 8 && !p.deathDate);
eq(earlyDead.length, 0, '第 1–8 世均已故（有卒年）');
ok(byGen[9].some(p => !p.deathDate) && byGen[10].some(p => !p.deathDate), '第 9–10 世有在世成员');

const sortBad = persons.filter(p => !p.sortKey);
eq(sortBad.length, 0, 'sortKey 全部预计算');
const sorted = persons.slice().sort(S.compareBySortKey);
ok(sorted.length === persons.length, '全量排序不丢人');
const firstClanIdx = sorted.findIndex(p => p.category === S.CATEGORY.CLAN && Number(p.generation) === 10);
const firstSpouseIdx = sorted.findIndex(p => p.category === S.CATEGORY.SPOUSE && Number(p.generation) === 10);
ok(firstClanIdx >= 0 && firstSpouseIdx > firstClanIdx, '同世次内本族排在配偶之前');

/* ══════════ C. 世系结构 ══════════ */
console.log('\n【C】世系结构');
const roots = L.buildForest(persons, marriages);
eq(roots.length, 1, '全族单一始祖，无断链孤根');
eq(roots[0].id, 'B01-G01-001', '根为始祖守义');

function depthOf(nodes) {
  let d = 0;
  for (const n of nodes) d = Math.max(d, 1 + depthOf(n.children));
  return d;
}
eq(depthOf(roots), 10, '世系深度 10 代');

function maxGenOf(node) {
  let g = Number(node.person.generation) || 0;
  node.children.forEach(function (c) { g = Math.max(g, maxGenOf(c)); });
  return g;
}
roots[0].children.forEach(function (n) {
  const b = branches.filter(x => x.id === n.person.branchId)[0];
  eq(maxGenOf(n), 10, '「' + (b ? b.name : n.person.branchId) + '」延续至第 10 世');
});

let trunkCount = 0;
(function count(nodes) {
  nodes.forEach(function (n) { trunkCount++; count(n.children); });
})(roots);
eq(trunkCount, clan.length, '主干节点数 = 本族人数（配偶不入主干）', trunkCount + ' / ' + clan.length);

// 子女索引与逐人扫描结果必须一致
const childrenMap = L.buildChildrenMap(persons);
let idxMismatch = 0;
persons.forEach(function (p) {
  const viaIndex = (childrenMap.get(p.id) || []).map(c => c.id).join(',');
  const viaScan = persons.filter(function (c) {
    return c.fatherId === p.id || c.motherId === p.id ||
           c.adoptiveFatherId === p.id || c.adoptiveMotherId === p.id;
  }).sort(S.compareBySortKey).map(c => c.id).join(',');
  if (viaIndex !== viaScan) idxMismatch++;
});
eq(idxMismatch, 0, '子女索引与全量扫描结果完全一致');

const chain = L.ancestorChain(g10[0].id, map);
eq(chain.length, 10, '第 10 世上溯祖先链长度 10');
eq(chain[chain.length - 1], 'B01-G01-001', '祖先链末端为始祖（链首为本人）');
eq(L.pathToRoot(g10[0].id, map).length, 10, 'pathToRoot 同样为 10 代');

/* ══════════ D. 跨 10 代称谓 ══════════ */
console.log('\n【D】跨 10 代称谓');
const ancestor = 'B01-G01-001';
const g10Male = g10.filter(p => p.gender === S.GENDER.MALE)[0];
const g10Female = g10.filter(p => p.gender === S.GENDER.FEMALE && p.category === S.CATEGORY.CLAN)[0];

const down9 = g10Male ? L.kinship(ancestor, g10Male.id, map) : null;
ok(down9 && down9.indexOf('来孙') === 0 && down9.indexOf('9代后') > 0, '始祖 → 第 10 世：9 代后直系', down9);
const up9 = g10Male ? L.kinship(g10Male.id, ancestor, map) : null;
ok(up9 && up9.indexOf('先祖') === 0 && up9.indexOf('9') > 0, '第 10 世 → 始祖：上溯 9 代', up9);

// 同父兄弟（第 7 世）
const g7 = byGen[7];
let sibPair = null;
for (let i = 0; i < g7.length && !sibPair; i++) {
  for (let j = i + 1; j < g7.length; j++) {
    if (g7[i].fatherId && g7[i].fatherId === g7[j].fatherId) { sibPair = [g7[i], g7[j]]; break; }
  }
}
ok(!!sibPair, '找到同父兄弟样本');
if (sibPair) {
  const older = L.compareAge(sibPair[0], sibPair[1]) <= 0 ? sibPair[0] : sibPair[1];
  const younger = older === sibPair[0] ? sibPair[1] : sibPair[0];
  eq(L.kinship(younger.id, older.id, map), older.gender === S.GENDER.MALE ? '兄' : '姐', '同父年幼者称年长者为兄/姐');
}

// 堂兄弟（同祖父，第 10 世）
let cousinPair = null;
for (let i = 0; i < g10.length && !cousinPair; i++) {
  for (let j = i + 1; j < g10.length; j++) {
    const fa = g10[i].fatherId && map.get(g10[i].fatherId);
    const fb = g10[j].fatherId && map.get(g10[j].fatherId);
    if (fa && fb && fa.fatherId && fa.fatherId === fb.fatherId && fa.id !== fb.id) {
      cousinPair = [g10[i], g10[j]];
      break;
    }
  }
}
ok(!!cousinPair, '找到同祖父堂亲样本');
if (cousinPair) {
  const t = L.kinship(cousinPair[0].id, cousinPair[1].id, map);
  ok(t === '堂兄弟' || t === '堂姐妹', '同祖父 → 堂兄弟/堂姐妹', t);
}

// 跨房支同辈（LCA 远在始祖附近 → 族兄弟）
const g10B01 = g10.filter(p => p.branchId === 'B01')[0];
const g10B03 = g10.filter(p => p.branchId === 'B03')[0];
if (g10B01 && g10B03) {
  const t = L.kinship(g10B01.id, g10B03.id, map);
  ok(t === '族兄弟' || t === '族姐妹', '跨房支同世次 → 族兄弟/族姐妹', t);
}

// 外嫁女标记不影响称谓链路
const outLady = persons.filter(p => p.lineageType === S.LINEAGE.OUT_MARRIED)[0];
ok(L.kinship(outLady.id, outLady.id, map) === '本人', '外嫁女自身称谓为「本人」');

/* ══════════ E. 规模性能 ══════════ */
console.log('\n【E】规模性能（200 人量级）');
function timed(fn) {
  const t = Date.now();
  fn();
  return Date.now() - t;
}
lt(timed(function () { L.buildForest(persons, marriages); }), 100, '建树');
lt(timed(function () { persons.slice().sort(S.compareBySortKey); }), 50, '全量排序');
lt(timed(function () { L.buildChildrenMap(persons); }), 50, '建子女索引');
lt(timed(function () {
  for (let i = 0; i < persons.length; i++) {
    L.kinship(persons[i].id, persons[(i * 7 + 3) % persons.length].id, map);
  }
}), 300, '称谓矩阵（' + persons.length + ' 组）');
lt(timed(function () { L.buildForest(persons, marriages); L.buildChildrenMap(persons); }), 150, '建树 + 索引（一次刷新）');

/* ══════════ 收尾 ══════════ */
console.log('\n──────────────────────────');
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
