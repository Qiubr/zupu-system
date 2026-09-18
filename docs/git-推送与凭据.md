# 推送到远端仓库 · 凭据与操作说明

## 一、红线：不要给任何人账号密码

**不要把 GitHub 账号密码（或 Token、SSH 私钥）发给 AI、同事、任何聊天窗口。**

原因：

- 对话内容会留痕、会存在日志里，无法撤回
- 账号密码可以执行**任何**操作：删仓库、改资料、盗用身份
- 我也**不需要**这些信息——推送这一步必须由你本人在自己电脑上完成，凭据由系统的凭据管理器保存

## 二、推荐路径：浏览器授权（最省事，本机已就绪）

本机已安装 **Git Credential Manager 2.9.1**，第一次推送时会自动弹出授权窗口：

```bash
cd D:\WorkBuddy\Apps\zupu-system
git remote add origin https://github.com/<你的用户名>/zupu-system.git
git branch -M main
git push -u origin main
```

弹窗里选 **Sign in with your browser** → 浏览器里登录并授权 → 之后自动记住，**全程不需要手输密码**。

## 三、备选：Personal Access Token（PAT）

适用于弹不出浏览器窗口的场景（如公司网络限制）。

1. GitHub → 右上头像 → **Settings** → 左下 **Developer settings**
2. **Personal access tokens** → **Fine-grained tokens** → Generate new token
3. Repository access 只勾**目标仓库**；Permissions 只给 **Contents: Read and write**
4. Expiration 设最短（如 30 天）
5. push 时：用户名填 GitHub 用户名，**密码处粘贴 Token**

⚠️ Token 等同于密码：不要发我、不要写进代码或 README、不要提交到仓库。

## 四、备选：SSH Key（不涉及账号密码）

本机目前还没有 `.ssh` 目录。如需使用：

```bash
ssh-keygen -t ed25519 -C "你的邮箱"     # 一路回车即可
cat ~/.ssh/id_ed25519.pub                # 复制输出的公钥
```

把公钥粘贴到 GitHub → Settings → **SSH and GPG keys** → New SSH key，然后改用 SSH 地址：

```bash
git remote set-url origin git@github.com:<你的用户名>/zupu-system.git
```

**私钥（`id_ed25519`，无 .pub 后缀）永远不要外发。**

## 五、公司电脑的合规提醒

- 个人 GitHub 凭据保存在公司电脑上，请先确认公司信息安全政策是否允许
- 若不允许：改用 Gitee 私有仓库、公司内网 GitLab，或直接用 U 盘 / 网盘拷打包文件

## 六、日常操作流程

```bash
git status                 # 看改了什么
git add -A                 # 暂存全部改动
git commit -m "中文简述改动"   # 提交到本地
git pull --rebase          # 先拉取（换机器后第一件事）
git push                   # 推到远端
```

换机器后的标准动作：

```bash
git clone <仓库地址> zupu-system   # 首次
cd zupu-system
git pull --rebase                 # 之后每次开工前
```

> 代码同步 ≠ 数据同步。族谱真实数据仍在浏览器 IndexedDB 里，需用「数据管理 → 导出备份」单独迁移。

## 七、遇到报错怎么找我

把**报错原文**发我即可（报错里若含 Token / 密码，先打码成 `****`）。我不需要、也不接受任何凭据。
