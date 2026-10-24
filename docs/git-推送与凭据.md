# 推送到远端仓库 · 凭据与操作说明

## 一、红线：不要给任何人账号密码

**不要把 GitHub 账号密码（或 Token、SSH 私钥）发给 AI、同事、任何聊天窗口。**

原因：

- 对话内容会留痕、会存在日志里，无法撤回
- 账号密码可以执行**任何**操作：删仓库、改资料、盗用身份
- 我也**不需要**这些信息——推送这一步必须由你本人在自己电脑上完成

## 二、本次结论：HTTPS 443 走不通，改用 SSH over 443

**现象**：`git push` 报错

```
fatal: unable to access 'https://github.com/Qiubr/zupu-system.git/':
Failed to connect to github.com:443 after 21069 ms: Could not connect to server
```

**根因**：本机到 `github.com:443` 的直连被网络阻断（国内常见），与账号、仓库配置都无关。

**解决**：GitHub 的 SSH 服务在 `ssh.github.com` 上开放了 **443 端口**，该通道本机实测**可通**。
把 `github.com` 的 SSH 请求重定向到 `ssh.github.com:443` 即可绕开。

### 2.1 本机已完成的配置

| 项目 | 内容 |
| --- | --- |
| 密钥对 | `C:\Users\Administrator\.ssh\id_ed25519`（私钥）/ `id_ed25519.pub`（公钥） |
| SSH 配置 | `C:\Users\Administrator\.ssh\config` |
| 远端地址 | `git@github.com:Qiubr/zupu-system.git`（已从 https 切换为 ssh） |

`~/.ssh/config` 内容：

```
Host github.com
  HostName ssh.github.com
  Port 443
  User git
  IdentityFile C:/Users/Administrator/.ssh/id_ed25519
  IdentitiesOnly yes
  ServerAliveInterval 30
  ServerAliveCountMax 3
```

### 2.2 还差最后一步：把公钥加到 GitHub

公钥内容（**公钥可以公开，私钥绝对不行**）：

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGcDOqQplGci433ztCUSd9tnuqO8xCzas1uyHcD1NI6m qiubr@zupu-system
```

操作步骤：

1. 浏览器打开 <https://github.com/settings/ssh/new>
2. **Title** 填 `公司电脑` （或任意好认的名字）
3. **Key type** 选 `Authentication Key`
4. **Key** 粘贴上面那一整行公钥
5. 点 **Add SSH key**
6. 回到终端执行：

```bash
cd d:\VSCode\Github\zupu-system
ssh -T git@github.com      # 成功会显示 Hi Qiubr! You've successfully authenticated...
git push -u origin main
```

> 如果 <https://github.com> 网页也打不开：换手机热点试，或用能上网的电脑登录 GitHub 添加公钥（公钥本身不敏感，用微信/U 盘传都行）。实在不行，见第五节改用 Gitee。

## 三、备选：Personal Access Token（PAT）

适用于能用 HTTPS 但弹不出浏览器窗口的场景。

1. GitHub → 头像 → **Settings** → 左下 **Developer settings**
2. **Personal access tokens** → **Fine-grained tokens** → Generate new token
3. Repository access 只勾**目标仓库**；Permissions 只给 **Contents: Read and write**
4. Expiration 设最短（如 30 天）
5. push 时：用户名填 GitHub 用户名，**密码处粘贴 Token**

⚠️ Token 等同于密码：不要发我、不要写进代码或 README、不要提交到仓库。

## 四、备选：如果本机有科学上网工具

有代理时也可以让 git 走代理（把端口换成你自己的）：

```bash
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890
# 取消：
git config --global --unset http.proxy
git config --global --unset https.proxy
```

> 本机当前未配置 git 代理。注意 WorkBuddy 环境里存在 `HTTP_PROXY=http://127.0.0.1:63049`，那是工具内部代理，不影响你在自己终端里的 git。

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

## 七、换机器（家里电脑）怎么做

家里网络未必同样受限，按顺序试：

```bash
# 1) 先试直连
git clone https://github.com/Qiubr/zupu-system.git

# 2) 若报 Could not connect to server，同样改用 SSH over 443：
ssh-keygen -t ed25519 -C "home-pc" -f "C:/Users/<你的用户名>/.ssh/id_ed25519" -N ""
# 把新公钥加到 https://github.com/settings/ssh/new （同一账号可加多台机器）
# 新建 ~/.ssh/config，内容与本文件 2.1 节相同（路径改成本机用户名）
git clone git@github.com:Qiubr/zupu-system.git
```

> 代码同步 ≠ 数据同步。族谱真实数据仍在浏览器 IndexedDB 里，需用「数据管理 → 导出备份」单独迁移。

## 八、遇到报错怎么找我

把**报错原文**发我即可（报错里若含 Token / 密码，先打码成 `****`）。我不需要、也不接受任何凭据。
