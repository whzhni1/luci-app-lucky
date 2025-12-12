#!/bin/bash
# scripts/build-ipk.sh
# 使用从上游获取的配置文件

set -e

VERSION="${1#v}"
ARCH="$2"
PKG_NAME="lucky"

echo "=========================================="
echo "Building IPK: $PKG_NAME $VERSION for $ARCH"
echo "=========================================="

# 路径定义
BINARY="resources/binaries/${ARCH}/lucky"
FILES_DIR="resources/files"

# 检查必要文件
if [ ! -f "$BINARY" ]; then
    echo "Error: Binary not found: $BINARY"
    exit 1
fi

if [ ! -f "$FILES_DIR/lucky.init" ]; then
    echo "Error: lucky.init not found in $FILES_DIR"
    exit 1
fi

# 架构映射
case "$ARCH" in
    arm64)              OPENWRT_ARCH="aarch64_generic" ;;
    armv5)              OPENWRT_ARCH="arm_arm926ej-s" ;;
    armv6)              OPENWRT_ARCH="arm_arm1176jzf-s_vfp" ;;
    armv7)              OPENWRT_ARCH="arm_cortex-a7_neon-vfpv4" ;;
    i386)               OPENWRT_ARCH="i386_pentium4" ;;
    x86_64)             OPENWRT_ARCH="x86_64" ;;
    mips_hardfloat)     OPENWRT_ARCH="mips_24kc" ;;
    mips_softfloat)     OPENWRT_ARCH="mips_24kc_24kf" ;;
    mipsle_hardfloat)   OPENWRT_ARCH="mipsel_24kc" ;;
    mipsle_softfloat)   OPENWRT_ARCH="mipsel_24kc_24kf" ;;
    riscv64)            OPENWRT_ARCH="riscv64_riscv64" ;;
    *)                  OPENWRT_ARCH="$ARCH" ;;
esac

# 创建工作目录
WORK_DIR="$(mktemp -d)"
DATA_DIR="$WORK_DIR/data"
CONTROL_DIR="$WORK_DIR/control"

mkdir -p "$DATA_DIR/usr/bin"
mkdir -p "$DATA_DIR/etc/init.d"
mkdir -p "$DATA_DIR/etc/config"
mkdir -p "$CONTROL_DIR"
mkdir -p "output"

# ========== 复制文件（使用上游的配置文件） ==========
cp "$BINARY" "$DATA_DIR/usr/bin/lucky"
chmod 755 "$DATA_DIR/usr/bin/lucky"

# 使用上游的 init 脚本
cp "$FILES_DIR/lucky.init" "$DATA_DIR/etc/init.d/lucky"
chmod 755 "$DATA_DIR/etc/init.d/lucky"

# 使用上游的配置文件
if [ -f "$FILES_DIR/lucky.config" ]; then
    cp "$FILES_DIR/lucky.config" "$DATA_DIR/etc/config/lucky"
else
    # 如果上游没有，创建最小配置
    cat > "$DATA_DIR/etc/config/lucky" << 'EOF'
config lucky 'config'
    option enabled '1'
    option port '16601'
EOF
fi

# 如果有 luckyarch.bin，也复制
if [ -f "$FILES_DIR/luckyarch.bin" ]; then
    cp "$FILES_DIR/luckyarch.bin" "$DATA_DIR/usr/bin/luckyarch"
    chmod 755 "$DATA_DIR/usr/bin/luckyarch"
fi

# 计算安装大小
INSTALLED_SIZE=$(du -sb "$DATA_DIR" | cut -f1)

# ========== 生成控制文件 ==========
cat > "$CONTROL_DIR/control" << EOF
Package: $PKG_NAME
Version: $VERSION-1
Depends: libc
Source: https://github.com/gdy666/lucky
SourceName: $PKG_NAME
License: GPL-3.0-only
LicenseFiles: LICENSE
Section: net
Maintainer: GDY666 <gdy666@foxmail.com>
Architecture: $OPENWRT_ARCH
Installed-Size: $INSTALLED_SIZE
Description: Lucky - Dynamic Domain & Port Forward Service
 Main functions: IPv4/IPv6 port forwarding, DDNS, WOL, reverse proxy and more.
EOF

cat > "$CONTROL_DIR/conffiles" << EOF
/etc/config/lucky
EOF

# postinst - 参考上游逻辑
cat > "$CONTROL_DIR/postinst" << 'EOF'
#!/bin/sh
[ -n "${IPKG_INSTROOT}" ] || {
    /etc/init.d/lucky enable
    /etc/init.d/lucky start
}
exit 0
EOF
chmod 755 "$CONTROL_DIR/postinst"

# prerm
cat > "$CONTROL_DIR/prerm" << 'EOF'
#!/bin/sh
/etc/init.d/lucky stop 2>/dev/null
/etc/init.d/lucky disable 2>/dev/null
exit 0
EOF
chmod 755 "$CONTROL_DIR/prerm"

# ========== 打包 IPK ==========
cd "$CONTROL_DIR"
tar -czf ../control.tar.gz ./*

cd "$DATA_DIR"
tar -czf ../data.tar.gz ./*

cd "$WORK_DIR"
echo "2.0" > debian-binary
tar -czf "${PKG_NAME}_${VERSION}-1_${OPENWRT_ARCH}.ipk" ./debian-binary ./control.tar.gz ./data.tar.gz

# 复制到输出目录
cp "${PKG_NAME}_${VERSION}-1_${OPENWRT_ARCH}.ipk" "$OLDPWD/output/"

echo "✅ Created: output/${PKG_NAME}_${VERSION}-1_${OPENWRT_ARCH}.ipk"

# 清理
rm -rf "$WORK_DIR"
