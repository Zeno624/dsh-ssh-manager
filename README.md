# 远程主机资源管理（@local/dsh-ssh-manager）

把远程主机当成 DSH 里的一种**可管理资源**，而不是把终端搬进 DSH：

- 左侧边栏的「远程主机」页面：添加 / 修改 / 删除主机与连接配置，显示在线状态。
- 会话输入框旁的「SSH 主机」选择器：按会话决定 agent 可以访问哪些主机，带在线/离线圆点。
- 右侧栏的「远程文件」标签页：每台授权主机一个标签，浏览远程目录、预览文本、右键把路径插入会话。
- agent 侧工具：列出可用远程资源、列目录 / 读文件 / 看属性 / 下载，以及持久命令会话。

不需要手动终端能力；SSH 只作为插件访问远程资源的手段。

## 安装

在 DSH 的 **Plugins** 页面用「Add plugin」选择本目录，或让 Plugin Manager 安装 Git 地址，例如：

```text
plugin_manager(action: "install_bundle", target: "<本仓库的 Git 地址或本地绝对路径>")
```

安装后 Host 行随 HMR 加载，客户端模块自动重载，无需重启。`askpass.exe` 已随仓库提供；如需重建：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-askpass.ps1
```

依赖：Windows 上的 OpenSSH 客户端（`ssh.exe`），Linux/macOS 上的 `ssh`；DSH 0.2.1-rc.2。

## 界面

| 位置 | 内容 |
|---|---|
| 左侧边栏「远程主机」 | 全局主机列表：在线点、名称、`user@host:port`、备注、初始目录；测试连接 / 编辑 / 删除；「添加主机」表单（名称、地址、用户名、端口、初始目录、分组、备注） |
| 输入框左侧「SSH 主机」 | 按会话勾选授权主机；每行有在线点；授权后可点「文件」直接打开右侧文件标签 |
| 右侧栏「远程文件」 | 首次打开选主机（或点选择器里的「文件」）；之后是路径面包屑 + 目录列表；右键文件/目录：插入路径到会话、下载到工作区、重命名、删除、新建文件夹、上传、复制路径 |

「插入路径到会话」插入的是纯文本 `@<主机名>:<绝对路径>`，例如 `@compile:/var/log/app.log`，agent 用 `ssh_read_file` 读取它。

## Agent 工具

| 工具 | 用途 |
|---|---|
| `ssh_hosts` | 列出本会话已授权的主机与已打开的会话 |
| `ssh_ls` | 列远程目录（类型、大小、mtime） |
| `ssh_read_file` | 读远程文本文件（默认 64 KiB，可截断） |
| `ssh_stat` | 远程路径元数据（类型、大小、mtime、权限、属主） |
| `ssh_download` | 下载远程文件到当前会话工作区 |
| `ssh_run` | 打开/复用持久会话执行一条命令 |
| `ssh_open` / `ssh_send` / `ssh_read` / `ssh_list` / `ssh_close` | 持久命令会话（cd、环境变量、长编译保持） |

未授权主机的调用一律拒绝。

## 认证

Agent 侧是**非交互 SSH**，必须密钥登录。本机已生成 `~/.ssh/id_ed25519`，还需把公钥装到每台主机（每台输一次密码）：

```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@10.0.13.236 "mkdir -p ~/.ssh; chmod 700 ~/.ssh; cat >> ~/.ssh/authorized_keys; chmod 600 ~/.ssh/authorized_keys"
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@10.0.13.235 "mkdir -p ~/.ssh; chmod 700 ~/.ssh; cat >> ~/.ssh/authorized_keys; chmod 600 ~/.ssh/authorized_keys"
```

验证：`ssh -o BatchMode=yes compile hostname`。

### 密码认证（可选，按主机）

主机编辑表单里有「密码」一栏（MobaXterm 式）：填写后会存进 DSH 的凭据服务（`~/.dsh/.credentials.yaml`，ref 名 `DSH_SSH_PASSWORD_<主机ID>`），不进入会话日志；`已设置` 时留空表示不修改，勾选「清除已保存的密码」可删除。

- 连接时 Host 通过 `SSH_ASKPASS` 自动喂密码，ssh / 命令会话 / 文件操作都适用。
- 同时存在密钥时优先密钥，密码兜底。
- 明文落盘（凭据文件只有当前 OS 用户可读，但 agent 进程同用户，无法隔离）；追求更安全就继续用密钥。
- 密码值只从页面单向写入凭据服务，Host 侧只读取、不返回，也不写日志。

## 数据与实现

- 状态文件：`%USERPROFILE%\.dsh\ssh-manager\state.json`（主机、按会话的授权）。
- 文件和主机数据由 Host 半执行 `ssh` 获得（密码主机通过 `askpass.exe` 自动应答）；界面通过插件自己注册的 `/ssh-manager` 命令和 Host 通信。
- 目录列表用 `find -printf` 输出 NUL 分隔记录；读文件用 `head -c`；下载/上传用 `ssh` + base64（上限 2 MB）；写操作用 `mkdir -p` / `mv` / `rm -rf`。
- 在线状态是 1.5 秒 TCP 连接探测，Host 端缓存 30 秒。

## 已知边界

- 界面每次读取/操作都会通过命令桥，在会话日志里留下命令生命周期事件（如果对话里出现 `/ssh-manager` 行，说明渲染层把它显示出来了，需要再换通道）。
- 文件面板是逐目录列表（面包屑导航），不是一次性加载整棵树。
- 上传只接受会话工作区内的相对路径；下载落在会话工作区。
- 写操作（删除/重命名）有确认框，但没有二次输入校验。
