/**
 * 单条数据创建场景用例集
 *
 * 目的：在不依赖人工点击的前提下，覆盖「创建/维护一条记录」的全部场景——
 *  正常落库 · ID 规则 · 必填校验 · 关系与防循环 · 告警级校验 · 生卒年份 ·
 *  持久化与派生 · 创建后联动 · 婚姻记录 · 删除保护
 *
 * 运行：
 *   NODE_PATH=<workspace>/node_modules node tests/create-cases.js
 *
 * 运行后自动输出报告：docs/create-cases-report.md
 * 每条用例执行前都会把数据重置回种子状态，用例之间互不影响。
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const REPORT = path.join(ROOT, 'docs', 'create-cases-report.md');
const FILES = [
  'src/db/schema.js', 'src/db/seed.js', 'src/db/idb.js', 'src/db/repo.js', 'src/db/lineage.js',
  'src/ui/util.js',
  'src/ui/views/member-list.js', 'src/ui/views/member-form.js', 'src/ui/views/tree.js', 'src/ui/views/data.js',
  'src/ui/app.js'
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function makeCtxStub() {
  const store = {};
  return new Proxy(store, {
    get(t, k) {
      if (k === 'measureText') return () => ({ width: 12 });
      if (k === 'canvas') return null;
      if (k in t) return t[k];
      return function () {};
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

async function loadFakeIDB() {
  const grab = (m) => {
    const mod = (m && m.default) ? m.default : m;
    const FDBFactory = mod.FDBFactory || (mod.default && mod.default.FDBFactory);
    if (mod.indexedDB) return { indexedDB: mod.indexedDB, IDBKeyRange: mod.IDBKeyRange };
    if (FDBFactory) return { indexedDB: new FDBFactory(), IDBKeyRange: mod.IDBKeyRange };
    return null;
  };
  try { const r = grab(require('fake-indexeddb')); if (r && r.indexedDB) return r; } catch (e) { /* fallthrough */ }
  try { const r = grab({ FDBFactory: require('fake-indexeddb/lib/FDBFactory'), IDBKeyRange: require('fake-indexeddb/lib/FDBKeyRange') }); if (r) return r; } catch (e) { /* fallthrough */ }
  const m = await import('fake-indexeddb');
  return grab(m);
}

/* ───────────────── 用例登记 ───────────────── */

const GROUPS = [
  ['A', '正常创建（按成员类型）'],
  ['B', 'ID 与主键规则'],
  ['C', '必填与取值校验'],
  ['D', '亲属关系与防循环'],
  ['E', '告警级校验（不阻断）'],
  ['F', '生卒年份字段'],
  ['G', '持久化与派生字段'],
  ['H', '创建后联动'],
  ['I', '婚姻记录创建'],
  ['J', '删除保护']
];
const CASES = [];

/**
 * 登记一条用例
 * @param {string} id      编号，如 A1
 * @param {string} title   场景描述
 * @param {string} expect  预期结果
 * @param {Function} fn    返回「实际结果」字符串；用 assert 断言失败即抛错
 */
function C(id, title, expect, fn) { CASES.push({ id, title, expect, fn, group: id[0] }); }

function assert(cond, msg) { if (!cond) throw new Error(msg); }

/* ───────────────── 主流程 ───────────────── */

let ZP, doc, win, state;
let _map = null;

function P(over) {
  return Object.assign({
    id: '', surname: '王', name: '', namePinyin: '',
    gender: 'M', category: 'clan', lineageType: 'clan',
    generation: 4, generationName: '志', birthOrder: null,
    birthDate: '', deathDate: '',
    fatherId: null, motherId: null, adoptiveFatherId: null, adoptiveMotherId: null,
    branchId: 'B01', nativePlace: '', occupation: '', education: '', bio: '', notes: ''
  }, over);
}

/** 校验快捷方式：返回 {errors, warnings, issues} */
async function V(over) {
  const map = await ZP.repo.personMap();
  return ZP.repo.validatePerson(P(over), map, true);
}
/** 是否存在指定字段的指定级别问题 */
function issue(res, field, level, kw) {
  return res.issues.some(i =>
    i.field === field && i.level === level && (!kw || i.msg.indexOf(kw) >= 0));
}
function errAt(res, kw) { return res.errors.some(e => !kw || e.indexOf(kw) >= 0); }

/* ═════════════════ 用例定义 ═════════════════ */

/* ── A 正常创建 ── */
C('A1', '本族男性：全部字段填满', '创建成功，sortKey 预计算，时间戳写入', async () => {
  const r = await ZP.repo.savePerson(P({
    id: 'B01-G04-008', name: '志明', namePinyin: 'zhiming', birthOrder: 4, birthDate: '1992',
    fatherId: 'B01-G03-001', motherId: 'B01-G03-004',
    nativePlace: '浙江宁波', occupation: '工程师', education: '本科', bio: '测试记录', notes: '备注'
  }), true);
  assert(r.ok, '应创建成功：' + (r.errors || []).join('；'));
  const s = await ZP.repo.getPerson('B01-G04-008');
  assert(s && s.name === '志明', '应可回读');
  assert(s.sortKey === 'B0001-G004-0004', 'sortKey 期望 B0001-G004-0004，实际 ' + s.sortKey);
  assert(s.createdAt && s.updatedAt, '时间戳应写入');
  return 'sortKey=' + s.sortKey + '；展示名=' + ZP.schema.displayName(s);
});

C('A2', '本族女性：正常入谱', '创建成功，展示名只显名', async () => {
  const r = await ZP.repo.savePerson(P({
    id: 'B01-G05-004', name: '承洁', gender: 'F', generation: 5, generationName: '承',
    birthOrder: 4, birthDate: '2018', fatherId: 'B01-G04-003', motherId: 'B01-G04-005'
  }), true);
  assert(r.ok, '应创建成功：' + (r.errors || []).join('；'));
  return '展示名=' + ZP.schema.displayName(r.person) + '；sortKey=' + r.person.sortKey;
});

C('A3', '配偶（配氏）：展示名 = 姓+氏+名', '创建成功，展示名「钱氏美凤」，排序位 9xxx', async () => {
  const r = await ZP.repo.savePerson(P({
    id: 'B01-G04-008', surname: '钱', name: '美凤', gender: 'F', category: 'spouse',
    birthOrder: 1, birthDate: '1985'
  }), true);
  assert(r.ok, '应创建成功：' + (r.errors || []).join('；'));
  assert(ZP.schema.displayName(r.person) === '钱氏美凤', '展示名应为「钱氏美凤」，实际 ' + ZP.schema.displayName(r.person));
  assert(r.person.sortKey === 'B0001-G004-9001', '配偶排序位应为 9xxx，实际 ' + r.person.sortKey);
  return '展示名=' + ZP.schema.displayName(r.person) + '；' + ZP.schema.spouseLabel(r.person);
});

C('A4', '外系成员：随母姓入谱', '创建成功，展示名保留姓氏（陈嘉禾）', async () => {
  const r = await ZP.repo.savePerson(P({
    id: 'B01-G05-004', surname: '陈', name: '嘉禾', generation: 5, generationName: '',
    birthOrder: 4, birthDate: '2015', motherId: 'B01-G04-006', lineageType: 'external'
  }), true);
  assert(r.ok, '应创建成功：' + (r.errors || []).join('；'));
  assert(ZP.schema.displayName(r.person) === '陈嘉禾', '外系应保留姓氏，实际 ' + ZP.schema.displayName(r.person));
  return '展示名=' + ZP.schema.displayName(r.person) + '；归属=外系';
});

C('A5', '外嫁女：标记为外嫁且无告警', '创建成功，无归属告警', async () => {
  const r = await ZP.repo.savePerson(P({
    id: 'B01-G05-004', name: '承娟', gender: 'F', lineageType: 'outMarried',
    generation: 5, generationName: '承', birthOrder: 4, birthDate: '2015', fatherId: 'B01-G04-003'
  }), true);
  assert(r.ok, '应创建成功：' + (r.errors || []).join('；'));
  assert(!r.warnings.some(w => w.indexOf('外嫁女') >= 0), '女性标外嫁不应告警');
  return '归属=' + r.person.lineageType + '；无告警';
});

C('A6', '最简记录：只填必填项', '创建成功，未填的父引用归一化为 null', async () => {
  const r = await ZP.repo.savePerson(P({ id: 'B01-G05-004', name: '承安', generation: 5 }), true);
  assert(r.ok, '应创建成功：' + (r.errors || []).join('；'));
  const s = await ZP.repo.getPerson('B01-G05-004');
  assert(s.fatherId === null && s.motherId === null && s.adoptiveFatherId === null, '父引用应为 null');
  assert(s.birthOrder === null, '空排行应为 null');
  return '父引用=null，排行=null，生卒空';
});

C('A7', '通过表单 UI 实际创建（端到端）', '表单落库，ID 自动生成，回调触发', async () => {
  let done = false;
  ZP.views.memberForm.open(null, ZP.app.state, function () { done = true; });
  const form = doc.querySelector('#mfForm');
  assert(form, '表单应渲染');
  const set = (n, v) => {
    const el = form.elements[n];
    el.value = v;
    el.dispatchEvent(new win.Event('input', { bubbles: true }));
    el.dispatchEvent(new win.Event('change', { bubbles: true }));
  };
  set('surname', '王'); set('name', '承霖'); set('generation', '5');
  set('generationName', '承'); set('birthOrder', '4'); set('birthDate', '2019');
  set('fatherId', 'B01-G04-003');
  await sleep(30);
  const newId = form.elements.id.value;
  assert(/^B01-G05-\d{3}$/.test(newId), '自动 ID 格式应为 B01-G05-xxx，实际 ' + newId);
  doc.querySelector('#mfSave').dispatchEvent(new win.Event('click', { bubbles: true }));
  await sleep(150);
  const s = await ZP.repo.getPerson(newId);
  assert(s && s.name === '承霖', '表单创建应落库');
  assert(done, 'onDone 回调应触发');
  ZP.ui.closeModal();
  return '生成 ID=' + newId + '，已落库，回调已触发';
});

/* ── B ID 规则 ── */
C('B1', '自动生成：新房支/新世次从 001 起', 'nextPersonId(B04,1) = B04-G01-001', async () => {
  const id = ZP.schema.nextPersonId('B04', 1, ZP.app.state.persons);
  assert(id === 'B04-G01-001', '期望 B04-G01-001，实际 ' + id);
  return id;
});

C('B2', '自动生成：同房同世次递增', 'nextPersonId(B01,4) = B01-G04-008', async () => {
  const id = ZP.schema.nextPersonId('B01', 4, ZP.app.state.persons);
  assert(id === 'B01-G04-008', '期望 B01-G04-008，实际 ' + id);
  return id;
});

C('B3', '自定义 ID 不合推荐格式', '不阻断保存，仅给出格式提醒', async () => {
  const r = await ZP.repo.savePerson(P({ id: 'TEMP001', name: '测试' }), true);
  assert(r.ok, '不应阻断保存');
  assert(r.warnings.some(w => w.indexOf('建议采用') >= 0), '应有格式提醒');
  return '已保存，提醒：' + r.warnings[0];
});

C('B4', 'ID 与既有记录重复', '阻断保存并提示已存在', async () => {
  const r = await ZP.repo.savePerson(P({ id: 'B01-G04-001', name: '重复者' }), true);
  assert(!r.ok, '应阻断');
  assert(errAt(r, '已存在'), '应提示 ID 已存在');
  return r.errors[0];
});

C('B5', 'ID 留空', '阻断保存并提示不能为空', async () => {
  const r = await ZP.repo.savePerson(P({ id: '', name: '无号者' }), true);
  assert(!r.ok, '应阻断');
  assert(errAt(r, 'ID 不能为空'), '应提示 ID 不能为空');
  return r.errors[0];
});

C('B6', '编辑既有记录（ID 与自身相同）', '视为合法，不误报 ID 重复', async () => {
  const old = (await ZP.repo.personMap()).get('B01-G04-001');
  const r = await ZP.repo.savePerson(Object.assign({}, old, { occupation: '工程师（改）' }), false);
  assert(r.ok, '不应误判重复：' + (r.errors || []).join('；'));
  const s = await ZP.repo.getPerson('B01-G04-001');
  assert(s.occupation === '工程师（改）', '修改应落库');
  return '更新成功，无 ID 冲突';
});

/* ── C 必填与取值校验 ── */
C('C1', '姓名为空', '错误级：名字不能为空', async () => {
  const r = await V({ id: 'B01-G04-008', name: '' });
  assert(errAt(r, '名字'), '应报名字缺失');
  return r.errors.join('；');
});

C('C2', '姓氏为空', '错误级：姓氏不能为空', async () => {
  const r = await V({ id: 'B01-G04-008', surname: '', name: '某' });
  assert(errAt(r, '姓氏'), '应报姓氏缺失');
  return r.errors.join('；');
});

C('C3', '性别取非法值', '错误级：请选择性别', async () => {
  const r = await V({ id: 'B01-G04-008', name: '某', gender: 'X' });
  assert(errAt(r, '性别'), '应报性别非法');
  return r.errors.join('；');
});

C('C4', '成员分类取非法值', '错误级：请选择成员分类', async () => {
  const r = await V({ id: 'B01-G04-008', name: '某', category: 'other' });
  assert(errAt(r, '成员分类'), '应报分类非法');
  return r.errors.join('；');
});

C('C5', '世次为 0', '错误级：世次必须为不小于 1 的整数', async () => {
  const r = await V({ id: 'B01-G04-008', name: '某', generation: 0 });
  assert(errAt(r, '世次'), '应报世次非法');
  return r.errors.join('；');
});

C('C6', '世次为负数', '错误级：拦截', async () => {
  const r = await V({ id: 'B01-G04-008', name: '某', generation: -3 });
  assert(errAt(r, '世次'), '应报世次非法');
  return r.errors.join('；');
});

C('C7', '世次为小数', '错误级：拦截', async () => {
  const r = await V({ id: 'B01-G04-008', name: '某', generation: 2.5 });
  assert(errAt(r, '世次'), '应报世次非法');
  return r.errors.join('；');
});

C('C8', '世次留空', '错误级：拦截', async () => {
  const r = await V({ id: 'B01-G04-008', name: '某', generation: '' });
  assert(errAt(r, '世次'), '应报世次非法');
  return r.errors.join('；');
});

/* ── D 亲属关系与防循环 ── */
C('D1', '把自己设为生父', '错误级：不能把自己设为生父', async () => {
  const r = await ZP.repo.savePerson(P({ id: 'B01-G04-008', name: '甲', fatherId: 'B01-G04-008' }), true);
  assert(!r.ok, '应阻断');
  assert(errAt(r, '不能把自己设为生父'), '应提示自指');
  return r.errors[0];
});

C('D2', '把自己设为嗣父', '错误级：不能把自己设为嗣父', async () => {
  const r = await ZP.repo.savePerson(P({ id: 'B01-G04-008', name: '甲', adoptiveFatherId: 'B01-G04-008' }), true);
  assert(!r.ok, '应阻断');
  assert(errAt(r, '不能把自己设为嗣父'), '应提示自指');
  return r.errors[0];
});

C('D3', '认自己的后代为生父（成环）', '错误级：关系成环', async () => {
  const old = (await ZP.repo.personMap()).get('B01-G01-001');
  const r = await ZP.repo.savePerson(Object.assign({}, old, { fatherId: 'B01-G04-001' }), false);
  assert(!r.ok, '应阻断');
  assert(errAt(r, '成环'), '应提示成环');
  return r.errors[0];
});

C('D4', '认自己的儿子为嗣父（成环）', '错误级：关系成环', async () => {
  const old = (await ZP.repo.personMap()).get('B01-G03-001');
  const r = await ZP.repo.savePerson(Object.assign({}, old, { adoptiveFatherId: 'B01-G04-001' }), false);
  assert(!r.ok, '应阻断');
  assert(errAt(r, '成环'), '应提示成环');
  return r.errors[0];
});

C('D5', '合法绑定生父 + 生母', '创建成功，无错误', async () => {
  const r = await ZP.repo.savePerson(P({
    id: 'B01-G04-008', name: '志远', generation: 4,
    fatherId: 'B01-G03-001', motherId: 'B01-G03-004'
  }), true);
  assert(r.ok, '应创建成功：' + (r.errors || []).join('；'));
  return '已绑定 生父=建国 / 生母=刘氏淑珍';
});

C('D6', '编辑时把父改为自己的女儿（成环）', '错误级：关系成环', async () => {
  const old = (await ZP.repo.personMap()).get('B01-G04-003');   // 志刚
  const r = await ZP.repo.savePerson(Object.assign({}, old, { fatherId: 'B01-G05-002' }), false); // 承悦
  assert(!r.ok, '应阻断');
  assert(errAt(r, '成环'), '应提示成环');
  return r.errors[0];
});

/* ── E 告警级校验 ── */
C('E1', '生父指向女性', '提醒级：性别不符，不阻断', async () => {
  const r = await V({ id: 'B01-G04-008', name: '某', fatherId: 'B01-G02-002' });
  assert(r.errors.length === 0, '不应阻断');
  assert(issue(r, 'fatherId', 'warn', '性别'), '应有性别提醒');
  return r.warnings.join('；');
});

C('E2', '生母指向男性', '提醒级：性别不符，不阻断', async () => {
  const r = await V({ id: 'B01-G04-008', name: '某', motherId: 'B01-G02-001' });
  assert(r.errors.length === 0, '不应阻断');
  assert(issue(r, 'motherId', 'warn', '性别'), '应有性别提醒');
  return r.warnings.join('；');
});

C('E3', '世次与父母不符', '提醒级：提示应为第 N+1 世，不阻断', async () => {
  const r = await V({ id: 'B01-G09-001', name: '某', generation: 9, fatherId: 'B01-G03-002' });
  assert(r.errors.length === 0, '不应阻断');
  assert(issue(r, 'fatherId', 'warn', '应为第 4 世'), '应提示正确世次');
  return r.warnings.join('；');
});

C('E4', '生父与嗣父为同一人', '提醒级：建议留空，不阻断', async () => {
  const r = await V({ id: 'B01-G04-008', name: '某', fatherId: 'B01-G03-002', adoptiveFatherId: 'B01-G03-002' });
  assert(r.errors.length === 0, '不应阻断');
  assert(issue(r, 'adoptiveFatherId', 'warn'), '应有重复提醒');
  return r.warnings.join('；');
});

C('E5', '把男性标为外嫁女', '提醒级：归属可能填错，不阻断', async () => {
  const r = await V({ id: 'B01-G04-008', name: '某', gender: 'M', lineageType: 'outMarried' });
  assert(r.errors.length === 0, '不应阻断');
  assert(issue(r, 'lineageType', 'warn'), '应有归属提醒');
  return r.warnings.join('；');
});

/* ── F 生卒年份 ── */
C('F1', '卒年早于生年', '提醒级：请核对，不阻断', async () => {
  const r = await V({ id: 'B01-G04-008', name: '某', birthDate: '1980', deathDate: '1970' });
  assert(issue(r, 'deathDate', 'warn', '早于出生年'), '应有年份倒置提醒');
  return r.warnings.join('；');
});

C('F2', '出生年无法识别（待考）', '提醒级：建议形如 1932', async () => {
  const r = await V({ id: 'B01-G04-008', name: '某', birthDate: '待考' });
  assert(issue(r, 'birthDate', 'warn'), '应有识别失败提醒');
  return r.warnings.join('；');
});

C('F3', '去世年无法识别', '提醒级：给出格式建议', async () => {
  const r = await V({ id: 'B01-G04-008', name: '某', deathDate: '不详' });
  assert(issue(r, 'deathDate', 'warn'), '应有识别失败提醒');
  return r.warnings.join('；');
});

C('F4', '年份多种写法均能解析', '"1932" / "1932-05" / "1932.5" / "1932年" 均不告警', async () => {
  for (const v of ['1932', '1932-05', '1932.5', '1932年']) {
    const r = await V({ id: 'B01-G04-008', name: '某', birthDate: v });
    assert(!issue(r, 'birthDate', 'warn'), '「' + v + '」不应告警');
  }
  return '4 种写法全部通过';
});

C('F5', '未填卒年 = 在世', '无告警，deathDate 为空', async () => {
  const r = await ZP.repo.savePerson(P({ id: 'B01-G04-008', name: '在世者', birthDate: '1990' }), true);
  assert(r.ok, '应创建成功');
  assert(!r.person.deathDate, '卒年应为空');
  return '出生=1990，卒年留空（在世）';
});

/* ── G 持久化与派生 ── */
C('G1', 'sortKey 自动预计算（本族 / 配偶）', '本族 0001 段，配偶 9001 段', async () => {
  const a = await ZP.repo.savePerson(P({ id: 'B01-G04-008', name: '甲', birthOrder: 5 }), true);
  const b = await ZP.repo.savePerson(P({ id: 'B01-G04-009', surname: '钱', name: '乙', gender: 'F', category: 'spouse', birthOrder: 1 }), true);
  assert(a.person.sortKey === 'B0001-G004-0005', '本族 sortKey 异常：' + a.person.sortKey);
  assert(b.person.sortKey === 'B0001-G004-9001', '配偶 sortKey 异常：' + b.person.sortKey);
  return a.person.sortKey + ' / ' + b.person.sortKey;
});

C('G2', '列表排序：配偶排在同世次本族之后', '本族在前、配偶在后', async () => {
  await ZP.repo.savePerson(P({ id: 'B01-G04-008', surname: '钱', name: '美凤', gender: 'F', category: 'spouse', birthOrder: 1 }), true);
  const list = await ZP.repo.listPersons();
  const g4 = list.filter(p => p.branchId === 'B01' && Number(p.generation) === 4);
  const lastClan = g4.map(p => p.category).lastIndexOf('clan');
  const firstSpouse = g4.findIndex(p => p.category === 'spouse');
  assert(lastClan >= 0 && firstSpouse > lastClan,
    '配偶应排在本族之后（本族末位 ' + lastClan + '，配偶首位 ' + firstSpouse + '）');
  return '第 4 世：本族 ' + (lastClan + 1) + ' 人，配偶自第 ' + (firstSpouse + 1) + ' 位起';
});

C('G3', '空引用归一化', '空的父/嗣父引用写为 null', async () => {
  const r = await ZP.repo.savePerson(P({ id: 'B01-G04-008', name: '甲', fatherId: '', adoptiveFatherId: '' }), true);
  const s = await ZP.repo.getPerson('B01-G04-008');
  assert(s.fatherId === null && s.adoptiveFatherId === null, '空串应转 null');
  return 'fatherId=null，adoptiveFatherId=null';
});

C('G4', '排行字段类型', '留空 → null；填写 → 数字', async () => {
  await ZP.repo.savePerson(P({ id: 'B01-G04-008', name: '甲', birthOrder: '' }), true);
  await ZP.repo.savePerson(P({ id: 'B01-G04-009', name: '乙', birthOrder: '7' }), true);
  const a = await ZP.repo.getPerson('B01-G04-008');
  const b = await ZP.repo.getPerson('B01-G04-009');
  assert(a.birthOrder === null, '空排行应为 null');
  assert(b.birthOrder === 7, '填写的排行应为数字，实际 ' + typeof b.birthOrder);
  return '空=null，填写=7(number)';
});

C('G5', '编辑时时间戳处理', 'createdAt 保留，updatedAt 刷新', async () => {
  const before = await ZP.repo.getPerson('B01-G04-001');
  await sleep(5);
  const r = await ZP.repo.savePerson(Object.assign({}, before, { occupation: '改' }), false);
  const after = await ZP.repo.getPerson('B01-G04-001');
  assert(after.createdAt === before.createdAt, 'createdAt 应保留');
  assert(after.updatedAt >= before.updatedAt, 'updatedAt 应刷新');
  return 'createdAt 保留，updatedAt ' + (after.updatedAt > before.updatedAt ? '已刷新' : '同刻');
});

C('G6', '模拟关闭重开后数据仍在', '刷新后记录仍可读取', async () => {
  await ZP.repo.savePerson(P({ id: 'B01-G04-008', name: '持久者' }), true);
  await ZP.app.refresh();
  const s = await ZP.repo.getPerson('B01-G04-008');
  assert(s && s.name === '持久者', '刷新后应仍存在');
  return '刷新后仍可读取，列表 ' + ZP.app.state.persons.length + ' 人';
});

/* ── H 创建后联动 ── */
C('H1', '新建后父子关系生效', 'childrenOf(志刚) 含新建子女', async () => {
  await ZP.repo.savePerson(P({ id: 'B01-G05-004', name: '承洁', gender: 'F', generation: 5, birthOrder: 4, fatherId: 'B01-G04-003' }), true);
  const kids = await ZP.repo.childrenOf('B01-G04-003');
  assert(kids.some(k => k.id === 'B01-G05-004'), '子女列表应含新建成员');
  return '志刚名下子女：' + kids.map(k => k.name).join('、');
});

C('H2', '新建后称谓可推算', '志强 → 新建侄女，推算为「侄女」', async () => {
  await ZP.repo.savePerson(P({ id: 'B01-G05-004', name: '承洁', gender: 'F', generation: 5, birthOrder: 4, fatherId: 'B01-G04-003' }), true);
  const map = await ZP.repo.personMap();
  const term = ZP.lineage.kinship('B01-G04-001', 'B01-G05-004', map);
  assert(term === '侄女', '期望「侄女」，实际 ' + term);
  return '志强 → 承洁 = ' + term;
});

C('H3', '新建后世系图归属正确', '新成员出现在其父节点之下', async () => {
  await ZP.repo.savePerson(P({ id: 'B01-G05-004', name: '承洁', gender: 'F', generation: 5, birthOrder: 4, fatherId: 'B01-G04-003' }), true);
  await ZP.app.refresh();
  const roots = ZP.app.state.genesis;
  const find = (id, nodes) => {
    for (const n of nodes) { if (n.id === id) return n; const g = find(id, n.children); if (g) return g; }
    return null;
  };
  const dad = find('B01-G04-003', roots);
  assert(dad.children.some(c => c.id === 'B01-G05-004'), '应挂在志刚名下');
  return '志刚之子女 ' + dad.children.length + ' 人（含新建）';
});

C('H4', '新建后统计数 +1', 'stats().persons 增加 1', async () => {
  const before = (await ZP.repo.stats()).persons;
  await ZP.repo.savePerson(P({ id: 'B01-G04-008', name: '甲' }), true);
  const after = (await ZP.repo.stats()).persons;
  assert(after === before + 1, '统计应从 ' + before + ' 增至 ' + (before + 1) + '，实际 ' + after);
  return before + ' → ' + after;
});

/* ── I 婚姻记录创建 ── */
C('I1', '正常嫁娶', '创建成功，order 默认 1', async () => {
  await ZP.repo.savePerson(P({ id: 'B01-G04-008', name: '志明', fatherId: 'B01-G03-001' }), true);
  await ZP.repo.savePerson(P({ id: 'B01-G04-009', surname: '钱', name: '美凤', gender: 'F', category: 'spouse', birthOrder: 1 }), true);
  const r = await ZP.repo.saveMarriage({ husbandId: 'B01-G04-008', wifeId: 'B01-G04-009', type: 'marry', startYear: '2020' });
  assert(r.ok, '应创建成功：' + (r.errors || []).join('；'));
  assert(r.marriage.order === 1, '默认次序应为 1');
  return '婚后记录 id=' + r.marriage.id + '，次序 ' + r.marriage.order;
});

C('I2', '多配偶：同一人第二条婚姻', '创建成功，次序 3 生效', async () => {
  await ZP.repo.savePerson(P({ id: 'B01-G02-004', surname: '孙', name: '玉兰', gender: 'F', category: 'spouse', generation: 2, birthOrder: 3, birthDate: '1950' }), true);
  const r = await ZP.repo.saveMarriage({ husbandId: 'B01-G02-001', wifeId: 'B01-G02-004', type: 'marry', order: 3, startYear: '2000' });
  assert(r.ok, '应创建成功：' + (r.errors || []).join('；'));
  const list = await ZP.repo.marriagesOf('B01-G02-001');
  assert(list.length === 3, '德福应共有 3 段婚姻，实际 ' + list.length);
  return '德福婚姻数 ' + list.length + '，次序 ' + list.map(m => m.order).join('/');
});

C('I3', '入赘婚姻', '创建成功，类型 ruzhui', async () => {
  await ZP.repo.savePerson(P({ id: 'B01-G04-008', surname: '郑', name: '大伟', gender: 'M', category: 'spouse', birthOrder: 1, birthDate: '1986' }), true);
  const r = await ZP.repo.saveMarriage({ husbandId: 'B01-G04-008', wifeId: 'B01-G04-006', type: 'ruzhui', startYear: '2012' });
  assert(r.ok, '应创建成功：' + (r.errors || []).join('；'));
  assert(r.marriage.type === 'ruzhui', '类型应为 ruzhui');
  return '赘婿=郑氏大伟 → 志敏，类型 ' + ZP.schema.LABELS.marriageType[r.marriage.type];
});

C('I4', '出赘婚姻', '创建成功，类型 chuzhui', async () => {
  await ZP.repo.savePerson(P({ id: 'B02-G04-007', surname: '林', name: '小云', gender: 'F', category: 'spouse', birthOrder: 2, birthDate: '1992', branchId: 'B02' }), true);
  const r = await ZP.repo.saveMarriage({ husbandId: 'B02-G04-003', wifeId: 'B02-G04-007', type: 'chuzhui', order: 2, startYear: '2018' });
  assert(r.ok, '应创建成功：' + (r.errors || []).join('；'));
  return '志安出赘，类型 ' + ZP.schema.LABELS.marriageType[r.marriage.type];
});

C('I5', '离异状态', '创建成功，status=divorced', async () => {
  await ZP.repo.savePerson(P({ id: 'B02-G04-007', surname: '林', name: '小云', gender: 'F', category: 'spouse', birthOrder: 2, birthDate: '1992', branchId: 'B02' }), true);
  const r = await ZP.repo.saveMarriage({
    husbandId: 'B02-G04-001', wifeId: 'B02-G04-007', type: 'marry', order: 2,
    status: 'divorced', startYear: '2013', endYear: '2016'
  });
  assert(r.ok, '应创建成功：' + (r.errors || []).join('；'));
  return '状态=' + ZP.schema.LABELS.marriageStatus[r.marriage.status];
});

C('I6', '重复婚姻（同序）', '阻断：婚姻记录已存在', async () => {
  const r = await ZP.repo.saveMarriage({ husbandId: 'B01-G02-001', wifeId: 'B01-G02-002', type: 'marry' });
  assert(!r.ok, '应阻断');
  assert(r.errors.some(e => e.indexOf('已存在') >= 0), '应提示已存在');
  return r.errors[0];
});

C('I7', '重复婚姻（夫妻换序）', '阻断：无序对判重', async () => {
  const r = await ZP.repo.saveMarriage({ husbandId: 'B01-G02-002', wifeId: 'B01-G02-001', type: 'marry' });
  assert(!r.ok, '换序也应阻断');
  assert(r.errors.some(e => e.indexOf('已存在') >= 0), '应提示已存在');
  return r.errors[0];
});

C('I8', '夫妻为同一人', '阻断：夫妻不能是同一人', async () => {
  const r = await ZP.repo.saveMarriage({ husbandId: 'B01-G04-001', wifeId: 'B01-G04-001', type: 'marry' });
  assert(!r.ok, '应阻断');
  assert(r.errors.some(e => e.indexOf('同一人') >= 0), '应提示同一人');
  return r.errors[0];
});

C('I9', '缺一方（未选妻）', '阻断：夫妻双方都必须选择', async () => {
  const r = await ZP.repo.saveMarriage({ husbandId: 'B01-G04-001', wifeId: '', type: 'marry' });
  assert(!r.ok, '应阻断');
  assert(r.errors.some(e => e.indexOf('双方都必须选择') >= 0), '应提示缺一方');
  return r.errors[0];
});

C('I10', '配偶不存在', '阻断：提示成员不存在', async () => {
  const r = await ZP.repo.saveMarriage({ husbandId: 'B01-G04-001', wifeId: 'B01-G99-999', type: 'marry' });
  assert(!r.ok, '应阻断');
  assert(r.errors.some(e => e.indexOf('不存在') >= 0), '应提示不存在');
  return r.errors[0];
});

C('I11', '夫为女性 / 妻为男性', '提醒级：与「夫男妻女」不符', async () => {
  const r = await ZP.repo.saveMarriage({ husbandId: 'B01-G02-003', wifeId: 'B01-G03-002', type: 'marry' });
  assert(r.ok, '不应阻断');
  assert(r.warnings.some(w => w.indexOf('性别') >= 0), '应有性别提醒');
  return r.warnings.join('；');
});

C('I12', '结束年早于起始年', '提醒级：请核对', async () => {
  await ZP.repo.savePerson(P({ id: 'B01-G04-008', name: '志明', fatherId: 'B01-G03-001' }), true);
  await ZP.repo.savePerson(P({ id: 'B01-G04-009', surname: '钱', name: '美凤', gender: 'F', category: 'spouse', birthOrder: 1 }), true);
  const r = await ZP.repo.saveMarriage({
    husbandId: 'B01-G04-008', wifeId: 'B01-G04-009', type: 'marry', startYear: '2020', endYear: '1990'
  });
  assert(r.ok, '不应阻断：' + (r.errors || []).join('；'));
  assert(r.warnings.some(w => w.indexOf('早于起始年') >= 0), '应有年份倒置提醒');
  return r.warnings.join('；');
});

C('I13', '起始年早于出生年', '提醒级：请核对', async () => {
  await ZP.repo.savePerson(P({ id: 'B01-G04-009', surname: '钱', name: '美凤', gender: 'F', category: 'spouse', birthOrder: 1, birthDate: '1995' }), true);
  const r = await ZP.repo.saveMarriage({
    husbandId: 'B01-G04-001', wifeId: 'B01-G04-009', type: 'marry', startYear: '1990'
  });
  assert(r.ok, '不应阻断');
  assert(r.warnings.some(w => w.indexOf('早于妻方出生年') >= 0 || w.indexOf('早于夫方出生年') >= 0), '应有出生年提醒');
  return r.warnings.join('；');
});

/* ── J 删除保护 ── */
C('J1', '删除有子女者', '拒绝：列出子女引用', async () => {
  const r = await ZP.repo.deletePerson('B01-G02-001');
  assert(!r.ok, '应拒绝');
  assert(r.errors[0].indexOf('以他为父母') >= 0, '应列出子女引用');
  return r.errors[0];
});

C('J2', '删除有婚姻者', '拒绝：列出婚姻记录', async () => {
  const r = await ZP.repo.deletePerson('B01-G04-004');
  assert(!r.ok, '应拒绝');
  assert(r.errors.some(e => e.indexOf('婚姻记录') >= 0), '应列出婚姻引用');
  return r.errors.join('；');
});

C('J3', '删除无引用者', '允许删除', async () => {
  await ZP.repo.savePerson(P({ id: 'B01-G04-008', name: '临时者' }), true);
  const r = await ZP.repo.deletePerson('B01-G04-008');
  assert(r.ok, '应允许删除');
  const gone = await ZP.repo.getPerson('B01-G04-008');
  assert(!gone, '删除后应查不到');
  return '已删除，无残留';
});

/* ───────────────── 运行 ───────────────── */

async function resetAll() {
  await ZP.repo.resetToSeed();
  await ZP.app.refresh();
  try { ZP.ui.closeModal(); } catch (e) { /* 无弹层时忽略 */ }
  _map = null;
}

async function main() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/zupu/', runScripts: 'outside-only', pretendToBeVisual: true });
  win = dom.window;
  doc = win.document;

  const idbImpl = await loadFakeIDB();
  if (!idbImpl) throw new Error('fake-indexeddb 不可用');
  win.indexedDB = idbImpl.indexedDB;
  win.IDBKeyRange = idbImpl.IDBKeyRange;
  win.HTMLCanvasElement.prototype.getContext = function () { return makeCtxStub(); };

  FILES.forEach(function (f) { win.eval(fs.readFileSync(path.join(ROOT, f), 'utf8')); });

  ZP = win.ZP;
  await ZP.app.boot();
  state = ZP.app.state;

  const results = [];
  for (const c of CASES) {
    await resetAll();
    let ok = false, detail = '';
    try {
      detail = await c.fn();
      ok = true;
    } catch (e) {
      detail = e && e.message ? e.message : String(e);
    }
    results.push({ id: c.id, group: c.group, title: c.title, expect: c.expect, ok: ok, detail: detail });
    console.log((ok ? '  ✓ ' : '  ✗ ') + c.id + ' ' + c.title + (ok ? '' : '\n      → ' + detail));
  }

  const pass = results.filter(r => r.ok).length;
  const fail = results.length - pass;
  console.log('\n──────────────────────────');
  console.log('用例 ' + results.length + ' 条：通过 ' + pass + '，失败 ' + fail);

  // 分场景失败信息
  if (fail) {
    console.log('\n失败明细：');
    results.filter(r => !r.ok).forEach(r => console.log('  ✗ ' + r.id + ' ' + r.title + ' → ' + r.detail));
  }

  /* ── 输出报告 ── */
  const now = new Date();
  const stamp = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0') + ' ' + String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0');
  let md = '# 单条数据创建 · 场景用例与执行报告\n\n';
  md += '> 自动生成，请勿手工编辑。生成脚本：`tests/create-cases.js`\n\n';
  md += '- 执行时间：' + stamp + '\n';
  md += '- 数据基线：`src/db/seed.js` 种子数据（3 房支 / 6 世代 / ' + ZP.SEED.persons.length + ' 人 / ' + ZP.SEED.marriages.length + ' 条婚姻）\n';
  md += '- 每条用例执行前重置为种子状态，互不影响\n';
  md += '- 结果：**用例 ' + results.length + ' 条，通过 ' + pass + '，失败 ' + fail + '**\n\n';
  md += '## 一、总览\n\n| 场景分类 | 用例数 | 通过 | 失败 |\n|---|---:|---:|---:|\n';
  GROUPS.forEach(function (g) {
    const rs = results.filter(r => r.group === g[0]);
    if (!rs.length) return;
    md += '| ' + g[0] + ' ' + g[1] + ' | ' + rs.length + ' | ' + rs.filter(r => r.ok).length + ' | ' + rs.filter(r => !r.ok).length + ' |\n';
  });
  md += '\n## 二、用例明细\n';
  GROUPS.forEach(function (g) {
    const rs = results.filter(r => r.group === g[0]);
    if (!rs.length) return;
    md += '\n### ' + g[0] + ' · ' + g[1] + '\n\n';
    md += '| 编号 | 场景 | 预期结果 | 实测结果 | 结论 |\n|---|---|---|---|:--:|\n';
    rs.forEach(function (r) {
      md += '| ' + r.id + ' | ' + esc(r.title) + ' | ' + esc(r.expect) + ' | ' + esc(r.detail) + ' | ' +
        (r.ok ? '✅' : '❌') + ' |\n';
    });
  });
  md += '\n## 三、覆盖说明\n\n';
  md += '- **错误级（阻断保存）**：必填缺失、ID 重复/留空、世次非法、自指与关系成环、婚姻缺方/同一人/重复/对象不存在\n';
  md += '- **提醒级（不阻断）**：父母性别不符、世次与父母不符、生父=嗣父、外嫁女性别、生卒年倒置或无法识别、婚姻年份异常、夫男妻女不符\n';
  md += '- **派生与持久化**：sortKey（本族 0001 段 / 配偶 9001 段）、展示名（配氏 / 外系）、父子关系、称谓推算、世系归属、统计计数、时间戳\n';
  md += '- **端到端**：A7 用例通过真实表单交互创建，覆盖 ID 预填 → 填写 → 提交 → 落库 → 回调全链路\n';
  md += '- 已在报告中固定结论：失败用例会在「实测结果」列给出具体原因，便于直接定位。\n';

  fs.writeFileSync(REPORT, md, 'utf8');
  console.log('报告已写入：' + REPORT);

  process.exit(fail ? 1 : 0);

  function esc(s) { return String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' '); }
}

main().catch(function (err) {
  console.error('用例执行异常终止：', err);
  process.exit(2);
});
