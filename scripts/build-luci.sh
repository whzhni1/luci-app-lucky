#!/bin/bash
# scripts/build-luci.sh
# 直接使用上游的 luci-app-lucky

set -e

VERSION="${1#v}"

echo "=========================================="
echo "Building luci-app-lucky $VERSION"
echo "=========================================="

LUCI_SRC="resources/luci-app-lucky"

if [ ! -d "$LUCI_SRC" ]; then
    echo "Error: luci-app-lucky not found at $LUCI_SRC"
    # 尝试查找
    find resources -type d -name "*luci*" 2>/dev/null
    exit 1
fi

mkdir -p output-luci

# 创建工作目录
WORK_DIR="$(mktemp -d)"
DATA_DIR="$WORK_DIR/data"
CONTROL_DIR="$WORK_DIR/control"

mkdir -p "$DATA_DIR"
mkdir -p "$CONTROL_DIR"

# ========== 复制 LuCI 文件 ==========
# 上游的目录结构可能是：
# luci-app-lucky/
# ├── luasrc/          -> /usr/lib/lua/luci/
# ├── htdocs/          -> /www/
# └── root/            -> /

# 复制 Lua 源码
if [ -d "$LUCI_SRC/luasrc" ]; then
    mkdir -p "$DATA_DIR/usr/lib/lua/luci"
    cp -r "$LUCI_SRC/luasrc/"* "$DATA_DIR/usr/lib/lua/luci/"
fi

# 复制 htdocs
if [ -d "$LUCI_SRC/htdocs" ]; then
    mkdir -p "$DATA_DIR/www"
    cp -r "$LUCI_SRC/htdocs/"* "$DATA_DIR/www/"
fi

# 复制 root 下的文件
if [ -d "$LUCI_SRC/root" ]; then
    cp -r "$LUCI_SRC/root/"* "$DATA_DIR/"
fi

# 如果是新版目录结构
if [ -d "$LUCI_SRC/luci-app-lucky" ]; then
    cp -r "$LUCI_SRC/luci-app-lucky/"* "$DATA_DIR/" 2>/dev/null || true
fi

echo "::group::LuCI package contents"
find "$DATA_DIR" -type f | head -50
echo "::endgroup::"

# ========== 生成控制文件 ==========
INSTALLED_SIZE=$(du -sb "$DATA_DIR" | cut -f1)

cat > "$CONTROL_DIR/control" << EOF
Package: luci-app-lucky
Version: $VERSION-1
Depends: libc, luci-base, lucky
Source: https://github.com/sirpdboy/luci-app-lucky
SourceName: luci-app-lucky
License: Apache-2.0
Section: luci
Maintainer: sirpdboy <herboy2008@gmail.com>
Architecture: all
Installed-Size: $INSTALLED_SIZE
Description: LuCI support for Lucky
 Provides web interface for Lucky service configuration.
EOF

# ========== 打包 ==========
cd "$CONTROL_DIR"
tar -czf ../control.tar.gz ./*

cd "$DATA_DIR"
if [ -n "$(ls -A .)" ]; then
    tar -czf ../data.tar.gz ./*
else
    # 空目录情况
    tar -czf ../data.tar.gz --files-from=/dev/null
fi

cd "$WORK_DIR"
echo "2.0" > debian-binary
tar -czf "luci-app-lucky_${VERSION}-1_all.ipk" ./debian-binary ./control.tar.gz ./data.tar.gz

cp "luci-app-lucky_${VERSION}-1_all.ipk" "$OLDPWD/output-luci/"

echo "✅ Created: output-luci/luci-app-lucky_${VERSION}-1_all.ipk"

# 清理
rm -rf "$WORK_DIR"
