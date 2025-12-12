#!/bin/bash
set -e

VERSION="${1#v}"
LUCI_SRC="resources/luci-app-lucky"

[ ! -d "$LUCI_SRC" ] && echo "luci-app-lucky not found" && exit 1

WORK=$(mktemp -d)
mkdir -p "$WORK"/{control,data} output-luci

# 复制 LuCI 文件
[ -d "$LUCI_SRC/luasrc" ] && mkdir -p "$WORK/data/usr/lib/lua/luci" && cp -r "$LUCI_SRC/luasrc/"* "$WORK/data/usr/lib/lua/luci/"
[ -d "$LUCI_SRC/htdocs" ] && mkdir -p "$WORK/data/www" && cp -r "$LUCI_SRC/htdocs/"* "$WORK/data/www/"
[ -d "$LUCI_SRC/root" ] && cp -r "$LUCI_SRC/root/"* "$WORK/data/"

# control 文件
cat > "$WORK/control/control" << EOF
Package: luci-app-lucky
Version: ${VERSION}-1
Depends: libc, luci-base, lucky
Architecture: all
Maintainer: sirpdboy <herboy2008@gmail.com>
Description: LuCI support for Lucky
EOF

# 打包
cd "$WORK/control" && tar -czf ../control.tar.gz .
cd "$WORK/data" && tar -czf ../data.tar.gz . 2>/dev/null || tar -czf ../data.tar.gz --files-from=/dev/null
cd "$WORK" && echo "2.0" > debian-binary
tar -czf "luci-app-lucky_${VERSION}-1_all.ipk" debian-binary control.tar.gz data.tar.gz
cp *.ipk "$OLDPWD/output-luci/"
rm -rf "$WORK"

echo "✅ output-luci/luci-app-lucky_${VERSION}-1_all.ipk"
