/**
 * 真机渲染验证 + 截图（用系统 Edge，file:// 直开，验证双击场景）
 * 运行：NODE_PATH=<workspace>/node_modules node tests/shoot.js
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(ROOT, 'shots');
const URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');

/** headless 首次 file:// 导航偶发挂起，用短超时 + 重试兜住 */
async function gotoWithRetry(page, url, tries) {
  tries = tries || 4;
  for (let i = 1; i <= tries; i++) {
    try {
      await page.goto('about:blank', { timeout: 8000 });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      return;
    } catch (e) {
      console.log('  导航重试 ' + i + '/' + tries + '：' + e.message.split('\n')[0]);
      await page.waitForTimeout(500);
    }
  }
  throw new Error('导航失败：' + url);
}

(async () => {
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

  const browser = await chromium.launch({
    executablePath: EDGE,
    args: ['--no-proxy-server', '--no-first-run', '--no-default-browser-check']
  });
  const page = await browser.newPage({ viewport: { width: 1500, height: 940 }, deviceScaleFactor: 2 });
  page.setDefaultTimeout(60000);

  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push('[console] ' + m.text()); });
  page.on('pageerror', (e) => problems.push('[pageerror] ' + e.message));

  console.log('打开：' + URL);
  await gotoWithRetry(page, URL);

  // 1) 成员列表
  await page.waitForSelector('#mlTableWrap tbody tr', { timeout: 15000 });
  await page.waitForTimeout(600);
  const rowCount = await page.$$eval('#mlTableWrap tbody tr', (r) => r.length);
  console.log('成员列表行数：' + rowCount);
  await page.screenshot({ path: path.join(SHOTS, '01-成员管理.png') });

  // 2) 成员详情
  await page.click('#mlTableWrap tbody tr:nth-child(2) .name-cell a');
  await page.waitForTimeout(500);
  const hasDetail = await page.$('.modal');
  console.log('详情弹层：' + (hasDetail ? '已打开' : '未打开'));
  await page.screenshot({ path: path.join(SHOTS, '02-成员详情.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 3) 新增表单（「其他」区块默认折叠）
  await page.click('#mlAdd');
  await page.waitForTimeout(600);
  const fieldCount = await page.$$eval('#mfForm [name]', (els) => els.length);
  console.log('表单字段数：' + fieldCount);
  const autoId = await page.inputValue('#mfForm [name="id"]');
  console.log('自动生成的 ID：' + autoId);
  const otherHidden = await page.$eval('#mfOtherWrap', (el) => el.style.display === 'none');
  console.log('「其他」区块默认折叠：' + otherHidden);
  await page.screenshot({ path: path.join(SHOTS, '03-新增成员表单.png') });

  // 3b) 实时字段校验 + 世次联动（先展开「其他」再填写）
  await page.click('#mfOtherToggle');
  await page.waitForTimeout(200);
  await page.fill('#mfForm [name="name"]', '');
  await page.fill('#mfForm [name="generation"]', '7');
  await page.selectOption('#mfForm [name="fatherId"]', 'B01-G03-002');
  await page.fill('#mfForm [name="birthDate"]', '待考');
  await page.fill('#mfForm [name="id"]', 'abc');
  await page.waitForTimeout(400);

  const hintText = (await page.textContent('#mfHints') || '').replace(/\s+/g, ' ').trim();
  const errFields = await page.$$eval('#mfForm .field.has-error', (els) => els.length);
  const warnFields = await page.$$eval('#mfForm .field.has-warn', (els) => els.length);
  console.log('世次联动提示：' + hintText);
  console.log('字段级提示：错误 ' + errFields + ' 项 / 提醒 ' + warnFields + ' 项');

  await page.evaluate(() => {
    const el = document.querySelector('#mfHints');
    if (el) el.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, '03b-字段校验与世次联动.png') });

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 4) 世系图
  await page.click('[data-route="tree"]');
  await page.waitForTimeout(900);
  const canvasOk = await page.evaluate(() => {
    const c = document.querySelector('#treeCanvas');
    if (!c) return 'no-canvas';
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let nonWhite = 0;
    for (let i = 0; i < d.length; i += 4 * 97) {
      if (d[i] !== 255 || d[i + 1] !== 255 || d[i + 2] !== 255) nonWhite++;
    }
    return 'canvas ' + c.width + 'x' + c.height + '，非空像素采样 ' + nonWhite;
  });
  console.log('世系图：' + canvasOk);
  await page.screenshot({ path: path.join(SHOTS, '04-世系图.png') });

  // 5) 数据管理
  await page.click('[data-route="data"]');
  await page.waitForTimeout(600);
  const statText = await page.textContent('#dataStats');
  console.log('统计包含成员总数：' + (statText.indexOf('成员总数') >= 0));
  await page.screenshot({ path: path.join(SHOTS, '05-数据管理.png') });

  // 6) 持久化验证：刷新后数据仍在
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#mlTableWrap tbody tr', { timeout: 15000 });
  const rowCount2 = await page.$$eval('#mlTableWrap tbody tr', (r) => r.length);
  console.log('刷新后行数：' + rowCount2 + '（与刷新前一致=' + (rowCount2 === rowCount) + '）');

  console.log('\n控制台错误：' + (problems.length ? '\n  ' + problems.join('\n  ') : '无'));
  await browser.close();
  process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error('失败：', e); process.exit(2); });
