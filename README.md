# 宗族族谱管理系统

本地单机运行的族谱管理工具。**双击 `index.html` 即可使用**，零依赖、断网可用、无需安装。

## 特性

- **数据本地存储**：浏览器 IndexedDB，数据不出本机
- **宗法关系完整建模**：生父母 / 嗣父母（过继）、多配偶（配氏）、入赘 / 出赘、外嫁女及其子女入谱、外系
- **世系图可视化**：Canvas 分层布局，千级节点不卡；支持缩放、拖拽、点选查看
- **称谓自动推算**：纯算法推导堂叔 / 从堂妹 / 侄孙等亲属称谓，无需联网
- **字段级实时校验**：输入即校验，错误标在对应字段下方；防循环、ID 重复、世次一致性
- **世次联动**：选择父母后自动提示「应为第 N 世」并支持一键采纳
- **数据管理**：JSON 备份导出 / 导入、宗族信息与房支维护、示例数据重置
- **示例数据规模**：10 世代 / 3 房支 / 198 人，可直接验证大族下的列表与世系图表现

## 快速开始

```
双击 index.html
```

无需构建、无需服务器（直接以 `file://` 打开即可，代码为普通 script，不依赖 ES Module）。

## 目录结构

```
index.html              入口页
src/
  db/
    schema.js           字段定义、常量、派生函数（displayName / sortKey / 防循环等）
    idb.js              轻量 IndexedDB 封装
    repo.js             仓储层：CRUD、校验、备份导入导出
    lineage.js          世系树构建、称谓推算
    seed.js             示例数据（198 人 / 3 房支 / 10 世代）
  ui/
    app.js              路由与状态
    util.js             DOM 与交互工具
    views/              各视图：成员列表、录入表单、世系图、数据管理
  styles/main.css       样式
docs/
  data-model.md         数据模型定稿（唯一依据）
  progress.md           开发进度（当前状态 / 已完成 / 待办）
  manual-test.md        手工测试清单
  create-cases-report.md  创建场景自动化用例报告
  在家测试-转移说明.md    换电脑测试的代码/数据转移说明
tests/
  smoke.js              核心逻辑测试
  seed-scale.js         示例数据规模测试（10 世 / 200 人）
  ui-smoke.js           全链路测试（jsdom + fake-indexeddb）
  create-cases.js       创建场景用例集（自动生成报告）
  edge-cases.js         边界场景用例集（68 项）
  scenario-cases.js     宗法场景模拟用例集（52 项）
  stress-cases.js       压力测试 + 补充场景用例集（52 项）
  shoot.js              真机渲染 + 截图（需本地 Edge）
```

## 测试

```bash
NODE="C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-3/node.exe"
NODE_PATH="C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules"

"$NODE" tests/smoke.js          # 核心逻辑
"$NODE" tests/seed-scale.js     # 示例数据规模（10 世 / 200 人）
"$NODE" tests/ui-smoke.js       # 全链路
"$NODE" tests/create-cases.js   # 创建场景（并生成 docs/create-cases-report.md）
"$NODE" tests/edge-cases.js     # 边界场景（缺字段/环数据/断链/称谓推算边界）
"$NODE" tests/scenario-cases.js # 宗法场景模拟（多段婚姻/入赘/出赘/过继组合）
"$NODE" tests/stress-cases.js   # 压力测试（4300+人建树/深链/畸形数据/称谓矩阵）
"$NODE" tests/shoot.js          # 真机截图（需 Edge，产出至 shots/）
```

前两项与第三项需要 `jsdom`、`fake-indexeddb`、`playwright-core`（安装在托管 workspace 目录，不污染项目）。

## 数据与备份（重要）

**数据不随代码走。** 族谱数据存在「本机 + 当前浏览器」的 IndexedDB 中：

- 换电脑 / 换浏览器 → 数据为空，首次打开载入示例数据
- 无痕（InPrivate）模式打开 → 关闭后数据清空
- 清浏览器缓存 / 站点数据 → 数据一并清除

**因此：正式录入前先「数据管理 → 导出备份」存一份 JSON。**

导出的备份文件（`*备份-*.json`）已被 `.gitignore` 排除，**不要提交到仓库**（含真实姓名）。

示例数据由 `src/db/seed.js` 承载，属于代码，会随版本一起同步——所以换机器后示例数据照样在。

## 版本管理（GitHub）

本地仓库已初始化。推送到 GitHub 的步骤：

```bash
cd d:\VSCode\Github\zupu-system

git remote add origin https://github.com/<你的用户名>/zupu-system.git
git branch -M main
git push -u origin main
```

> 首次推送由 Git Credential Manager 弹出浏览器授权（本机已安装 2.9.1），
> 选「Sign in with your browser」登录授权即可，**不需要输入密码**。

换机器后：

```bash
git clone https://github.com/<你的用户名>/zupu-system.git
cd zupu-system
git pull --rebase     # 之后每次开工前
```

- 仓库请务必设为 **Private**（家族信息）
- 代码、文档、测试、示例数据（`seed.js`）→ 入 Git
- 真实族谱数据备份、截图、依赖目录、打包文件 → 不入 Git
- 提交信息用中文简述改动，例：`修复入赘子女世系断链`
- 推送到远端、Token / SSH 凭据的正确用法见 `docs/git-推送与凭据.md`（**切勿把账号密码或 Token 交给任何人**）
