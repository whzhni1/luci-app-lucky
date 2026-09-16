#!/bin/sh

UPDATE_DIR="/tmp/lucky_update"
STATUS_FILE="$UPDATE_DIR/status"
LOG_FILE="$UPDATE_DIR/log"
RELEASES_FILE="$UPDATE_DIR/releases.json"
LUCI_RELEASES_FILE="$UPDATE_DIR/luci_releases.json"
LUCI_STATUS_FILE="$UPDATE_DIR/luci_status"
LUCI_LOG_FILE="$UPDATE_DIR/luci_log"
AUTO_LOG="$UPDATE_DIR/autoupdate.log"

PROGRESS_FILE="$UPDATE_DIR/progress"
LUCI_PROGRESS_FILE="$UPDATE_DIR/luci_progress"
SHA256_FILE="$UPDATE_DIR/sha256s.txt"
LUCI_SHA256_FILE="$UPDATE_DIR/luci_sha256s.txt"

GITHUB_API="https://api.github.com/repos/gdy666/lucky/releases"
MIRROR_BASE="https://release.66666.host"
LUCI_APIS="https://api.github.com/repos/whzhni1/luci-app-lucky/releases
https://gitlab.com/api/v4/projects/whzhni%2Fluci-app-lucky/releases
https://gitee.com/api/v5/repos/whzhni/luci-app-lucky/releases"

log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$msg" >&2
    [ -n "$LOG_TO_FILE" ] && echo "$msg" >> "$LOG_TO_FILE"
}

init_dir() { [ -d "$UPDATE_DIR" ] || mkdir -p "$UPDATE_DIR"; }

tag_to_ver() { echo "$1" | sed 's/^v//'; }

uci_get() {
    local v; v=$(uci -q get "lucky.lucky.$1" 2>/dev/null)
    echo "${v:-$2}"
}

write_status() {
    local f; [ "$1" = "luci" ] && f="$LUCI_STATUS_FILE" || f="$STATUS_FILE"
    echo "$2" > "$f"
}

die() {
    local prefix="$1" code="$2" detail="${3:-$2}"
    log "ERROR: $detail"
    write_status "$prefix" "error:$code"
    exit 1
}

http_get() {
    local url="$1" out="$2" t="${3:-60}"
    curl -fsSL --connect-timeout 15 --max-time "$t" -o "$out" "$url"
}

http_get_var() {
    local url="$1" t="${2:-30}"
    curl -fsSL --connect-timeout 15 --max-time "$t" "$url" 2>/dev/null
}

detect_pm() {
    command -v apk  >/dev/null 2>&1 && echo "apk"  && return
    command -v opkg >/dev/null 2>&1 && echo "opkg" && return
}

detect_arch() {
    local a; a=$(uci -q get lucky.lucky.arch 2>/dev/null)
    [ -n "$a" ] && [ "$a" != "auto" ] && echo "$a" && return
    case "$(uname -m)" in
        x86_64)              echo "x86_64" ;;
        i[3-6]86)            echo "i386" ;;
        aarch64|arm64)       echo "arm64" ;;
        armv7*)              echo "armv7" ;;
        armv6*)              echo "armv6" ;;
        armv5*)              echo "armv5" ;;
        riscv64)             echo "riscv64" ;;
        mips)    grep -q "FPU" /proc/cpuinfo 2>/dev/null \
                     && echo "mips_hardfloat"  || echo "mips_softfloat" ;;
        mips[el]*)  grep -q "FPU" /proc/cpuinfo 2>/dev/null \
                     && echo "mipsle_hardfloat" || echo "mipsle_softfloat" ;;
        *)                   echo "x86_64" ;;
    esac
}

detect_lang() {
    for f in /usr/lib/lua/luci/i18n/*.lmo; do
        [ -f "$f" ] || continue
        local t="${f%.lmo}"; echo "${t##*.}"
    done | sort | uniq -c | sort -nr | head -1 | awk '{print $2}'
}

fmt_size() {
    local bytes="$1"
    if [ -z "$bytes" ] || [ "$bytes" -eq 0 ] 2>/dev/null; then
        echo "unknown"
        return
    fi
    awk -v b="$bytes" 'BEGIN{
        if(b>=1048576) printf "%.1fM", b/1048576
        else           printf "%.1fKB", b/1024
    }'
}

version_lt() {
    local v1="$1" v2="$2"
    local c1 c2
    c1=$(echo "$v1" | sed 's/^v//')
    c2=$(echo "$v2" | sed 's/^v//')
    [ "$c1" = "$c2" ] && return 1
    local n1 n2
    n1=$(echo "$c1" | sed 's/beta/./')
    n2=$(echo "$c2" | sed 's/beta/./')
    echo "$c1" | grep -q 'beta' || n1="${n1}.999"
    echo "$c2" | grep -q 'beta' || n2="${n2}.999"
    local hi; hi=$(printf '%s\n%s' "$n1" "$n2" | sort -V | tail -1)
    [ "$hi" = "$n2" ]
}

get_installed_version() {
    uci -q get lucky.lucky.installed_version 2>/dev/null || echo ""
}

save_installed_version() {
    uci -q set lucky.lucky.installed_version="$1" 2>/dev/null
    uci -q commit lucky 2>/dev/null
}

get_luci_version() {
    case "$1" in
        apk)  apk  info luci-app-lucky 2>/dev/null \
                   | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 ;;
        opkg) opkg info luci-app-lucky 2>/dev/null \
                   | grep '^Version:' | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 ;;
    esac
}

parse_dir_listing() {
    grep -oE 'href="\./[^"]*"' "$1" | sed 's|href="\./||;s|"||g' | grep -v '^$'
}

extract_url_from_releases() {
    local esc
    esc=$(printf '%s' "$2" | sed 's/\./\\./g')
    grep -o "\"name\":\"${esc}\",\"url\":\"[^\"]*\"" "$1" \
        | grep -o '"url":"[^"]*"' | cut -d'"' -f4 | head -1
}

collect_sha256s() {
    printf '%s' "$1" | grep -oE 'sha256:[a-f0-9]{64}' | sort -u
}

save_sha256s() {
    local found
    found=$(collect_sha256s "$1")
    if [ -n "$found" ]; then
        printf '%s\n' "$found" > "$2"
        log "Collected $(printf '%s\n' "$found" | wc -l | tr -d ' ') sha256 entries, will verify the download"
    else
        rm -f "$2"
        log "No sha256 provided by this source, verification will be skipped"
    fi
}

verify_sha256() {
    [ -s "$2" ] || return 0
    local sum
    sum=$(sha256sum "$1" | awk '{print $1}')
    log "Computed local sha256: $sum"
    if grep -qF "$sum" "$2"; then
        log "SHA256 verified OK"
        return 0
    fi
    log "SHA256 verification failed"
    return 1
}

fetch_api_lines() {
    local raw="$1" ext="$2" out="$3"
    printf '%s' "$raw" \
        | sed 's/": "/":"/g; s/": /:/g' \
        | grep -oE '"tag_name":"[^\"]*"|https://[^\"]*'"$ext" \
        > "$out"
}

parse_release_lines() {
    local lines_file="$1" arch="$2" variant="${3:-lucky}" max_count="${4:-999}"
    local result_arr="" count=0
    local cur_tag="" files_json="" best_name="" best_url=""

    while IFS= read -r line; do
        [ -z "$line" ] && continue
        case "$line" in
            '"tag_name":"'*)
                if [ -n "$cur_tag" ] && [ -n "$files_json" ] && [ "$count" -lt "$max_count" ]; then
                    result_arr="${result_arr:+$result_arr,}{\"tag\":\"$cur_tag\",\"best\":\"$best_name\",\"best_url\":\"$best_url\",\"files\":[$files_json]}"
                    count=$((count+1))
                fi
                cur_tag=$(echo "$line" | cut -d'"' -f4)
                files_json="" best_name="" best_url=""
                ;;
            https://*)
                local fname="${line##*/}"
                [ -z "$fname" ] && continue
                echo "$files_json" | grep -q "\"${fname}\"" && continue
                files_json="${files_json:+$files_json,}{\"name\":\"$fname\",\"url\":\"$line\"}"
                if [ -z "$best_name" ]; then
                    local match=0
                    case "$variant" in
                        wanji) echo "$fname" | grep -q "wanji" && match=1 ;;
                        *)     echo "$fname" | grep -qv "wanji" && match=1 ;;
                    esac
                    if [ "$match" = "1" ]; then
                        if [ -z "$arch" ] || echo "$fname" | grep -q "_${arch}"; then
                            best_name="$fname"; best_url="$line"
                        fi
                    fi
                fi
                ;;
        esac
    done < "$lines_file"

    [ -n "$cur_tag" ] && [ -n "$files_json" ] && [ "$count" -lt "$max_count" ] && \
        result_arr="${result_arr:+$result_arr,}{\"tag\":\"$cur_tag\",\"best\":\"$best_name\",\"best_url\":\"$best_url\",\"files\":[$files_json]}"

    printf '%s' "$result_arr"
}

build_releases() {
    local raw="$1" ext="$2" arch="$3" variant="$4" max="${5:-999}"
    local lf="$UPDATE_DIR/.api_lines"
    fetch_api_lines "$raw" "$ext" "$lf"
    local r
    r=$(parse_release_lines "$lf" "$arch" "$variant" "$max")
    rm -f "$lf"
    printf '[%s]\n' "$r"
}

check_releases_count() {
    local json="$1" label="$2" prefix="$3"
    { [ -z "$json" ] || [ "$json" = "[]" ]; } && die "$prefix" "no_releases" "No $label versions found"
    printf '%s' "$json" | grep -o '"tag"' | wc -l | tr -d ' '
}

fetch_r66666_tags() {
    local release_type="$1" out="$2"
    local tmp="$UPDATE_DIR/r66666_root.html"
    http_get "${MIRROR_BASE}/" "$tmp" || die "" "check_failed" "Failed to fetch mirror version list"
    [ -s "$tmp" ]                     || die "" "no_releases" "Mirror version list is empty"

    local all; all=$(parse_dir_listing "$tmp" | grep '^v' | grep '/$' | sed 's|/$||')
    case "$release_type" in
        stable) echo "$all" | grep -E  '^v[0-9]+\.[0-9]+\.[0-9]+$' ;;
        beta)   echo "$all" | grep -Ev '^v[0-9]+\.[0-9]+\.[0-9]+$' ;;
        *)      echo "$all" ;;
    esac | sort -Vr > "$out"
}

fetch_r66666_release_files() {
    local tag="$1" variant="$2" arch="$3"
    local ver="${tag#v}" ver_url="${MIRROR_BASE}/${tag}/" tmp="$UPDATE_DIR/r66666_ver.html"

    http_get "$ver_url" "$tmp" || { log "WARN: Failed to fetch $ver_url"; return; }
    [ -s "$tmp" ]              || { log "WARN: Empty directory for tag $tag"; return; }

    local subdirs chosen_sub
    subdirs=$(parse_dir_listing "$tmp" | grep '/$' | sed 's|/$||' \
              | grep "$variant" | grep -v 'docker')
    chosen_sub=$(echo "$subdirs" | grep -E "^${ver}_${variant}$" | head -1)
    [ -z "$chosen_sub" ] && chosen_sub=$(echo "$subdirs" | head -1)
    [ -z "$chosen_sub" ] && { log "WARN: No $variant subdirectory for tag $tag"; return; }

    local sub_url="${MIRROR_BASE}/${tag}/${chosen_sub}/" tmp2="$UPDATE_DIR/r66666_sub.html"
    http_get "$sub_url" "$tmp2" || { log "WARN: Failed to fetch $sub_url"; return; }
    [ -s "$tmp2" ]              || { log "WARN: Empty subdirectory $chosen_sub"; return; }

    local fnames; fnames=$(parse_dir_listing "$tmp2" \
        | grep -v '/$' | grep '^lucky_' | grep '_Linux_' | grep '\.tar\.gz$')
    [ -z "$fnames" ] && { log "WARN: No files found in $chosen_sub"; return; }

    local files_json="" best_name="" fname
    while IFS= read -r fname; do
        [ -z "$fname" ] && continue
        local url="${sub_url}${fname}"
        files_json="${files_json:+$files_json,}{\"name\":\"$fname\",\"url\":\"$url\"}"
        [ -z "$best_name" ] && echo "$fname" | grep -q "_${arch}" && best_name="$fname"
    done << EOF
$fnames
EOF
    [ -z "$best_name" ] && best_name=$(printf '%s\n' "$fnames" | head -1)

    printf '{"tag":"%s","variant":"%s","best":"%s","best_url":"%s","files":[%s]}' \
        "$tag" "$variant" "$best_name" "${sub_url}${best_name}" "$files_json"
}

do_download() {
    local releases_file="$1" tag="$2" filename="$3" prefix="$4"
    local bag progress
    if [ "$prefix" = "luci" ]; then
        bag="$LUCI_SHA256_FILE"; progress="$LUCI_PROGRESS_FILE"
    else
        bag="$SHA256_FILE";     progress="$PROGRESS_FILE"
    fi

    local url
    url=$(extract_url_from_releases "$releases_file" "$filename")
    [ -z "$url" ] && die "$prefix" "url_not_found" "No download URL found for $filename"

    init_dir
    echo 0 > "$progress"
    write_status "$prefix" "downloading:$tag"
    log "Downloading: $filename"
    log "URL: $url"

    local f="$UPDATE_DIR/$filename"

    local total_size
    total_size=$(curl -sIL --connect-timeout 15 "$url" 2>/dev/null \
        | grep -i content-length | tail -1 | awk '{print $2}' | tr -d '\r')

    if [ -n "$total_size" ] && [ "$total_size" -gt 0 ] 2>/dev/null; then
        log "Total size: $(fmt_size "$total_size")"
        (
            while true; do
                if [ -f "$f" ]; then
                    downloaded=$(wc -c < "$f" 2>/dev/null | tr -d ' ')
                    if [ "${downloaded:-0}" -gt 0 ] 2>/dev/null; then
                        pct=$(awk "BEGIN{printf \"%d\", $downloaded*100/$total_size}")
                        echo "$pct" > "$progress"
                        [ "$pct" -ge 100 ] && break
                    fi
                fi
                sleep 1
            done
        ) &
        local progress_pid=$!

        http_get "$url" "$f" 300
        local ret=$?
        kill "$progress_pid" 2>/dev/null
        wait "$progress_pid" 2>/dev/null
    else
        log "Total size: unknown"
        http_get "$url" "$f" 300
        local ret=$?
    fi
    echo 100 > "$progress"

    [ $ret -ne 0 ] && die "$prefix" "download_failed" "Download failed: $url"
    [ -s "$f" ]    || die "$prefix" "download_empty" "Downloaded file is empty"
    log "Download complete: $(fmt_size "$(wc -c < "$f" | tr -d ' ')")"

    verify_sha256 "$f" "$bag" || die "$prefix" "checksum_failed" "SHA256 verification failed, file may be corrupted"
    echo "$f"
}

cmd_check() {
    local mirror="${1:-$(uci_get mirror github)}"
    local release_type="${2:-$(uci_get release_type stable)}"
    local variant="${3:-$(uci_get variant lucky)}"
    local arch="${4:-$(detect_arch)}"

    init_dir
    write_status "" "checking"
    log "Checking upstream versions (mirror=$mirror channel=$release_type variant=$variant arch=$arch)"

    local releases_json
    case "$mirror" in
        github)
            local raw
            raw=$(http_get_var "$GITHUB_API?per_page=100")
            { [ -z "$raw" ] || ! printf '%s' "$raw" | grep -q '"tag_name"'; } \
                && die "" "check_failed" "GitHub API request failed or returned invalid data"
            save_sha256s "$raw" "$SHA256_FILE"
            releases_json=$(build_releases "$raw" "_Linux_[^\"]*\\.tar\\.gz" "$arch" "$variant")
            ;;
        r66666)
            rm -f "$SHA256_FILE"
            log "Mirror does not provide sha256, verification will be skipped"
            local tags_file="$UPDATE_DIR/tags.txt"
            fetch_r66666_tags "$release_type" "$tags_file"
            [ -s "$tags_file" ] || die "" "no_releases" "No matching version tags found"
            local entry result_arr=""
            while IFS= read -r tag; do
                [ -z "$tag" ] && continue
                entry=$(fetch_r66666_release_files "$tag" "$variant" "$arch")
                [ -n "$entry" ] && result_arr="${result_arr:+$result_arr,}$entry"
            done < "$tags_file"
            releases_json="[$result_arr]"
            ;;
        *) die "" "unknown_mirror" "Unknown mirror: $mirror" ;;
    esac

    local count; count=$(check_releases_count "$releases_json" "lucky" "")
    printf '%s\n' "$releases_json" > "$RELEASES_FILE"
    log "Found $count versions"
    write_status "" "ready:$count"
}

fetch_luci_releases() {
    local pm="$1" max="${2:-5}"
    local ext; case "$pm" in apk) ext="apk" ;; *) ext="ipk" ;; esac

    local raw="" api
    while IFS= read -r api; do
        [ -z "$api" ] && continue
        log "Trying LuCI API: $api"
        raw=$(http_get_var "$api" 15)
        if printf '%s' "$raw" | grep -q '"tag_name"'; then
            log "Got release info from: $api"
            save_sha256s "$raw" "$LUCI_SHA256_FILE"
            break
        fi
        log "WARN: No response from $api"; raw=""
    done << EOF
$LUCI_APIS
EOF
    [ -z "$raw" ] && { log "ERROR: All LuCI APIs failed"; return 1; }

    local json
    json=$(build_releases "$raw" "\\.${ext}" "" "" "$max")
    printf '%s\n' "$json" > "$LUCI_RELEASES_FILE"
    printf '%s\n' "$json"
}

cmd_check_luci() {
    local pm; pm=$(detect_pm)
    [ -z "$pm" ] && die "luci" "package_manager_missing" "No package manager found (opkg/apk)"
    init_dir
    write_status "luci" "checking"
    local json
    json=$(fetch_luci_releases "$pm" 5)
    local count; count=$(check_releases_count "$json" "LuCI" "luci")
    log "LuCI: found $count versions"
    write_status "luci" "ready:$count"
}

install_luci_pkg() {
    local logfile="${LOG_TO_FILE:-/dev/null}"
    case "$1" in
        apk)  apk  add --allow-untrusted "$2" 2>&1 | tr -d '\r' >> "$logfile" ;;
        opkg) opkg install               "$2" 2>&1 | tr -d '\r' >> "$logfile" ;;
        *)    return 1 ;;
    esac
}

backup_config() {
    local configdir
    configdir=$(uci_get configdir "")
    { [ -z "$configdir" ] || [ ! -d "$configdir" ]; } && return 0
    local ver; ver=$(uci_get installed_version "")
    [ -z "$ver" ] && ver="unknown"
    local backup_file="$UPDATE_DIR/lucky_${ver}_$(date +%Y%m%d%H%M%S).tar.gz"
    tar -czf "$backup_file" -C "$(dirname "$configdir")" "$(basename "$configdir")" 2>/dev/null
    log "Config backed up: $backup_file"
}

cmd_download() {
    local tag="$1" filename="$2" binpath="${3:-$(uci_get binpath /usr/bin/lucky)}"
    [ -z "$tag" ]      && die "" "invalid_request" "download: missing tag"
    [ -z "$filename" ] && die "" "invalid_request" "download: missing filename"

    local dl
    dl=$(do_download "$RELEASES_FILE" "$tag" "$filename" "") || exit 1
    write_status "" "installing:$tag"

    local xdir="$UPDATE_DIR/extract"
    rm -rf "$xdir" && mkdir -p "$xdir"
    log "Extracting..."
    case "$filename" in
        *.tar.gz|*.tgz) tar -xzf "$dl" -C "$xdir" 2>/dev/null \
                             || die "" "extract_failed" "Extract failed: $filename" ;;
        *) die "" "unsupported_format" "Unsupported format: $filename" ;;
    esac

    local bin; bin=$(find "$xdir" -type f -name "lucky" | head -1)
    [ -z "$bin" ] && die "" "binary_not_found" "Binary 'lucky' not found in archive"
    log "Found binary: $bin"

    mkdir -p "$(dirname "$binpath")"
    backup_config
    log "Stopping service..."
    /etc/init.d/lucky stop 2>/dev/null; sleep 1

    log "Installing to: $binpath"
    cp "$bin" "$binpath" && chmod 755 "$binpath" || die "" "install_failed" "Failed to install to $binpath"
    rm -rf "$xdir" "$dl"

    log "Starting service..."
    /etc/init.d/lucky start 2>/dev/null
    local ver; ver=$(tag_to_ver "$tag")
    save_installed_version "${ver:-$tag}"
    log "Installation complete: ${ver:-$tag}"
    write_status "" "done:${ver:-$tag}"
}

cmd_download_luci() {
    local tag="$1" filename="$2"
    [ -z "$tag" ]      && die "luci" "invalid_request" "download_luci: missing tag"
    [ -z "$filename" ] && die "luci" "invalid_request" "download_luci: missing filename"

    local pm; pm=$(detect_pm)
    [ -z "$pm" ] && die "luci" "package_manager_missing" "No package manager found (opkg/apk)"

    local dl
    dl=$(do_download "$LUCI_RELEASES_FILE" "$tag" "$filename" "luci") || exit 1
    write_status "luci" "installing_luci:$tag"

    log "Installing LuCI package ($pm): $filename"
    install_luci_pkg "$pm" "$dl" || die "luci" "install_failed" "LuCI package install failed"
    rm -f "$dl"

    local lang; lang=$(detect_lang)
    if [ -n "$lang" ] && [ "$lang" != "en" ] && [ -f "$LUCI_RELEASES_FILE" ]; then
        local lf lu
        lf=$(grep -oE '"[^"]*i18n[^"]*'"$lang"'[^"]*"' "$LUCI_RELEASES_FILE" \
             | tr -d '"' | head -1)
        if [ -n "$lf" ]; then
            lu=$(grep -o "\"name\":\"${lf}\",\"url\":\"[^\"]*\"" "$LUCI_RELEASES_FILE" \
                 | grep -o '"url":"[^"]*"' | cut -d'"' -f4 | head -1)
            if [ -n "$lu" ]; then
                log "Installing language pack: $lf"
                local ldl="$UPDATE_DIR/$lf"
                http_get "$lu" "$ldl" \
                    && install_luci_pkg "$pm" "$ldl" \
                    && log "Language pack installed: $lf" \
                    || log "WARN: Language pack installation failed"
                rm -f "$ldl"
            fi
        fi
    fi

    log "Installation complete: $tag"
    write_status "luci" "luci_done:$tag"
}

maybe_update() {
    local cur="$1" latest="$2" label="$3"
    if [ -n "$cur" ] && [ -n "$latest" ] && ! version_lt "$cur" "$latest"; then
        log "$label is up to date ($cur)"
        return 1
    fi
    return 0
}

cmd_auto() {
    local mirror release_type variant arch binpath
    mirror=$(uci_get mirror github)
    release_type=$(uci_get release_type stable)
    variant=$(uci_get variant lucky)
    arch=$(detect_arch)
    binpath=$(uci_get binpath /usr/bin/lucky)

    init_dir
    rm -f "$PROGRESS_FILE" "$LUCI_PROGRESS_FILE"
    write_status "" "checking"
    log "Auto update: mirror=$mirror channel=$release_type variant=$variant arch=$arch"

    local cur_ver=""
    if [ -x "$binpath" ]; then
        cur_ver=$(get_installed_version)
        log "Current lucky: ${cur_ver:-unknown}"
    else
        log "Lucky binary not found, will download and install it"
    fi

    cmd_check "$mirror" "$release_type" "$variant" "$arch"
    [ -f "$RELEASES_FILE" ] || die "" "check_failed" "Failed to check upstream versions"

    local latest_tag best_file
    latest_tag=$(grep -o '"tag":"[^"]*"' "$RELEASES_FILE" | head -1 | cut -d'"' -f4)
    best_file=$(grep -o '"best":"[^"]*"' "$RELEASES_FILE" | head -1 | cut -d'"' -f4)
    [ -z "$latest_tag" ] && die "" "check_failed" "Cannot parse latest tag"
    [ -z "$best_file" ]  && die "" "check_failed" "Cannot parse best file"

    log "Latest: $latest_tag (current: ${cur_ver:-none})"

    local done_msg="ok"
    if maybe_update "$cur_ver" "$(tag_to_ver "$latest_tag")" "Lucky"; then
        cmd_download "$latest_tag" "$best_file" "$binpath"
        done_msg=$(tag_to_ver "$latest_tag")
    fi

    local pm; pm=$(detect_pm)
    if [ -z "$pm" ]; then
        log "No package manager found, skipping LuCI update"
    else
        fetch_luci_releases "$pm" 5 || log "WARN: No LuCI releases, skipping"
        if [ -s "$LUCI_RELEASES_FILE" ] && [ "$(cat "$LUCI_RELEASES_FILE")" != "[]" ]; then
            local luci_tag luci_file luci_cur
            luci_tag=$(grep -o '"tag":"[^"]*"' "$LUCI_RELEASES_FILE" | head -1 | cut -d'"' -f4)
            luci_file=$(grep -o '"best":"[^"]*"' "$LUCI_RELEASES_FILE" | head -1 | cut -d'"' -f4)
            luci_cur=$(get_luci_version "$pm")
            log "LuCI current: ${luci_cur:-unknown}, latest: $luci_tag"
            if [ -n "$luci_tag" ] && [ -n "$luci_file" ] \
               && maybe_update "$luci_cur" "$(tag_to_ver "$luci_tag")" "LuCI"; then
                cmd_download_luci "$luci_tag" "$luci_file"
                [ "$done_msg" = "ok" ] && done_msg=$(tag_to_ver "$luci_tag")
            fi
        else
            log "No LuCI release info, skipping"
        fi
    fi

    write_status "" "done:${done_msg}"
    log "Auto update complete"
}

case "$1" in
    check)         init_dir; LOG_TO_FILE="$LOG_FILE";      : > "$LOG_FILE";      cmd_check "$2" "$3" "$4" "$5" ;;
    download)      init_dir; LOG_TO_FILE="$LOG_FILE";      : > "$LOG_FILE";      cmd_download "$2" "$3" "$4" ;;
    check_luci)    init_dir; LOG_TO_FILE="$LUCI_LOG_FILE"; : > "$LUCI_LOG_FILE"; cmd_check_luci ;;
    download_luci) init_dir; LOG_TO_FILE="$LUCI_LOG_FILE"; : > "$LUCI_LOG_FILE"; cmd_download_luci "$2" "$3" ;;
    auto|"")       init_dir; LOG_TO_FILE="$AUTO_LOG";      : > "$AUTO_LOG";      cmd_auto ;;
    detect_arch)   detect_arch ;;
    detect_pm)     detect_pm ;;
    *)
        echo "Usage: $0 {check|download|check_luci|download_luci|auto|detect_arch|detect_pm}"
        exit 1 ;;
esac


