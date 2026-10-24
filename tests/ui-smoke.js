/**
 * UI / 数据链路冒烟测试
 * 在 jsdom 中加载 index.html 骨架，注入 fake-indexeddb，执行全部前端脚本，
 * 然后走一遍：启动建库 → 列表渲染 → 新增/校验/删除保护 → 婚姻 → 世系图 → 数据视图 → 导出导入。
 *
 * 运行：
 *   NODE_PATH=<workspace>/node_modules node tests/ui-smoke.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const FILES = [
  'src/db/schema.js', 'src/db/seed.js', 'src/db/idb.js', 'src/db/repo.js', 'src/db/lineage.js',
  'src/ui/util.js',
  'src/ui/views/member-list.js', 'src/ui/views/member-form.js', 'src/ui/views/tree.js', 'src/ui/views/data.js',
  'src/ui/app.js'
];

let pass = 0, fail = 0;
function ok(cond, label, extra) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + (extra ? '\n      ' + extra : '')); }
}
function eq(a, b, label) { ok(a === b, label, '期望 ' + JSON.stringify(b) + '，实际 ' + JSON.stringify(a)); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** 轮询等待条件成立（分批渲染等跨帧场景，固定 sleep 在机器繁忙时会误判） */
async function waitFor(pred, timeout) {
  const t0 = Date.now();
  while (Date.now() - t0 < (timeout || 2000)) {
    if (pred()) return true;
    await sleep(25);
  }
  return false;
}

function makeCtxStub() {
  const store = { __calls: {} };      // 记录调用次数，供「是否真的画了东西」断言使用
  return new Proxy(store, {
    get(t, k) {
      if (k === 'measureText') return () => ({ width: 12 });
      if (k === 'canvas') return null;
      if (k in t) return t[k];
      return function () { t.__calls[k] = (t.__calls[k] || 0) + 1; };
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
  try { const r = grab(require('fake-indexeddb/lib/FDBFactory') && { FDBFactory: require('fake-indexeddb/lib/FDBFactory'), IDBKeyRange: require('fake-indexeddb/lib/FDBKeyRange') }); if (r) return r; } catch (e) { /* fallthrough */ }
  const m = await import('fake-indexeddb');
  return grab(m);
}

async function main() {
  /* ── 1. 环境搭建 ── */
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dom = new JSDOM(html, {
    url: 'http://localhost/zupu/',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const win = dom.window;

  const idbImpl = await loadFakeIDB();
  if (!idbImpl) throw new Error('fake-indexeddb 不可用');
  win.indexedDB = idbImpl.indexedDB;
  win.IDBKeyRange = idbImpl.IDBKeyRange;

  // 同一 canvas 复用同一个 ctx stub，便于统计绘制调用
  win.HTMLCanvasElement.prototype.getContext = function () {
    if (!this.__ctx) this.__ctx = makeCtxStub();
    return this.__ctx;
  };

  // 在 jsdom 自身的执行环境里跑脚本，保证 window / document 与 DOM 对象同 realm
  FILES.forEach(function (f) {
    win.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  });

  const ZP = win.ZP;
  const doc = win.document;
  ok(ZP && ZP.app && ZP.repo && ZP.views, '全部脚本加载并挂载 ZP 命名空间');

  /* ── 2. 启动 ── */
  console.log('\n[1] 启动建库与种子载入');
  await ZP.app.boot();
  const state = ZP.app.state;
  const N_PERSON = ZP.SEED.persons.length;
  const N_MARRY = ZP.SEED.marriages.length;
  const N_BRANCH = ZP.SEED.branches.length;
  eq(state.persons.length, N_PERSON, '种子载入 ' + N_PERSON + ' 名成员');
  eq(state.marriages.length, N_MARRY, '种子载入 ' + N_MARRY + ' 条婚姻');
  eq(state.branches.length, N_BRANCH, '种子载入 ' + N_BRANCH + ' 个房支');
  eq(doc.querySelector('#statPersons').textContent, String(N_PERSON), '顶栏统计：成员 ' + N_PERSON);
  eq(doc.querySelector('#brandName').textContent, '示例宗族（虚构）', '顶栏显示宗族名');

  console.log('\n[2] 成员列表渲染');
  const rows = doc.querySelectorAll('#mlTableWrap tbody tr');
  eq(rows.length, N_PERSON, '表格渲染 ' + N_PERSON + ' 行');
  const firstRow = rows[0].textContent;
  ok(firstRow.indexOf('守义') >= 0, '首行为始祖守义', firstRow.slice(0, 40));
  ok(doc.querySelector('#mlTableWrap').textContent.indexOf('配李氏秀英') >= 0, '德福行展示配偶「配李氏秀英」');
  ok(doc.querySelector('#mlTableWrap').textContent.indexOf('嗣父') >= 0, '志强行标注嗣父');

  // 行内按钮走事件委托（分批渲染下不再逐行绑定）
  const viewBtn = doc.querySelector('#mlTableWrap [data-act="view"]');
  viewBtn.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  const dlg = doc.querySelector('.modal');
  ok(dlg && dlg.textContent.indexOf('成员详情') >= 0, '行内「详情」按钮经事件委托打开详情弹层');
  ZP.ui.closeModal();

  console.log('\n[3] 检索与筛选');
  const search = doc.querySelector('#mlSearch');
  const hitRows = () => Array.from(doc.querySelectorAll('#mlTableWrap tbody tr')).map(tr => tr.textContent);
  async function doSearch(kw) {
    search.value = kw;
    search.dispatchEvent(new win.Event('input', { bubbles: true }));
    await sleep(320);
  }

  await doSearch('建国');
  ok(hitRows().some(t => t.indexOf('建国') >= 0), '搜索「建国」命中本人');
  ok(hitRows().some(t => t.indexOf('过继给建国') >= 0), '备注中提到「建国」的成员同样被检索到');

  await doSearch('宁波');
  eq(doc.querySelectorAll('#mlTableWrap tbody tr').length, 1, '按籍贯「宁波」命中始祖');

  await doSearch('建');
  ok(doc.querySelectorAll('#mlTableWrap tbody tr').length >= 3, '按字辈「建」命中第 3 世全员');

  await doSearch('不存在的人');
  ok(doc.querySelector('#mlClearFilter'), '无结果时提供「清除筛选条件」入口');
  doc.querySelector('#mlClearFilter').dispatchEvent(new win.Event('click', { bubbles: true }));
  await sleep(60);
  eq(doc.querySelectorAll('#mlTableWrap tbody tr').length, N_PERSON, '清除筛选后恢复全量');

  search.value = '';
  search.dispatchEvent(new win.Event('input', { bubbles: true }));
  await sleep(320);

  const branchSel = doc.querySelector('#mlBranch');
  branchSel.value = 'B02';
  branchSel.dispatchEvent(new win.Event('change', { bubbles: true }));
  const b02 = ZP.SEED.persons.filter(p => p.branchId === 'B02').length;
  eq(doc.querySelectorAll('#mlTableWrap tbody tr').length, b02, '筛选二房命中 ' + b02 + ' 行');
  branchSel.value = '';
  branchSel.dispatchEvent(new win.Event('change', { bubbles: true }));

  /* ── 3. 写入链路 ── */
  console.log('\n[4] 新增成员');
  const newRec = {
    id: 'B01-G04-008', surname: '王', name: '志明', namePinyin: 'zhiming',
    gender: 'M', category: 'clan', lineageType: 'clan',
    generation: 4, generationName: '志', birthOrder: 8, birthDate: '1992',
    fatherId: 'B01-G03-002', motherId: null, adoptiveFatherId: null, adoptiveMotherId: null,
    branchId: 'B01', nativePlace: '', occupation: '', education: '', bio: '', notes: ''
  };
  let r = await ZP.repo.savePerson(newRec, true);
  ok(r.ok, '新增成员成功', (r.errors || []).join('；'));
  eq(r.person.sortKey, 'B0001-G004-0008', 'sortKey 自动预计算');
  eq(await ZP.idb.count('persons'), N_PERSON + 1, '库中成员数 ' + (N_PERSON + 1));

  console.log('\n[5] 校验规则');
  r = await ZP.repo.savePerson(Object.assign({}, newRec, { id: 'B01-G04-009', name: '' }), true);
  eq(r.ok, false, '缺名字被拦截');
  ok(r.errors.some(e => e.indexOf('名字') >= 0), '错误信息指向名字');

  r = await ZP.repo.savePerson(Object.assign({}, newRec), true);
  eq(r.ok, false, 'ID 重复被拦截');
  ok(r.errors.some(e => e.indexOf('已存在') >= 0), '错误信息提示 ID 已存在');

  r = await ZP.repo.savePerson(Object.assign({}, state.map.get('B01-G01-001'), { fatherId: 'B01-G04-001' }), false);
  eq(r.ok, false, '防循环：始祖不可认后代为父');
  ok(r.errors.some(e => e.indexOf('成环') >= 0), '错误信息提示关系成环');

  r = await ZP.repo.savePerson(Object.assign({}, newRec, { id: 'B01-G99-001', generation: 99, fatherId: 'B01-G01-001' }), true);
  ok(r.ok, '世次不一致仅告警不阻断');
  ok(r.warnings.length > 0, '返回世次告警');
  await ZP.repo.deletePerson('B01-G99-001');

  console.log('\n[5b] 字段级校验（本轮新增）');
  const vbase = {
    id: 'B01-G09-001', surname: '王', name: '试录', namePinyin: 'shilu',
    gender: 'M', category: 'clan', lineageType: 'clan',
    generation: 9, generationName: '', birthOrder: null,
    birthDate: '', deathDate: '',
    fatherId: null, motherId: null, adoptiveFatherId: null, adoptiveMotherId: null,
    branchId: 'B01', nativePlace: '', occupation: '', education: '', bio: '', notes: ''
  };
  const V = (over) => ZP.repo.validatePerson(Object.assign({}, vbase, over), ZP.app.state.map, true);
  const hasWarn = (res, field, kw) => res.issues.some(i =>
    i.field === field && i.level === 'warn' && (!kw || i.msg.indexOf(kw) >= 0));

  let v = V({ id: 'ABC123' });
  eq(v.errors.length, 0, '自定义 ID 不阻断保存');
  ok(hasWarn(v, 'id'), 'ID 不符合推荐格式时给出提醒');

  v = V({ fatherId: 'B01-G02-002' });
  ok(hasWarn(v, 'fatherId', '性别'), '生父指向女性时给出性别提醒');

  v = V({ birthDate: '1980', deathDate: '1970' });
  ok(hasWarn(v, 'deathDate', '早于出生年'), '卒年早于生年给出提醒');

  v = V({ birthDate: '待考' });
  ok(hasWarn(v, 'birthDate'), '年份无法识别给出提醒');

  v = V({ gender: 'M', lineageType: 'outMarried' });
  ok(hasWarn(v, 'lineageType'), '「外嫁女」却为男性时给出提醒');

  v = V({ fatherId: 'B01-G03-002', adoptiveFatherId: 'B01-G03-002' });
  ok(hasWarn(v, 'adoptiveFatherId'), '生父与嗣父为同一人时给出提醒');

  v = V({ generation: 9, fatherId: 'B01-G03-002' });
  ok(v.errors.length === 0 && hasWarn(v, 'fatherId', '应为第 4 世'), '世次与父母不符仅提醒不阻断');

  v = V({ name: '' });
  ok(v.errors.some(m => m.indexOf('名字') >= 0), '必填缺失仍为错误级（阻断保存）');

  console.log('\n[6] 删除保护');
  r = await ZP.repo.deletePerson('B01-G01-001');
  eq(r.ok, false, '始祖有子女/婚姻，禁止删除');
  ok(r.errors.length >= 1 && r.errors[0].indexOf('以他为父母') >= 0, '列出具体引用原因（子女/婚姻）');

  r = await ZP.repo.deletePerson('B01-G04-008');
  ok(r.ok, '无引用的成员可删除');
  eq(await ZP.idb.count('persons'), N_PERSON, '删除后回到 ' + N_PERSON + ' 人');

  console.log('\n[7] 婚姻');
  r = await ZP.repo.saveMarriage({ husbandId: 'B01-G02-001', wifeId: 'B01-G02-002', type: 'marry' });
  eq(r.ok, false, '重复婚姻被拦截');
  r = await ZP.repo.saveMarriage({ husbandId: 'B01-G03-001', wifeId: 'B01-G02-003', type: 'marry', status: 'current', order: 1 });
  ok(r.ok, '新婚姻写入成功', (r.errors || []).join('；'));
  eq(await ZP.idb.count('marriages'), N_MARRY + 1, '婚姻数 ' + (N_MARRY + 1));
  await ZP.repo.deleteMarriage(r.marriage.id);
  eq(await ZP.idb.count('marriages'), N_MARRY, '删除婚姻回到 ' + N_MARRY);

  console.log('\n[7b] 婚姻校验（本轮新增）');
  let mr = await ZP.repo.saveMarriage({ husbandId: 'B01-G03-001', wifeId: 'B01-G10-999', type: 'marry' });
  eq(mr.ok, false, '配偶不存在时被拦截');

  mr = await ZP.repo.saveMarriage({ husbandId: 'B01-G03-001', wifeId: 'B01-G02-003', type: 'marry', order: 3, startYear: '2020', endYear: '1990' });
  ok(mr.ok && mr.warnings.some(w2 => w2.indexOf('早于起始年') >= 0), '结束年早于起始年给出提醒');
  await ZP.repo.deleteMarriage(mr.marriage.id);

  mr = await ZP.repo.saveMarriage({ husbandId: 'B01-G02-003', wifeId: 'B01-G03-002', type: 'marry' });
  ok(mr.ok && mr.warnings.some(w2 => w2.indexOf('性别') >= 0), '夫方为女性时给出性别提醒');
  await ZP.repo.deleteMarriage(mr.marriage.id);
  eq(await ZP.idb.count('marriages'), N_MARRY, '校验用例未残留婚姻记录');

  console.log('\n[8] 表单弹层');
  ZP.views.memberForm.open(null, ZP.app.state, function () {});
  ok(doc.querySelector('#mfForm'), '新增表单已渲染');
  const autoIdVal = doc.querySelector('#mfForm [name="id"]').value;
  ok(/^B\d{2}-G\d{2}-\d{3}$/.test(autoIdVal), '新增表单预填建议 ID（' + autoIdVal + '）');
  const fatherSel = doc.querySelector('#mfForm [name="fatherId"]');
  ok(fatherSel && fatherSel.options.length > 10, '父母下拉已填充候选（按世次分组）');
  const forms = doc.querySelectorAll('#mfForm [name]');
  ok(forms.length >= 20, '表单字段齐全（' + forms.length + ' 项）');

  // 实时校验：错误即时标在对应字段下方
  const nameInput = doc.querySelector('#mfForm [name="name"]');
  nameInput.value = '';
  nameInput.dispatchEvent(new win.Event('input', { bubbles: true }));
  const nameField = nameInput.closest('.field');
  ok(nameField.classList.contains('has-error'), '清空名字后字段立即标红');
  ok(!!nameField.querySelector('.field-msg'), '字段下方出现错误说明');
  nameInput.value = '试录';
  nameInput.dispatchEvent(new win.Event('input', { bubbles: true }));
  ok(!nameInput.closest('.field').classList.contains('has-error'), '补全后标红自动解除');

  // 世次联动：选生父后提示应为第 N+1 世，可一键采纳
  const genInput = doc.querySelector('#mfForm [name="generation"]');
  genInput.value = '7';
  genInput.dispatchEvent(new win.Event('input', { bubbles: true }));
  const fSel = doc.querySelector('#mfForm [name="fatherId"]');
  fSel.value = 'B01-G03-002';                       // 第 3 世 · 建华
  fSel.dispatchEvent(new win.Event('change', { bubbles: true }));
  await sleep(30);
  const hint = doc.querySelector('#mfHints');
  ok(hint && hint.textContent.indexOf('第 4 世') >= 0, '世次联动提示「应为第 4 世」');

  const adoptBtn = doc.querySelector('#mfAdoptGen');
  ok(!!adoptBtn, '提供「采纳建议世次」按钮');
  adoptBtn.dispatchEvent(new win.Event('click', { bubbles: true }));
  eq(doc.querySelector('#mfForm [name="generation"]').value, '4', '采纳后世次写回 4');
  eq(doc.querySelector('#mfForm [name="id"]').value, 'B01-G04-008', '世次变化后 ID 自动跟随重算');

  ZP.ui.closeModal();
  ok(!doc.querySelector('#mfForm'), '弹层可正常关闭');

  console.log('\n[9] 编辑表单回填（人物下拉克隆）');
  const defu = ZP.app.state.map.get('B01-G02-001');
  ZP.views.memberForm.open(defu, ZP.app.state, function () {});
  const ef = doc.querySelector('#mfForm');
  ok(!!ef, '编辑表单已渲染');
  eq(ef.elements.name.value, '德福', '姓名字段回填');
  eq(ef.elements.fatherId.value, 'B01-G01-001', '生父下拉（模板）回填正确');
  eq(ef.elements.motherId.value, 'B01-G01-002', '生母下拉（克隆体）回填正确');
  eq(ef.elements.adoptiveFatherId.value, '', '嗣父下拉（克隆体）为空');
  ZP.ui.closeModal();

  console.log('\n[10] 世系图');
  ZP.app.navigate('tree');
  ok(doc.querySelector('#treeCanvas'), '世系图画布已创建');
  eq(ZP.app.state.genesis.length, 1, '世系森林 1 个根');
  const clanCount = ZP.app.state.persons.filter(p => p.category === 'clan').length;
  eq(clanCount, ZP.SEED.persons.filter(p => p.category === 'clan').length, '主干本族成员 ' + clanCount + ' 人（配偶不入主干）');
  eq(doc.querySelector('#topTitle').textContent, '世系图', '标题切换为世系图');

  // 绘制链路：画布未布局（宽高 0）时不做裁剪，节点仍应全部绘制
  const cv = doc.querySelector('#treeCanvas');
  const drawn = (cv.__ctx && cv.__ctx.__calls.fillText) || 0;
  ok(drawn >= clanCount, '节点已绘制（fillText ' + drawn + ' 次，主干 ' + clanCount + ' 人）');
  ok((cv.__ctx.__calls.stroke || 0) > 0, '连线已绘制');

  console.log('\n[11] 数据视图与备份');
  ZP.app.navigate('data');
  ok(doc.querySelector('#dataStats').textContent.indexOf('成员总数') >= 0, '统计卡片已渲染');
  eq(doc.querySelectorAll('#branchWrap tbody tr').length, N_BRANCH, '房支表 ' + N_BRANCH + ' 行');

  const json = await ZP.repo.exportJSON();
  const parsed = JSON.parse(json);
  eq(parsed.persons.length, N_PERSON, '导出 JSON 含 ' + N_PERSON + ' 名成员');
  eq(parsed.marriages.length, N_MARRY, '导出 JSON 含 ' + N_MARRY + ' 条婚姻');

  const res = await ZP.repo.importJSON(json);
  eq(res.persons, N_PERSON, '导入回写 ' + N_PERSON + ' 名成员');
  eq(await ZP.idb.count('persons'), N_PERSON, '导入后库内成员数一致');

  console.log('\n[12] 详情弹层与称谓');
  ZP.views.members.showDetail('B01-G02-001');
  const modalText = doc.querySelector('.modal').textContent;
  ok(modalText.indexOf('德福') >= 0, '详情弹层显示德福');
  ok(modalText.indexOf('李氏秀英') >= 0, '详情弹层显示配偶');
  ok(modalText.indexOf('配李氏秀英') >= 0 || modalText.indexOf('子') >= 0, '详情弹层显示亲属与称谓');
  ZP.ui.closeModal();

  console.log('\n[13] 大列表分批渲染');
  const realPersons = ZP.app.state.persons.slice();
  const fakes = [];
  for (let i = 0; i < 260; i++) {
    fakes.push(Object.assign({}, realPersons[0], { id: 'TMP-' + i, name: '临时' + i, notes: '' }));
  }
  ZP.app.state.persons = realPersons.concat(fakes);
  ZP.app.navigate('members');
  // 轮询等待：分批渲染跨多帧，固定 sleep 在机器繁忙时会误判
  const total = realPersons.length + fakes.length;
  const firstPaint = doc.querySelectorAll('#mlTableWrap tbody tr').length;
  ok(firstPaint > 0 && firstPaint < total, '首屏先出一批（' + firstPaint + ' / ' + total + ' 行）');
  await waitFor(function () {
    return doc.querySelectorAll('#mlTableWrap tbody tr').length >= total;
  }, 3000);
  const bigRows = doc.querySelectorAll('#mlTableWrap tbody tr').length;
  eq(bigRows, total, '分批渲染最终补全 ' + total + ' 行');
  ZP.app.state.persons = realPersons;
  ZP.app.navigate('members');
  await waitFor(function () {
    return doc.querySelectorAll('#mlTableWrap tbody tr').length >= N_PERSON;
  }, 3000);
  eq(doc.querySelectorAll('#mlTableWrap tbody tr').length, N_PERSON, '还原后回到 ' + N_PERSON + ' 行');

  /* ── 收尾 ── */
  console.log('\n──────────────────────────');
  console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  process.exit(fail ? 1 : 0);
}

main().catch(function (err) {
  console.error('测试异常终止：', err);
  process.exit(2);
});
