#!/bin/bash
set -e

VERSION="${1#v}"
ARCH="$2"
BINARY="resources/binaries/${ARCH}/lucky"
FILES="resources/files"

[ ! -f "$BINARY" ] && echo "Binary not found: $BINARY" && exit 1

# 架构映射
declare -A ARCH_MAP=(
  [arm64]="aarch64" [armv5]="armv5" [armv6]="armv6" [armv7]="armv7"
  [i386]="x86" [x86_64]="x86_64" [mips_hardfloat]="mips" [mips_softfloat]="mips"
  [mipsle_hardfloat]="mipsel" [mipsle_softfloat]="mipsel" [riscv64]="riscv64"
)
APK_ARCH="${ARCH_MAP[$ARCH]:-$ARCH}"

# 创建目录结构
WORK=$(mktemp -d)
mkdir -p "$WORK"/{usr/bin,etc/init.d,etc/config} output

# 复制文件
cp "$BINARY" "$WORK/usr/bin/lucky" && chmod 755 "$WORK/usr/bin/lucky"
[ -f "$FILES/lucky.init" ] && cp "$FILES/lucky.init" "$WORK/etc/init.d/lucky" && chmod 755 "$WORK/etc/init.d/lucky"
[ -f "$FILES/lucky.config" ] && cp "$FILES/lucky.config" "$WORK/etc/config/lucky"
[ -f "$FILES/luckyarch.bin" ] && cp "$FILES/luckyarch.bin" "$WORK/usr/bin/luckyarch" && chmod 755 "$WORK/usr/bin/luckyarch"

# PKGINFO
cat > "$WORK/.PKGINFO" << EOF
pkgname = lucky
pkgver = ${VERSION}-r1
pkgdesc = Lucky - Dynamic Domain & Port Forward Service
arch = $APK_ARCH
maintainer = GDY666 <gdy666@foxmail.com>
license = GPL-3.0-only
EOF

# 打包
cd "$WORK" && tar -czf "lucky_${VERSION}-1_${APK_ARCH}.apk" .PKGINFO *
cp *.apk "$OLDPWD/output/"
rm -rf "$WORK"

echo "✅ output/lucky_${VERSION}-1_${APK_ARCH}.apk"
