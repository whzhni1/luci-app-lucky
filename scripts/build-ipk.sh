#!/bin/bash
set -e

VERSION="${1#v}"
ARCH="$2"
BASE_DIR="$(pwd)"
BINARY="resources/binaries/${ARCH}/lucky"
FILES="resources/files"

[ ! -f "$BINARY" ] && exit 1

WORK=$(mktemp -d)
mkdir -p "$WORK"/{control,data/usr/bin,data/etc/init.d,data/etc/config}
mkdir -p "$BASE_DIR/output"

cp "$BASE_DIR/$BINARY" "$WORK/data/usr/bin/lucky" && chmod 755 "$WORK/data/usr/bin/lucky"
[ -f "$BASE_DIR/$FILES/lucky.init" ] && cp "$BASE_DIR/$FILES/lucky.init" "$WORK/data/etc/init.d/lucky" && chmod 755 "$WORK/data/etc/init.d/lucky"
[ -f "$BASE_DIR/$FILES/lucky.config" ] && cp "$BASE_DIR/$FILES/lucky.config" "$WORK/data/etc/config/lucky"
[ -f "$BASE_DIR/$FILES/luckyarch.bin" ] && cp "$BASE_DIR/$FILES/luckyarch.bin" "$WORK/data/usr/bin/luckyarch" && chmod 755 "$WORK/data/usr/bin/luckyarch"
find "$WORK" -type f -exec sed -i 's|/etc/lucky|/etc/config/lucky.daji|g' {} \;

cat > "$WORK/control/control" << EOF
Package: lucky
Version: ${VERSION}-1
Depends: libc
Architecture: all
Maintainer: GDY666 <gdy666@foxmail.com>
Description: Lucky - Dynamic Domain & Port Forward Service
EOF

echo "/etc/config/lucky" > "$WORK/control/conffiles"
echo '#!/bin/sh
[ -z "${IPKG_INSTROOT}" ] && { /etc/init.d/lucky enable; /etc/init.d/lucky start; }
exit 0' > "$WORK/control/postinst" && chmod 755 "$WORK/control/postinst"
echo '#!/bin/sh
/etc/init.d/lucky stop 2>/dev/null; /etc/init.d/lucky disable 2>/dev/null; exit 0' > "$WORK/control/prerm" && chmod 755 "$WORK/control/prerm"

cd "$WORK/control" && tar -czf ../control.tar.gz .
cd "$WORK/data" && tar -czf ../data.tar.gz .
cd "$WORK" && echo "2.0" > debian-binary
tar -czf "lucky_${VERSION}-1_${ARCH}.ipk" debian-binary control.tar.gz data.tar.gz
cp *.ipk "$BASE_DIR/output/"
rm -rf "$WORK"
echo "✅ lucky_${VERSION}-1_${ARCH}.ipk"
