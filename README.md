
# Auto Build Lucky

## 终端执行以下命令，自动下载安装自动识别架构
  ```bash
  curl -fsSL "https://gitlab.com/whzhni/tailscale/-/raw/main/Auto_Install_Script.sh" | sh -s lucky
  ```
  ## 或
  ```bash
  wget -q -O - "https://gitlab.com/whzhni/tailscale/-/raw/main/Auto_Install_Script.sh" | sh -s lucky
  ```
自动构建 Lucky 应用程序的 GitHub Actions 工作流项目。定期检查上游版本更新，自动构建多架构软件包。
主要是从lucky官网获取最新二进制wanji文件编译成IPK，apk
## 注意：安装时先安装架构包然后安装Luci包
## ✨ 特性
- 🔄 自动版本检测（每天）
- 🏗️ 支持 11 种处理器架构
- 🚀 手动/自动触发构建
- 📦 构建 IPK/APK/LuCI 包
- 🚀 自动创建 GitHub Release

## 🏗️ 支持架构
`arm64` `armv5` `armv6` `armv7` `i386` `mips_hardfloat` `mips_softfloat` `mipsle_hardfloat` `mipsle_softfloat` `riscv64` `x86_64`

## ⚙️ 工作流程
1. **版本检查** - 对比上游最新版本
2. **资源准备** - 下载配置和二进制文件
3. **多架构构建** - 并行构建各架构包
4. **LuCI 构建** - 构建 Web 界面
5. **发布** - 创建 Release 并上传

## 🚀 触发方式
- **自动**: 每天自动检测并更新
- **手动**: 通过 GitHub Actions 页面触发，可选强制构建

## 📁 目录结构
```
.github/workflows/auto-build.yml  # 工作流文件
scripts/                          # 构建脚本
  ├── build-ipk.sh
  ├── build-apk.sh
  └── build-luci.sh
resources/                        # 构建资源
output/                           # 包输出目录
```
## 🔗 相关链接
- 上游项目: https://github.com/sirpdboy/luci-app-lucky
- 二进制地址: https://release.66666.host

