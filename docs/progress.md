# 开发进度

## 当前状态（2026-10-24）

| 项 | 状态 |
| --- | --- |
| 示例数据 | 10 世代 / 3 房支 / 198 人（本族 114 + 配偶 84），年代 1740 → 当代 |
| 自动化测试 | **429 项全通过**（7 个套件，0 失败） |
| 代码检查 | lint 干净 |
| 浏览器实测 | 已确认：打开后手工「重置为示例数据」，列表显示 198 人 / 10 代 |
| 未验证项 | 真机渲染截图（`tests/shoot.js` 需本机 Edge） |

测试分布：

| 套件 | 项数 | 覆盖 |
| --- | --- | --- |
| `tests/smoke.js` | 59 | 派生函数 · 防循环 · ID 生成 · 建树归属 · 称谓推算 |
| `tests/seed-scale.js` | 51 | 示例数据规模：结构 · 完整性 · 世系 · 跨 10 代称谓 · 性能 |
| `tests/ui-smoke.js` | 84 | 启动建库 → 列表 → 表单 → 世系图 → 数据视图全链路 |
| `tests/edge-cases.js` | 68 | 缺字段 / 环数据 / 断链 / 称谓边界 |
| `tests/scenario-cases.js` | 52 | 多段婚姻 / 入赘 / 出赘 / 过继组合 |
| `tests/stress-cases.js` | 52 | 4300+ 人建树 / 深链 / 畸形数据 / 称谓矩阵 |
| `tests/create-cases.js` | 63 | 单条数据创建场景（自动输出 `docs/create-cases-report.md`） |

## 已完成

### 一、代码通读与问题盘点

通读 `src/db/*`、`src/ui/*`、`src/ui/views/*`、`index.html`、`seed.js` 与测试入口，
梳理出架构（全局命名空间 `ZP` + 五层：模型 / 存储 / 仓储 / 算法 / UI）与关键机制
（`lineageParentId` 归属优先级、字段级校验、世次联动、称谓推算、Canvas 分层布局）。

### 二、世系图交互与性能（`src/ui/views/tree.js`）

- 修复：`mousedown` 从未添加 `dragging` class，拖拽光标一直不变化
- 修复：双击节点调详情用的是 `member-list` 模块级缓存 `_state`，数据在世系图页改过之后详情会显示过期内容；改为显式传入当前 state
- 新增 `visibleBox()` / `inView()` 视口裁剪，只绘制视野内的节点与连线；画布未布局（宽高 0）时退化为全量绘制

### 三、消除 O(n²)（`src/db/lineage.js`、`src/ui/app.js`）

- 新增 `ZP.lineage.buildChildrenMap(persons)`：一次 O(n) 建「父 → 子女」索引（覆盖生父 / 生母 / 嗣父 / 嗣母四边，按 sortKey 排序），`app.reload()` 时预建到 `state.childrenMap`
- 改用索引的三处：详情弹层子女列表、表单 `descendantsOfAndSelf`（打开表单原为 O(n²)）、保留无索引时的全量兜底

### 四、成员表单下拉复用 DOM（`src/ui/views/member-form.js`）

四个「父母/嗣父母」下拉原先各生成一份完整 option 字符串。现在只有「生父」解析一次（作为 `mfPersonTpl` 模板），
其余三个由 `fillPersonSelects()` 用 `cloneNode` 复制并回填各自 name/value，解析开销降到 1/4。

### 五、排序键房支段改为自然排序（`src/db/schema.js`）

原 `padStart(3,'0')` 把 `B9` 变成 `0B9`（排到最前）、且 `B01` 与 `B001` 视作两支。
新增 `branchSegment()`：拆出字母前缀与数字部分，数字补零到 4 位 —— `B01` / `B001` → `B0001`，`B9` → `B0009`，`B10` → `B0010`。
**已有数据无需迁移**：`repo.listPersons` 运行时重算排序键，成员下次保存即写入新格式。

### 六、成员列表分批渲染 + 事件委托（`src/ui/views/member-list.js`）

- 表格行每 200 行一批插入，首屏同步出一批、其余交给下一帧（`requestAnimationFrame`，缺失时退化为 `setTimeout`）
- `_paintToken` 作废被新渲染取代的旧分批任务，避免筛选连打时错行
- 行内操作改为一次性事件委托（`closest('[data-act]')` / `[data-open]`），省掉上千个监听器

### 七、示例数据扩充到 10 世 / 198 人（`src/db/seed.js`）

- 保留原 42 人的全部 ID 与宗法场景作为「手写场景段」（测试基线依赖）
- 年代重排为每代约 30 年推演（清乾隆 1740 → 当代），字辈诗补为 `守德建志承先泽延熙昆`
- 派生段按「字辈 + 房支 + 世次」生成：房支轮转避免长房独大、每父 2 子保证存在同胞与堂亲、派生成员 ID 从 `101` 段起（与手写段分段，避免与测试新建成员撞号）
- 第 1–8 世已故、第 9–10 世在世

### 八、细节修正

- `data.js`：重置示例数据确认文案写死「10 人」→ 改为从 `ZP.SEED.persons.length` 动态取
- `repo.deletePerson`：增加 `photos` 关联检查（此前只查子女与婚姻）
- `lineage.kinship`：清理 `(isMale ? '先祖' : '先祖')` 冗余三元

## 待办 / 可选

| 项 | 说明 | 优先级 |
| --- | --- | --- |
| 真机渲染验证 | 跑 `tests/shoot.js` 截图，确认 198 人下世系图与列表的实际观感 | 中 |
| 示例数据版本检测 | 目前改动 `seed.js` 后必须手工重置才生效。计划：meta 记 `seedVersion`，启动时与代码版本比对，不一致则在数据管理页提示「示例数据已更新，是否重新载入」 | 中 |
| 文档路径整理 | `docs/在家测试-转移说明.md` 里仍是旧机器路径 `D:\WorkBuddy\Apps\zupu-system`（README 与推送文档已改成本机实际路径） | 低 |
| 列表虚拟滚动 | 当前 200 行分批已足够日常规模（族谱通常远小于 4000 人）；若数据量继续增长再上 | 低 |
| 世系图子树轮廓冲突检测 | 布局为简化 Reingold-Tilford，父节点取首末子节点中点，深层多分支理论上可能重叠 | 低 |
| 照片功能 | `photos` 表已建模、删除引用已检查，但尚无写入入口 | 低 |

## Git

远端：`origin → https://github.com/Qiubr/zupu-system.git`（分支 `main`）。

- 2026-10-24 实测 **HTTPS 直连推送成功**（`f6d0394..fb5ebc2`），此前记录的「443 被阻断」已不再复现；
  `docs/git-推送与凭据.md` 里的 SSH over 443 方案保留作为备用，远端地址未改动。
- 本机 Git 身份**未配置** config。提交时沿用历史作者 `丘sir <qiu@local>`，
  通过 `git -c user.name=... -c user.email=... commit` 临时指定（不写入配置文件）。
  想一劳永逸就自己执行 `git config --global user.name / user.email`。

提交规范：中文简述改动，例 `修复入赘子女世系断链`。真实族谱备份、截图、依赖目录不入仓库。

## 下次开工

### 1. 环境备忘（本机特有，别再踩）

| 事项 | 说明 |
| --- | --- |
| **VS Code 集成终端不可用** | 系统为 Windows 10 **Build 17134（1803）**，而 ConPTY 需 1809+；VS Code 1.109 起移除 Winpty 后端，集成终端报「无法启动 conpty」。已尝试 `terminal.integrated.windowsUseConptyDll: true`（预期无效）。根治需升级系统，或降级 VS Code 到 1.108 并关闭自动更新 |
| **改用外部终端跑 git** | 项目文件夹右键 → **Git Bash Here**（最省事，免 cd）；或系统 PowerShell `cd d:\VSCode\Github\zupu-system` |
| 项目实际路径 | `d:\VSCode\Github\zupu-system`（文档里的 `D:\WorkBuddy\Apps\zupu-system` 是旧机器路径，已修正 README 与推送文档） |
| 测试运行方式 | 需托管 node：`NODE_PATH="C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules" node tests/xxx.js` |

### 2. 开工流程

```bash
git pull --rebase              # 换机器后 / 我在网页端改过文件时
# 改代码
node tests/<对应套件>.js       # 至少跑 smoke + ui-smoke
git add -A && git commit -m "中文简述"
git push
```

### 3. 一个必须记住的行为

**示例数据只在 IndexedDB 为空时播种一次**（`repo.init()` 判断 `n === 0`）。
改动 `src/db/seed.js` 后，浏览器不会自动更新——打开页面需手动
「数据管理 → 重置为示例数据」才看得到新数据。录入真实成员后不要随手点重置，先导出备份。

### 4. 下次优先做

1. 示例数据版本检测（见待办表，中优先级）——消除上面这个手动重置的坑
2. 真机渲染验证：`tests/shoot.js` 截图，确认 198 人下世系图与列表观感
3. 视情况处理列表虚拟滚动、世系图子树轮廓冲突检测（均低优先级）

### 5. 待确认

- VS Code 终端加了 `windowsUseConptyDll` 后是否恢复（重启 VS Code 后试 `Ctrl + \``）
