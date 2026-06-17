# luci-app-lucky — 稳定可靠的 Lucky 管理插件 for OpenWrt

`luci-app-lucky` 是一个为 OpenWrt 定制的 Luci 界面插件，用于管理 [Lucky](https://github.com/gdy666/lucky) 网络工具。与同类项目相比，本插件在固件更新、进程守护、版本选择和架构适配方面做了深度优化，让 Lucky 的部署和维护更加省心。

---

## ✨ 特性亮点

- **配置持久化**  
  将 Lucky 的数据目录默认设置为 `/config/lucky.daji`（而非 `/etc/lucky`），**固件升级配置不会丢失**，无需手动备份。

- **进程守护**  
  集成 `Respawn` 机制，当 Lucky 主进程意外崩溃或退出时，**自动重新拉起**，保证服务持续可用。

- **灵活的目录定制**  
  支持在 Luci 界面中**自定义 Lucky 数据目录**和**程序安装目录**，满足不同存储布局需求。

- **多版本一键切换**  
  可从官方仓库（[GitHub](https://github.com/gdy666/lucky)）或官网（[https://release.66666.host](https://release.66666.host)）**自动检测更新**，并支持选择 **标准版**、**万吉版（wanji）** 和 **Beta 版**。

- **智能架构适配**  
  无需手动安装架构对应的二进制包，`luci-app-lucky` 会自动下载匹配的版本。  
  > 本质上，aarch64/ARM64、A53、A55、A72 等 CPU 架构共用同一个二进制包。如果为每个架构单独编译，会浪费大量时间，这就是本项目不需要单独安装架构包、改为自动下载的由来。

---

## 📦 快速安装

在 OpenWrt 终端中执行以下任一命令，即可一键安装：

```bash
# 使用 curl
curl -fsSL "https://gitlab.com/whzhni/tailscale/-/raw/main/Auto_Install_Script.sh" | sh -s luci-app-lucky
```

```bash
# 使用 wget
wget -q -O - "https://gitlab.com/whzhni/tailscale/-/raw/main/Auto_Install_Script.sh" | sh -s luci-app-lucky
```

脚本会自动完成依赖检查、软件包下载和 Luci 界面注册，安装后可在 OpenWrt 管理页面的 **服务** 菜单中找到 **Lucky** 配置入口。

---

## ⚙️ 配置说明

安装完成后，通过 Luci 界面进入 **Lucky** 配置页面，你可以：

- 修改 **数据存储目录**（默认 `/config/lucky.daji`）
- 修改 **程序文件目录**（默认`/usr/bin/lucky`）
- 切换 **Lucky 版本**（标准/万吉/Beta）
- 开启/关闭 **自动更新**（支持从 GitHub 或官网拉取）
- 查看当前运行状态、日志以及进程守护状态

---

## 🔄 更新与维护

- **自动更新**：开启后，插件会定期检查官方源的新版本，自动升级或手动在插件页面检查更新。
- **手动更新**：在 Luci 界面点击“检查更新”按钮即可。
- **进程管理**：若 Lucky 进程异常退出，`Respawn` 会在30秒内将其重新启动，1小时内连续5次启动失败则放弃启动，无需人工干预。

---
![设置](Images/lucky_config.png)
![更新](Images/lucky_update.png)

