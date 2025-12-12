#!/bin/bash
set -e

VERSION="${1#v}"
ARCH="$2"
BASE_DIR="$(pwd)"
BINARY="resources/binaries/${ARCH}/lucky"
FILES="resources/files"

[ ! -f "$BINARY" ] && exit 1

WORK=$(mktemp -d)
mkdir -p "$WORK"/{usr/bin,etc/init.d,etc/config}
mkdir -p "$BASE_DIR/output"

cp "$BASE_DIR/$BINARY" "$WORK/usr/bin/lucky" && chmod 755 "$WORK/usr/bin/lucky"
[ -f "$BASE_DIR/$FILES/lucky.init" ] && cp "$BASE_DIR/$FILES/lucky.init" "$WORK/etc/init.d/lucky" && chmod 755 "$WORK/etc/init.d/lucky"
[ -f "$BASE_DIR/$FILES/lucky.config" ] && cp "$BASE_DIR/$FILES/lucky.config" "$WORK/etc/config/lucky"
[ -f "$BASE_DIR/$FILES/luckyarch.bin" ] && cp "$BASE_DIR/$FILES/luckyarch.bin" "$WORK/usr/bin/luckyarch" && chmod 755 "$WORK/usr/bin/luckyarch"

cat > "$WORK/.PKGINFO" << EOF
pkgname = lucky
pkgver = ${VERSION}-r1
pkgdesc = Lucky - Dynamic Domain & Port Forward Service
arch = $ARCH
maintainer = GDY666 <gdy666@foxmail.com>
license = GPL-3.0-only
EOF

cd "$WORK" && tar -czf "lucky_${VERSION}-1_${ARCH}.apk" .PKGINFO *
cp *.apk "$BASE_DIR/output/"
rm -rf "$WORK"
echo "✅ lucky_${VERSION}-1_${ARCH}.apk"
