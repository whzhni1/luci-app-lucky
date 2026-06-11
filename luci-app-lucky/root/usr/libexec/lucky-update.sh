#!/bin/sh
# Lucky 更新脚本

CACHE_DIR="/tmp/lucky_update"
AUTO_LOG="/var/log/lucky-autoupdate.log"
mkdir -p "$CACHE_DIR"

# ─── 文件路径工具 ────────────────────────────────────────────
status_file() { echo "$CACHE_DIR/status";       }
log_file()    { echo "$CACHE_DIR/log";          }
slim_file()   { echo "$CACHE_DIR/releases.json";}
full_file()   { echo "$CACHE_DIR/full.json";    }
tmp_file()    { echo "$CACHE_DIR/$1";           }

# ─── 日志 ────────────────────────────────────────────────────
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$(log_file)"
}

alog() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$AUTO_LOG"
}

set_status() {
    echo "$1" > "$(status_file)"
}

# ─── UCI 读取 ────────────────────────────────────────────────
load_uci() {
    MIRROR="$(uci -q get lucky.lucky.mirror        || echo github)"
    RELEASE_TYPE="$(uci -q get lucky.lucky.release_type || echo stable)"
    VARIANT="$(uci -q get lucky.lucky.variant      || echo lucky)"
    ARCH="$(uci -q get lucky.lucky.arch            || uname -m)"
    BIN_PATH="$(uci -q get lucky.lucky.binpath     || echo /usr/bin/lucky)"
    CONF_DIR="$(uci -q get lucky.lucky.configdir   || echo /etc/config/lucky.daji)"
}

# ─── 格式化文件大小 ──────────────────────────────────────────
format_size() {
    local b="$1"
    [ "$b" -gt 1048576 ] && echo "$((b/1048576)) MB" && return
    [ "$b" -gt 1024 ]    && echo "$((b/1024)) KB"    && return
    echo "$b B"
}

# ─── 文件类型检测 ────────────────────────────────────────────
file_type() {
    local magic=""
    command -v hexdump >/dev/null 2>&1 && \
        magic="$(dd if="$1" bs=4 count=1 2>/dev/null | hexdump -e '1/1 "%02x"')"

    if [ -n "$magic" ]; then
        case "$magic" in
            7f454c46*) echo "elf" ;;
            1f8b*)     echo "gz"  ;;
            504b0304*) echo "zip" ;;
            *)         echo "unknown" ;;
        esac
        return
    fi

    case "$1" in
        *.tar.gz|*.tgz) echo "gz"  ;;
        *.zip)          echo "zip" ;;
        *)              echo "elf" ;;
    esac
}

# ─── API URL 构建 ────────────────────────────────────────────
# mirror:   github | r66666
# variant:  lucky  | wanji
# release_type: stable | beta
api_url() {
    local mirror="$1" variant="$2" release_type="$3"
    case "$mirror" in
        github)
            # GitHub: lucky 标准版 gdy666/lucky，wanji 全功能版 gdy666/lucky（同仓库不同文件名）
            echo "https://api.github.com/repos/gdy666/lucky/releases"
            ;;
        r66666)
            # release.66666.plus 支持 stable/beta 和 lucky/wanji
            if [ "$release_type" = "beta" ]; then
                echo "https://release.66666.plus/lucky/beta/releases.json"
            else
                echo "https://release.66666.plus/lucky/stable/releases.json"
            fi
            ;;
        *)
            echo "https://api.github.com/repos/gdy666/lucky/releases"
            ;;
    esac
}

# ─── 版本查询 ────────────────────────────────────────────────
cmd_check() {
    local mirror="$1"
    local release_type="$2"
    local variant="$3"

    rm -f "$(log_file)" "$(status_file)" "$(full_file)" "$(slim_file)"
    set_status "checking"
    log "Checking: mirror=$mirror release_type=$release_type variant=$variant"

    local url raw
    url="$(api_url "$mirror" "$variant" "$release_type")"
    raw="$(curl -fsSL --connect-timeout 10 --max-time 30 "$url" 2>&1)"

    if [ -z "$raw" ] || ! echo "$raw" | grep -q '"tag_name"\|"tag"'; then
        log "API request failed or no releases found"
        set_status "error:API request failed, please switch mirror"
        return 1
    fi

    echo "$raw" > "$(full_file)"

    # ── 解析 releases，构建 slim JSON ──
    # 根据 variant 过滤文件名关键字
    local 
