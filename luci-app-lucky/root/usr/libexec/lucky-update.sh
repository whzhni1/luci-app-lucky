#!/bin/sh

UPDATE_DIR="/tmp/lucky_update"
STATUS_FILE="$UPDATE_DIR/status"
LOG_FILE="$UPDATE_DIR/log"
RELEASES_FILE="$UPDATE_DIR/releases.json"
LUCI_RELEASES_FILE="$UPDATE_DIR/luci_releases.json"
LUCI_STATUS_FILE="$UPDATE_DIR/luci_status"
LUCI_LOG_FILE="$UPDATE_DIR/luci_log"
AUTO_LOG="$UPDATE_DIR/autoupdate.log"

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

uci_get() {
    local v; v=$(uci -q get "lucky.lucky.$1" 2>/dev/null)
    echo "${v:-$2}"
}

write_status() {
    local f; [ "$1" = "luci" ] && f="$LUCI_STATUS_FILE" || f="$STATUS_FILE"
    echo "$2" > "$f"
}

die() { log "ERROR: $2"; write_status "$1" "error:$2"; exit 1; }

_http_cmd() {
    if   command -v wget >/dev/null 2>&1; then echo "wget"
    elif command -v curl >/dev/null 2>&1; then echo "curl"
    fi
}

http_get() {
    local url="$1" out="$2" t="${3:-60}"
    case "$(_http_cmd)" in
        wget) wget -qO "$out" --timeout="$t" "$url" ;;
        curl) curl -fsSL --connect-timeout 15 --max-time "$t" -o "$out" "$url" ;;
        *)    return 1 ;;
    esac
}

http_get_var() {
    local url="$1" t="${2:-30}"
    case "$(_http_cmd)" in
        wget) wget -qO- --timeout="$t" "$url" 2>/dev/null ;;
        curl) curl -fsSL --connect-timeout 15 --max-time "$t" "$url" 2>/dev/null ;;
        *)    return 1 ;;
    esac
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

extract_version() { grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1; }
tag_to_ver()      { echo "$1" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1; }

version_lt() {
    local hi; hi=$(printf '%s\n%s' "$1" "$2" | sort -V | tail -1)
    [ "$hi" = "$2" ] && [ "$1" != "$2" ]
}

_version_file() { echo "$(uci_get configdir /etc/config/lucky.daji)/.lucky_version"; }

get_installed_version() {
    local f; f=$(_version_file); [ -f "$f" ] && cat "$f" || echo ""
}

save_installed_version() {
    local f; f=$(_version_file)
    mkdir -p "$(dirname "$f")"
    echo "$1" > "$f"
}

get_lucky_version() {
    "${1:-$(uci_get binpath /usr/bin/lucky)}" version 2>/dev/null | extract_version
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
    grep -o "\"name\":\"${2}\",\"url\":\"[^\"]*\"" "$1" \
        | grep -o '"url":"[^"]*"' | cut -d'"' -f4 | head -1
}

parse_first_field() {
    grep -o "\"${1}\":\"[^\"]*\"" "$2" | head -1 | cut -d'"' -f4
}

fetch_api_lines() {
    local raw="$1" ext="$2" out="$3"
    printf '%s' "$raw" \
        | sed 's/": "/":"/g; s/": /:/g' \
        | grep -oE '"tag_name":"[^"]*"|https://[^"]*'"${ext}" \
        > "$out"
    log "Extracted: $(wc -l < "$out" | tr -d ' ')"
}

parse_release_lines() {
    local lines_file="$1" arch="$2" max_count="${3:-999}"
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
                    [ -z "$arch" ] || echo "$fname" | grep -q "_${arch}[._]" \
                        && { best_name="$fname"; best_url="$line"; }
                fi
                ;;
        esac
    done < "$lines_file"

    [ -n "$cur_tag" ] && [ -n "$files_json" ] && [ "$count" -lt "$max_count" ] && \
        result_arr="${result_arr:+$result_arr,}{\"tag\":\"$cur_tag\",\"best\":\"$best_name\",\"best_url\":\"$best_url\",\"files\":[$files_json]}"

    printf '%s' "$result_arr"
}

fetch_github_releases() {
    local arch="$1" url="${GITHUB_API}?per_page=100"
    log "Fetching GitHub API: $url"
    local raw; raw=$(http_get_var "$url")
    { [ -z "$raw" ] || ! echo "$raw" | grep -q '"tag_name"'; } \
        && die "" "GitHub API failed or invalid response"

    local lf="$UPDATE_DIR/gh_lines.txt"
    fetch_api_lines "$raw" "_Linux_[^\"]*\\.tar\\.gz" "$lf"
    local r; r=$(parse_release_lines "$lf" "$arch")
    rm -f "$lf"
    printf '[%s]\n' "$r"
}

fetch_r66666_tags() {
    local release_type="$1" out="$2"
    local tmp="$UPDATE_DIR/r66666_root.html"
    log "Fetching mirror index: ${MIRROR_BASE}/"
    http_get "${MIRROR_BASE}/" "$tmp" || die "" "Failed to fetch mirror index"
    [ -s "$tmp" ]                     || die "" "Empty mirror index"

    local all; all=$(parse_dir_listing "$tmp" | grep '^v' | grep '/$' | sed 's|/$||')
    log "Tags: $(echo "$all" | tr '\n' ' ')"
    case "$release_type" in
        stable) echo "$all" | grep -E  '^v[0-9]+\.[0-9]+\.[0-9]+$' ;;
        beta)   echo "$all" | grep -Ev '^v[0-9]+\.[0-9]+\.[0-9]+$' ;;
        *)      echo "$all" ;;
    esac | sort -Vr > "$out"
}

fetch_r66666_release_files() {
    local tag="$1" variant="$2" arch="$3"
    local ver="${tag#v}" ver_url="${MIRROR_BASE}/${tag}/" tmp="$UPDATE_DIR/r66666_ver.html"

    http_get "$ver_url" "$tmp" || { log "WARN: Failed $ver_url"; return; }
    [ -s "$tmp" ]              || { log "WARN: Empty index $tag"; return; }

    local subdirs chosen_sub
    subdirs=$(parse_dir_listing "$tmp" | grep '/$' | sed 's|/$||' \
              | grep "$variant" | grep -v 'docker')
    chosen_sub=$(echo "$subdirs" | grep -E "^${ver}_${variant}$" | head -1)
    [ -z "$chosen_sub" ] && chosen_sub=$(echo "$subdirs" | head -1)
    [ -z "$chosen_sub" ] && { log "WARN: No subdir for variant=$variant tag=$tag"; return; }

    local sub_url="${MIRROR_BASE}/${tag}/${chosen_sub}/" tmp2="$UPDATE_DIR/r66666_sub.html"
    http_get "$sub_url" "$tmp2" || { log "WARN: Failed $sub_url"; return; }
    [ -s "$tmp2" ]              || { log "WARN: Empty subdir listing"; return; }

    local fnames; fnames=$(parse_dir_listing "$tmp2" \
        | grep -v '/$' | grep '^lucky_' | grep '_Linux_' | grep '\.tar\.gz$')
    [ -z "$fnames" ] && { log "WARN: No files in $chosen_sub"; return; }

    local files_json="" best_name="" fname
    while IFS= read -r fname; do
        [ -z "$fname" ] && continue
        local url="${sub_url}${fname}"
        files_json="${files_json:+$files_json,}{\"name\":\"$fname\",\"url\":\"$url\"}"
        [ -z "$best_name" ] && echo "$fname" | grep -q "_${arch}[._]" && best_name="$fname"
    done << EOF
$fnames
EOF
    [ -z "$best_name" ] && best_name=$(printf '%s\n' "$fnames" | head -1)

    printf '{"tag":"%s","variant":"%s","best":"%s","best_url":"%s","files":[%s]}' \
        "$tag" "$variant" "$best_name" "${sub_url}${best_name}" "$files_json"
}

fetch_luci_releases() {
    local pm="$1" max="${2:-5}"
    local ext; case "$pm" in apk) ext="apk" ;; *) ext="ipk" ;; esac

    local raw="" api
    while IFS= read -r api; do
        [ -z "$api" ] && continue
        log "Trying luci API: $api"
        raw=$(http_get_var "$api" 15)
        echo "$raw" | grep -q '"tag_name"' && { log "Got response from: $api"; break; }
        log "WARN: No response from $api"; raw=""
    done << EOF
$LUCI_APIS
EOF
    [ -z "$raw" ] && { log "ERROR: All luci APIs failed"; return 1; }

    local lf="$UPDATE_DIR/luci_lines.txt"
    fetch_api_lines "$raw" "\\.${ext}" "$lf"
    local r; r=$(parse_release_lines "$lf" "" "$max")
    rm -f "$lf"

    local json="[$r]"
    printf '%s\n' "$json" > "$LUCI_RELEASES_FILE"
    printf '%s\n' "$json"
}

install_luci_pkg() {
    case "$1" in
        apk)  apk  add --allow-untrusted "$2" >/dev/null 2>&1 ;;
        opkg) opkg install               "$2" >/dev/null 2>&1 ;;
        *)    return 1 ;;
    esac
}

check_releases_count() {
    local json="$1" label="$2" prefix="$3"
    { [ -z "$json" ] || [ "$json" = "[]" ]; } && die "$prefix" "No $label releases found"
    printf '%s' "$json" | grep -o '"tag"' | wc -l | tr -d ' '
}

cmd_check() {
    local mirror="${1:-$(uci_get mirror github)}"
    local release_type="${2:-$(uci_get release_type stable)}"
    local variant="${3:-$(uci_get variant lucky)}"
    local arch="${4:-$(detect_arch)}"

    init_dir
    write_status "" "checking"
    log "Check: mirror=$mirror type=$release_type variant=$variant arch=$arch"

    local releases_json
    case "$mirror" in
        github)
            releases_json=$(fetch_github_releases "$arch")
            ;;
        r66666)
            local tags_file="$UPDATE_DIR/tags.txt"
            fetch_r66666_tags "$release_type" "$tags_file"
            [ -s "$tags_file" ] || die "" "No matching version tags"
            local entry result_arr=""
            while IFS= read -r tag; do
                [ -z "$tag" ] && continue
                entry=$(fetch_r66666_release_files "$tag" "$variant" "$arch")
                [ -n "$entry" ] && result_arr="${result_arr:+$result_arr,}$entry"
            done < "$tags_file"
            releases_json="[$result_arr]"
            ;;
        *) die "" "Unknown mirror: $mirror" ;;
    esac

    local count; count=$(check_releases_count "$releases_json" "lucky" "")
    printf '%s\n' "$releases_json" > "$RELEASES_FILE"
    log "Found releases: $count"
    write_status "" "ready:$count"
}

cmd_check_luci() {
    local pm; pm=$(detect_pm)
    [ -z "$pm" ] && die "luci" "No package manager found"
    init_dir
    write_status "luci" "checking"
    local json; json=$(fetch_luci_releases "$pm" 5)
    local count; count=$(check_releases_count "$json" "luci" "luci")
    log "Luci: $count"
    write_status "luci" "ready:$count"
}

do_download() {
    local releases_file="$1" tag="$2" filename="$3" prefix="$4"
    local url; url=$(extract_url_from_releases "$releases_file" "$filename")
    [ -z "$url" ] && die "$prefix" "URL not found for $filename"

    init_dir
    write_status "$prefix" "downloading:$tag"
    log "Downloading: $filename"
    log "From: $url"
    local f="$UPDATE_DIR/$filename"
    http_get "$url" "$f" || die "$prefix" "Download failed: $url"
    [ -s "$f" ]          || die "$prefix" "Downloaded file empty"
    log "Download complete: $(du -sh "$f" 2>/dev/null | cut -f1)"
    echo "$f"
}

cmd_download() {
    local tag="$1" filename="$2" binpath="${3:-$(uci_get binpath /usr/bin/lucky)}"
    [ -z "$tag" ]      && die "" "download: missing tag"
    [ -z "$filename" ] && die "" "download: missing filename"

    local dl; dl=$(do_download "$RELEASES_FILE" "$tag" "$filename" "")
    write_status "" "installing:$tag"

    local xdir="$UPDATE_DIR/extract"
    rm -rf "$xdir" && mkdir -p "$xdir"
    log "Extracting..."
    case "$filename" in
        *.tar.gz|*.tgz) tar -xzf "$dl" -C "$xdir" 2>/dev/null \
                             || die "" "Extract failed: $filename" ;;
        *) die "" "Unsupported format: $filename" ;;
    esac

    local bin; bin=$(find "$xdir" -type f -name "lucky" | head -1)
    [ -z "$bin" ] && die "" "Binary 'lucky' not found in archive"
    log "Found binary: $bin"

    mkdir -p "$(dirname "$binpath")"
    log "Stopping service..."
    /etc/init.d/lucky stop 2>/dev/null; sleep 1

    log "Installing: $binpath"
    cp "$bin" "$binpath" && chmod 755 "$binpath" || die "" "Failed to install $binpath"
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
    [ -z "$tag" ]      && die "luci" "download_luci: missing tag"
    [ -z "$filename" ] && die "luci" "download_luci: missing filename"

    local pm; pm=$(detect_pm)
    [ -z "$pm" ] && die "luci" "No package manager found"

    local dl; dl=$(do_download "$LUCI_RELEASES_FILE" "$tag" "$filename" "luci")
    write_status "luci" "installing_luci:$tag"
    log "Installing luci package..."
    install_luci_pkg "$pm" "$dl" || die "luci" "Install failed"
    rm -f "$dl"

    local lang; lang=$(detect_lang)
    log "Detected language: ${lang:-none}"
    if [ -n "$lang" ] && [ "$lang" != "en" ] && [ -f "$LUCI_RELEASES_FILE" ]; then
        log "looking for i18n package: $lang"
        local lf lu
        lf=$(grep -o "\"name\":\"[^\"]*i18n[^\"]*${lang}[^\"]*\"" "$LUCI_RELEASES_FILE" \
             | cut -d'"' -f4 | head -1)
        lu=$([ -n "$lf" ] && extract_url_from_releases "$LUCI_RELEASES_FILE" "$lf")
        if [ -n "$lu" ]; then
            log "Installing language pack: $lf"
            local ldl="$UPDATE_DIR/$lf"
            http_get "$lu" "$ldl" && install_luci_pkg "$pm" "$ldl" \
                && log "Language pack installed: $lf" \
                || log "WARN: Lang pack failed"
            rm -f "$ldl"
        fi
    fi

    log "Luci installed: $tag"
    write_status "luci" "luci_done:$tag"
}

maybe_update() {
    local cur="$1" latest="$2" label="$3"
    if [ -n "$cur" ] && [ -n "$latest" ] && ! version_lt "$cur" "$latest"; then
        log "$label up to date ($cur)"
        return 1
    fi
}

cmd_auto() {
    local mirror release_type variant arch binpath
    mirror=$(uci_get mirror github)
    release_type=$(uci_get release_type stable)
    variant=$(uci_get variant lucky)
    arch=$(detect_arch)
    binpath=$(uci_get binpath /usr/bin/lucky)

    init_dir
    log "Auto update: mirror=$mirror type=$release_type variant=$variant arch=$arch"

    local cur_ver=""
    if [ -x "$binpath" ]; then
        cur_ver=$(get_installed_version)
        log "Current lucky: ${cur_ver:-unknown}"
    else
        log "Lucky binary not found, auto download"
    fi

    cmd_check "$mirror" "$release_type" "$variant" "$arch"
    [ -f "$RELEASES_FILE" ] || die "" "No releases file after check"

    local latest_tag best_file
    latest_tag=$(parse_first_field "tag"  "$RELEASES_FILE")
    best_file=$(parse_first_field  "best" "$RELEASES_FILE")
    [ -z "$latest_tag" ] && die "" "Cannot parse latest tag"
    [ -z "$best_file"  ] && die "" "Cannot parse best file"

    maybe_update "$cur_ver" "$(tag_to_ver "$latest_tag")" "Lucky" \
        && cmd_download "$latest_tag" "$best_file" "$binpath"

    local pm; pm=$(detect_pm)
    [ -z "$pm" ] && { log "No package manager, skip luci"; return; }

    local luci_json; luci_json=$(fetch_luci_releases "$pm" 5)
    [ -z "$luci_json" ] || [ "$luci_json" = "[]" ] && { log "WARN: No luci releases"; return; }

    local luci_tag luci_file luci_cur
    luci_tag=$(parse_first_field "tag"  "$LUCI_RELEASES_FILE")
    luci_file=$(parse_first_field "best" "$LUCI_RELEASES_FILE")
    luci_cur=$(get_luci_version "$pm")
    log "Luci current: ${luci_cur:-unknown}"
    log "Latest: $luci_tag"

    maybe_update "$luci_cur" "$(tag_to_ver "$luci_tag")" "Luci" \
        && cmd_download_luci "$luci_tag" "$luci_file"

    log "Auto update complete"
}

case "$1" in
    check)         LOG_TO_FILE="$LOG_FILE"      : > "$LOG_FILE";      cmd_check "$2" "$3" "$4" "$5" ;;
    download)      LOG_TO_FILE="$LOG_FILE"      : > "$LOG_FILE";      cmd_download "$2" "$3" "$4" ;;
    check_luci)    LOG_TO_FILE="$LUCI_LOG_FILE" : > "$LUCI_LOG_FILE"; cmd_check_luci ;;
    download_luci) LOG_TO_FILE="$LUCI_LOG_FILE" : > "$LUCI_LOG_FILE"; cmd_download_luci "$2" "$3" ;;
    auto|"")       LOG_TO_FILE="$AUTO_LOG"      : > "$AUTO_LOG";      cmd_auto ;;
    detect_arch)   detect_arch ;;
    detect_pm)     detect_pm ;;
    *)
        echo "Usage: $0 {check|download|check_luci|download_luci|auto|detect_arch|detect_pm}"
        exit 1 ;;
esac