#!/bin/bash
set -e

VERSION="${1#v}"
BASE_DIR="$(pwd)"
LUCI_SRC="resources/luci-app-lucky"

[ ! -d "$LUCI_SRC" ] && exit 1

mkdir -p "$BASE_DIR/output-luci"

# 构建 IPK 包函数
build_ipk() {
  local PKG_NAME="$1"
  local PKG_DESC="$2"
  local PKG_DEPENDS="$3"
  local DATA_DIR="$4"
  
  local WORK=$(mktemp -d)
  mkdir -p "$WORK"/{control,data}
  
  [ -d "$DATA_DIR" ] && cp -r "$DATA_DIR/"* "$WORK/data/" 2>/dev/null || true
  
  cat > "$WORK/control/control" << EOF
Package: $PKG_NAME
Version: ${VERSION}-1
Depends: $PKG_DEPENDS
Architecture: all
Maintainer: sirpdboy <herboy2008@gmail.com>
Description: $PKG_DESC
EOF

  cd "$WORK/control" && tar -czf ../control.tar.gz .
  cd "$WORK/data" && tar -czf ../data.tar.gz . 2>/dev/null || tar -czf ../data.tar.gz --files-from=/dev/null
  cd "$WORK" && echo "2.0" > debian-binary
  tar -czf "${PKG_NAME}_${VERSION}-1_all.ipk" debian-binary control.tar.gz data.tar.gz
  cp *.ipk "$BASE_DIR/output-luci/"
  rm -rf "$WORK"
  echo "✅ ${PKG_NAME}_${VERSION}-1_all.ipk"
}

# 构建 APK 包函数
build_apk() {
  local PKG_NAME="$1"
  local PKG_DESC="$2"
  local DATA_DIR="$3"
  
  local WORK=$(mktemp -d)
  mkdir -p "$WORK"
  
  [ -d "$DATA_DIR" ] && cp -r "$DATA_DIR/"* "$WORK/" 2>/dev/null || true
  
  cat > "$WORK/.PKGINFO" << EOF
pkgname = $PKG_NAME
pkgver = ${VERSION}-r1
pkgdesc = $PKG_DESC
arch = noarch
maintainer = sirpdboy <herboy2008@gmail.com>
license = Apache-2.0
EOF

  cd "$WORK" && tar -czf "${PKG_NAME}_${VERSION}-1_all.apk" .PKGINFO * 2>/dev/null || tar -czf "${PKG_NAME}_${VERSION}-1_all.apk" .PKGINFO
  cp *.apk "$BASE_DIR/output-luci/"
  rm -rf "$WORK"
  echo "✅ ${PKG_NAME}_${VERSION}-1_all.apk"
}

# === 构建 luci-app-lucky ===
LUCI_DATA=$(mktemp -d)
mkdir -p "$LUCI_DATA"

[ -d "$BASE_DIR/$LUCI_SRC/luasrc" ] && mkdir -p "$LUCI_DATA/usr/lib/lua/luci" && cp -r "$BASE_DIR/$LUCI_SRC/luasrc/"* "$LUCI_DATA/usr/lib/lua/luci/"
[ -d "$BASE_DIR/$LUCI_SRC/htdocs" ] && mkdir -p "$LUCI_DATA/www" && cp -r "$BASE_DIR/$LUCI_SRC/htdocs/"* "$LUCI_DATA/www/"
[ -d "$BASE_DIR/$LUCI_SRC/root" ] && cp -r "$BASE_DIR/$LUCI_SRC/root/"* "$LUCI_DATA/"

build_ipk "luci-app-lucky" "LuCI support for Lucky" "libc, luci-base, lucky" "$LUCI_DATA"
build_apk "luci-app-lucky" "LuCI support for Lucky" "$LUCI_DATA"
rm -rf "$LUCI_DATA"

# === 构建语言包 ===
PO_DIR="$BASE_DIR/$LUCI_SRC/po"
[ ! -d "$PO_DIR" ] && PO_DIR="$BASE_DIR/resources/luci-app-lucky/po"

if [ -d "$PO_DIR" ]; then
  for lang_dir in "$PO_DIR"/*/; do
    [ ! -d "$lang_dir" ] && continue
    lang=$(basename "$lang_dir")
    [ "$lang" = "templates" ] && continue
    
    I18N_DATA=$(mktemp -d)
    mkdir -p "$I18N_DATA/usr/lib/lua/luci/i18n"
    
    # 复制 .po 或 .lmo 文件
    if ls "$lang_dir"*.lmo 1>/dev/null 2>&1; then
      cp "$lang_dir"*.lmo "$I18N_DATA/usr/lib/lua/luci/i18n/"
    elif ls "$lang_dir"*.po 1>/dev/null 2>&1; then
      cp "$lang_dir"*.po "$I18N_DATA/usr/lib/lua/luci/i18n/"
    fi
    
    # 处理语言代码
    case "$lang" in
      zh-cn|zh_Hans) i18n_name="zh-cn" ;;
      zh-tw|zh_Hant) i18n_name="zh-tw" ;;
      *) i18n_name="$lang" ;;
    esac
    
    build_ipk "luci-i18n-lucky-$i18n_name" "LuCI Lucky $i18n_name translation" "libc, luci-app-lucky" "$I18N_DATA"
    build_apk "luci-i18n-lucky-$i18n_name" "LuCI Lucky $i18n_name translation" "$I18N_DATA"
    rm -rf "$I18N_DATA"
  done
fi

echo "=== LuCI 构建完成 ==="
ls -la "$BASE_DIR/output-luci/"
