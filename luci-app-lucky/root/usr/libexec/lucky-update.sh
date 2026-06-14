#!/bin/sh

UPDATE_DIR="/tmp/lucky_update"
STATUS_FILE="$UPDATE_DIR/status"
LOG_FILE="$UPDATE_DIR/log"
RELEASES_FILE="$UPDATE_DIR/releases.json"
LUCI_RELEASES_FILE="$UPDATE_DIR/luci_releases.json"
LUCI_STATUS_FILE="$UPDATE_DIR/luci_status"
LUCI_LOG_FILE="$UPDATE_DIR/luci_log"
AUTO_LOG="/var/log/lucky-autoupdate.log"

GITHUB_API="https://api.github.com/repos/gdy666/lucky/releases"
MIRROR_BASE="https://release.66666.host"

LUCI_APIS="
https://api.github.com/repos/whzhni1/luci-app-lucky/releases
https://gitlab.com/api/v4/projects/whzhni%2Fluci-app-lucky/releases
https://gitee.com/api/v5/repos/whzhni/luci-app-lucky/releases
"

log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$msg" >&2
    [ -n "$LOG_TO_FILE" ] && echo "$msg" >> "$LOG_TO_FILE"
}

init_dir() {
    [ -d "$UPDATE_DIR" ] || mkdir -p "$UPDATE_DIR"
}

uci_get() {
    local val; val=$(uci -q get "lucky.lucky.$1" 2>/dev/null)
    echo "${val:-$2}"
}

write_status() {
    local file content
    [ "$1" = "luci" ] && file="$LUCI_STATUS_FILE" || file="$STATUS_FILE"
    content="$2"
    echo "$content" > "$file"
}

die() {
    log "ERROR: $2"
    write_status "$1" "error:$2"
    exit 1
}

http_get() {
    local url="$1" out="$2" timeout="${3:-60}"
    if command -v wget >/dev/null 2>&1; then
        wget -qO "$out" --timeout="$timeout" "$url"
    elif command -v curl >/dev/null 2>&1; then
        curl -fsSL --connect-timeout 15 --max-time "$timeout" -o "$out" "$url"
    else
        return 1
    fi
}

http_get_var() {
    local url="$1" ct="${2:-15}" mt="${3:-30}"
    if command -v wget >/dev/null 2>&1; then
        wget -qO- --timeout="$mt" "$url" 2>/dev/null
    elif command -v curl >/dev/null 2>&1; then
        curl -fsSL --connect-timeout "$ct" --max-time "$mt" "$url" 2>/dev/null
    fi
}

detect_pm() {
    if   command -v apk  >/dev/null 2>&1; then echo "apk"
    elif command -v opkg >/dev/null 2>&1; then echo "opkg"
    fi
}

detect_arch() {
    local uci_arch; uci_arch=$(uci -q get lucky.lucky.arch 2>/dev/null)
    if [ -n "$uci_arch" ] && [ "$uci_arch" != "auto" ]; then
        echo "$uci_arch"; return
    fi
    local m; m=$(uname -m)
    case "$m" in
        x86_64)              echo "x86_64" ;;
        i386|i486|i586|i686) echo "i386" ;;
        aarch64|arm64)       echo "arm64" ;;
        armv7*)              echo "armv7" ;;
        armv6*)              echo "armv6" ;;
        armv5*)              echo "armv5" ;;
        riscv64)             echo "riscv64" ;;
        mips)
            grep -q "FPU" /proc/cpuinfo 2>/dev/null \
                && echo "mips_hardfloat" || echo "mips_softfloat" ;;
        mipsel|mipsle)
            grep -q "FPU" /proc/cpuinfo 2>/dev/null \
                && echo "mipsle_hardfloat" || echo "mipsle_softfloat" ;;
        *)                   echo "x86_64" ;;
    esac
}

detect_lang() {
    for f in /usr/lib/lua/luci/i18n/*.lmo; do
        [ -f "$f" ] || continue
        local tmp="${f%.lmo}"; echo "${tmp##*.}"
    done | sort | uniq -c | sort -nr | head -1 | awk '{print $2}'
}

extract_version() {
    grep -iE 'version[^0-9]*[0-9]' | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1
}

get_lucky_version() {
    "${1:-$(uci_get binpath /usr/bin/lucky)}" version 2>/dev/null | extract_version
}

get_luci_version() {
    case "$1" in
        apk)  apk info luci-app-lucky 2>/dev/null \
                  | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 ;;
        opkg) opkg info luci-app-lucky 2>/dev/null \
                  | grep '^Version:' | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 ;;
    esac
}

version_lt() {
    local higher; higher=$(printf '%s\n%s' "$1" "$2" | sort -V | tail -1)
    [ "$higher" = "$2" ] && [ "$1" != "$2" ]
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

parse_release_lines() {
    local lines_file="$1" arch="$2" max_count="${3:-999}"
    local result_arr="" count=0
    local cur_tag="" files_json="" best_name="" best_url=""

    while IFS= read -r line; do
        [ -z "$line" ] && continue
        case "$line" in
            '"tag_name":"'*)
                if [ -n "$cur_tag" ] && [ -n "$files_json" ] && [ "$count" -lt "$max_count" ]; then
                    result_arr="${result_arr:+${result_arr},}{\"tag\":\"${cur_tag}\",\"best\":\"${best_name}\",\"best_url\":\"${best_url}\",\"files\":[${files_json}]}"
                    count=$((count + 1))
                fi
                cur_tag=$(echo "$line" | cut -d'"' -f4)
                files_json="" best_name="" best_url=""
                log "Found tag: $cur_tag"
                ;;
            https://*)
                local fname="${line##*/}"
                [ -z "$fname" ] && continue
                echo "$files_json" | grep -q "\"${fname}\"" && continue
                files_json="${files_json:+${files_json},}{\"name\":\"${fname}\",\"url\":\"${line}\"}"
                if [ -z "$best_name" ]; then
                    if [ -z "$arch" ] || echo "$fname" | grep -q "_${arch}[._]"; then
                        best_name="$fname"; best_url="$line"
                    fi
                fi
                ;;
        esac
    done < "$lines_file"

    if [ -n "$cur_tag" ] && [ -n "$files_json" ] && [ "$count" -lt "$max_count" ]; then
        result_arr="${result_arr:+${result_arr},}{\"tag\":\"${cur_tag}\",\"best\":\"${best_name}\",\"best_url\":\"${best_url}\",\"files\":[${files_json}]}"
    fi

    printf '%s' "$result_arr"
}

fetch_api_lines() {
    local raw="$1" ext="$2" out="$3"
    echo "$raw" \
        | sed 's/": "/":"/g; s/": /:/g' \
        | grep -o '"tag_name":"[^"]*"\|https://[^"]*'"${ext}" \
        > "$out"
    log "Extracted $(wc -l < "$out" | tr -d ' ') lines"
}

fetch_github_releases() {
    local arch="$1" api_url="${GITHUB_API}?per_page=100"
    log "Fetching GitHub API: $api_url"

    local raw; raw=$(http_get_var "$api_url" 15 30)
    if [ -z "$raw" ] || ! echo "$raw" | grep -q '"tag_name"'; then
        log "Response head: $(echo "$raw" | head -3)"
        die "" "GitHub API request failed or response invalid"
    fi

    local lines_file="$UPDATE_DIR/gh_lines.txt"
    fetch_api_lines "$raw" "_Linux_[^\"]*\\.tar\\.gz" "$lines_file"

    local result_arr; result_arr=$(parse_release_lines "$lines_file" "$arch")
    rm -f "$lines_file"
    printf '[%s]\n' "$result_arr"
}

fetch_r66666_tags() {
    local release_type="$1" out_file="$2"
    local tmp="$UPDATE_DIR/r66666_root.html"

    log "Fetching mirror index: ${MIRROR_BASE}/"
    http_get "${MIRROR_BASE}/" "$tmp" || die "" "Failed to fetch mirror index"
    [ -s "$tmp" ] || die "" "Empty response from mirror index"

    local all_tags
    all_tags=$(parse_dir_listing "$tmp" | grep '^v' | grep '/$' | sed 's|/$||')
    log "All tags found: $(echo "$all_tags" | tr '\n' ' ')"

    case "$release_type" in
        stable) echo "$all_tags" | grep -E  '^v[0-9]+\.[0-9]+\.[0-9]+$' ;;
        beta)   echo "$all_tags" | grep -Ev '^v[0-9]+\.[0-9]+\.[0-9]+$' ;;
        *)      echo "$all_tags" ;;
    esac | sort -Vr > "$out_file"
}

fetch_r66666_release_files() {
    local tag="$1" variant="$2" arch="$3"
    local ver="${tag#v}" ver_url="${MIRROR_BASE}/${tag}/"
    local tmp_ver="$UPDATE_DIR/r66666_ver.html"

    log "Fetching version index: ${ver_url}"
    http_get "$ver_url" "$tmp_ver" || { log "WARN: Failed to fetch ${ver_url}"; return; }
    [ -s "$tmp_ver" ] || { log "WARN: Empty version index for ${tag}"; return; }

    local subdirs chosen_sub
    subdirs=$(parse_dir_listing "$tmp_ver" \
        | grep '/$' | sed 's|/$||' | grep "${variant}" | grep -v 'docker')
    log "Available subdirs for ${tag}: $(echo "$subdirs" | tr '\n' ' ')"

    chosen_sub=$(echo "$subdirs" | grep -E "^${ver}_${variant}$" | head -1)
    [ -z "$chosen_sub" ] && chosen_sub=$(echo "$subdirs" | head -1)
    [ -z "$chosen_sub" ] && { log "WARN: No matching subdir for variant=${variant} in ${tag}"; return; }

    log "Selected subdir: ${chosen_sub}"
    local sub_url="${MIRROR_BASE}/${tag}/${chosen_sub}/"
    local tmp_sub="$UPDATE_DIR/r66666_sub.html"

    http_get "$sub_url" "$tmp_sub" || { log "WARN: Failed to fetch ${sub_url}"; return; }
    [ -s "$tmp_sub" ] || { log "WARN: Empty subdir listing"; return; }

    local filenames
    filenames=$(parse_dir_listing "$tmp_sub" \
        | grep -v '/$' | grep '^lucky_' | grep '_Linux_' | grep '\.tar\.gz$')
    log "Files found: $(echo "$filenames" | tr '\n' ' ')"
    [ -z "$filenames" ] && { log "WARN: No matching files in ${chosen_sub}"; return; }

    local files_json="" best_name="" fname url
    while IFS= read -r fname; do
        [ -z "$fname" ] && continue
        url="${sub_url}${fname}"
        files_json="${files_json:+${files_json},}{\"name\":\"${fname}\",\"url\":\"${url}\"}"
        if [ -z "$best_name" ] && echo "$fname" | grep -q "_${arch}[._]"; then
            best_name="$fname"
        fi
    done << EOF
$filenames
EOF
    [ -z "$best_name" ] && best_name=$(printf '%s\n' "$filenames" | head -1)

    printf '{"tag":"%s","variant":"%s","best":"%s","best_url":"%s","files":[%s]}' \
        "$tag" "$variant" "$best_name" "${sub_url}${best_name}" "$files_json"
}

fetch_luci_releases() {
    local pm="$1" max_count="${2:-5}"
    local ext; case "$pm" in apk) ext="apk" ;; *) ext="ipk" ;; esac

    local raw="" api_url=""
    while IFS= read -r api_url; do
        [ -z "$api_url" ] && continue
        log "Trying luci API: $api_url"
        raw=$(http_get_var "$api_url" 3 15)
        if [ -n "$raw" ] && echo "$raw" | grep -q '"tag_name"'; then
            log "Got response from: $api_url"; break
        fi
        log "WARN: No response from $api_url, trying next"
        raw=""
    done << EOF
$(echo "$LUCI_APIS" | grep -v '^$')
EOF

    if [ -z "$raw" ]; then
        log "ERROR: All luci API endpoints failed"; return 1
    fi

    local lines_file="$UPDATE_DIR/luci_lines.txt"
    fetch_api_lines "$raw" "\\.${ext}" "$lines_file"

    local result_arr; result_arr=$(parse_release_lines "$lines_file" "" "$max_count")
    rm -f "$lines_file"

    local releases_json="[${result_arr}]"
    printf '%s\n' "$releases_json" > "$LUCI_RELEASES_FILE"
    printf '%s\n' "$releases_json"
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
    { [ -z "$json" ] || [ "$json" = "[]" ]; } \
        && die "$prefix" "No ${label} releases found"
    printf '%s' "$json" | grep -o '"tag"' | wc -l | tr -d ' '
}

cmd_check() {
    local mirror="${1:-$(uci_get mirror github)}"
    local release_type="${2:-$(uci_get release_type stable)}"
    local variant="${3:-$(uci_get variant lucky)}"
    local arch="${4:-$(detect_arch)}"

    init_dir
    write_status "" "checking"
    log "Check: mirror=$mirror release_type=$release_type variant=$variant arch=$arch"

    local releases_json=""
    case "$mirror" in
        github)
            releases_json=$(fetch_github_releases "$arch")
            ;;
        r66666)
            local tags_file="$UPDATE_DIR/tags.txt"
            fetch_r66666_tags "$release_type" "$tags_file"
            [ -s "$tags_file" ] || die "" "No matching version tags found"
            log "Tags to process: $(tr '\n' ' ' < "$tags_file")"

            local entry result_arr=""
            while IFS= read -r tag; do
                [ -z "$tag" ] && continue
                log "--- Processing tag: $tag ---"
                entry=$(fetch_r66666_release_files "$tag" "$variant" "$arch")
                [ -n "$entry" ] && result_arr="${result_arr:+${result_arr},}${entry}"
            done < "$tags_file"
            releases_json="[${result_arr}]"
            ;;
        *)
            die "" "Unknown mirror: $mirror"
            ;;
    esac

    local count; count=$(check_releases_count "$releases_json" "lucky" "")
    printf '%s\n' "$releases_json" > "$RELEASES_FILE"
    log "Found $count release(s), saved to $RELEASES_FILE"
    write_status "" "ready:$count"
}

cmd_check_luci() {
    local pm; pm=$(detect_pm)
    [ -z "$pm" ] && die "luci" "No package manager found"

    init_dir
    write_status "luci" "checking"
    log "Check luci: pm=$pm"

    local releases_json; releases_json=$(fetch_luci_releases "$pm" 5)
    local count; count=$(check_releases_count "$releases_json" "luci" "luci")
    log "Luci: found $count release(s)"
    write_status "luci" "ready:$count"
}

do_download() {
    local releases_file="$1" tag="$2" filename="$3" prefix="$4"
    local download_url
    [ -f "$releases_file" ] && download_url=$(extract_url_from_releases "$releases_file" "$filename")
    [ -z "$download_url" ] && die "$prefix" "URL not found for $filename"

    init_dir
    write_status "$prefix" "downloading:$tag"
    log "Downloading $filename from: $download_url"

    local dl_file="$UPDATE_DIR/$filename"
    http_get "$download_url" "$dl_file" || die "$prefix" "Download failed: $download_url"
    [ -s "$dl_file" ] || die "$prefix" "Downloaded file is empty"
    log "Download complete ($(du -sh "$dl_file" 2>/dev/null | cut -f1))"
    echo "$dl_file"
}

cmd_download() {
    local tag="$1" filename="$2"
    local binpath="${3:-$(uci_get binpath /usr/bin/lucky)}"

    [ -z "$tag" ]      && die "" "download: missing tag"
    [ -z "$filename" ] && die "" "download: missing filename"

    local dl_file; dl_file=$(do_download "$RELEASES_FILE" "$tag" "$filename" "")
    write_status "" "installing:$tag"
    log "Extracting..."

    local extract_dir="$UPDATE_DIR/extract"
    rm -rf "$extract_dir" && mkdir -p "$extract_dir"

    case "$filename" in
        *.tar.gz|*.tgz) tar -xzf "$dl_file" -C "$extract_dir" 2>/dev/null \
                             || die "" "Failed to extract $filename" ;;
        *)               die "" "Unsupported archive format: $filename" ;;
    esac

    local new_bin; new_bin=$(find "$extract_dir" -type f -name "lucky" | head -1)
    [ -z "$new_bin" ] && die "" "Binary 'lucky' not found in archive"
    log "Found binary: $new_bin ($(du -sh "$new_bin" 2>/dev/null | cut -f1))"

    local bindir; bindir=$(dirname "$binpath")
    [ -d "$bindir" ] || mkdir -p "$bindir"

    log "Stopping service..."
    /etc/init.d/lucky stop 2>/dev/null || true
    sleep 1

    log "Installing: lucky -> $binpath"
    cp "$new_bin" "$binpath" || die "" "Failed to copy lucky to $binpath"
    chmod +x "$binpath"
    rm -rf "$extract_dir" "$dl_file"

    log "Starting service..."
    /etc/init.d/lucky start 2>/dev/null || true

    local new_version; new_version=$(get_lucky_version "$binpath")
    log "Installation complete: ${new_version:-$tag}"
    write_status "" "done:${new_version:-$tag}"
}

cmd_download_luci() {
    local tag="$1" filename="$2"
    [ -z "$tag" ]      && die "luci" "download_luci: missing tag"
    [ -z "$filename" ] && die "luci" "download_luci: missing filename"

    local pm; pm=$(detect_pm)
    [ -z "$pm" ] && die "luci" "No package manager found"

    local dl_file; dl_file=$(do_download "$LUCI_RELEASES_FILE" "$tag" "$filename" "luci")
    write_status "luci" "installing_luci:$tag"
    log "Installing luci package..."

    install_luci_pkg "$pm" "$dl_file" || die "luci" "Failed to install luci package"
    rm -f "$dl_file"

    local lang; lang=$(detect_lang)
    if [ -n "$lang" ] && [ "$lang" != "en" ] && [ -f "$LUCI_RELEASES_FILE" ]; then
        log "Detected language: $lang, looking for i18n package..."
        local lang_file
        lang_file=$(grep -o "\"name\":\"[^\"]*i18n[^\"]*${lang}[^\"]*\"" "$LUCI_RELEASES_FILE" \
            | cut -d'"' -f4 | head -1)
        if [ -n "$lang_file" ]; then
            local lang_url; lang_url=$(extract_url_from_releases "$LUCI_RELEASES_FILE" "$lang_file")
            if [ -n "$lang_url" ]; then
                log "Installing language pack: $lang_file"
                local lang_dl="$UPDATE_DIR/$lang_file"
                http_get "$lang_url" "$lang_dl" 15 \
                    && install_luci_pkg "$pm" "$lang_dl" \
                    && log "Language pack installed: $lang_file" \
                    || log "WARN: Language pack install failed"
                rm -f "$lang_dl"
            fi
        fi
    fi

    log "Luci installation complete: $tag"
    write_status "luci" "luci_done:$tag"
}

maybe_update() {
    local cur="$1" latest="$2" label="$3"
    if [ -n "$cur" ] && [ -n "$latest" ] && ! version_lt "$cur" "$latest"; then
        log "$label already up to date (${cur}), skipping."
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
    log "=== Auto update: mirror=$mirror release_type=$release_type variant=$variant arch=$arch ==="

    local cur_version; cur_version=$(get_lucky_version "$binpath")
    log "Current lucky version: ${cur_version:-unknown}"

    cmd_check "$mirror" "$release_type" "$variant" "$arch"
    [ -f "$RELEASES_FILE" ] || die "" "No releases file after check"

    local latest_tag best_file best_url
    latest_tag=$(parse_first_field "tag"      "$RELEASES_FILE")
    best_file=$(parse_first_field  "best"     "$RELEASES_FILE")
    best_url=$(parse_first_field   "best_url" "$RELEASES_FILE")

    [ -z "$latest_tag" ] && die "" "Could not parse latest tag"
    [ -z "$best_file"  ] && die "" "Could not parse best file"
    [ -z "$best_url"   ] && die "" "Could not parse best_url"

    log "Latest: $latest_tag  File: $best_file"
    local latest_ver; latest_ver=$(echo "$latest_tag" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)

    if maybe_update "$cur_version" "$latest_ver" "Lucky"; then
        cmd_download "$latest_tag" "$best_file" "$binpath"
    fi

    local pm; pm=$(detect_pm)
    [ -z "$pm" ] && { log "No package manager, skipping luci update"; return; }

    log "--- Checking luci-app-lucky update ---"
    local luci_json; luci_json=$(fetch_luci_releases "$pm" 5)
    if [ -z "$luci_json" ] || [ "$luci_json" = "[]" ]; then
        log "WARN: Could not fetch luci releases"; return
    fi

    local luci_tag luci_file
    luci_tag=$(parse_first_field "tag"  "$LUCI_RELEASES_FILE")
    luci_file=$(parse_first_field "best" "$LUCI_RELEASES_FILE")
    local cur_luci_ver; cur_luci_ver=$(get_luci_version "$pm")
    local luci_ver; luci_ver=$(echo "$luci_tag" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    log "Luci current: ${cur_luci_ver:-unknown}  Latest: $luci_tag"

    if maybe_update "$cur_luci_ver" "$luci_ver" "Luci"; then
        cmd_download_luci "$luci_tag" "$luci_file"
    fi

    log "=== Auto update complete ==="
}

case "$1" in
    check)         LOG_TO_FILE="$LOG_FILE"      cmd_check "$2" "$3" "$4" "$5" ;;
    download)      LOG_TO_FILE="$LOG_FILE"      cmd_download "$2" "$3" "$4" ;;
    check_luci)    LOG_TO_FILE="$LUCI_LOG_FILE" cmd_check_luci ;;
    download_luci) LOG_TO_FILE="$LUCI_LOG_FILE" cmd_download_luci "$2" "$3" ;;
    auto|"")       LOG_TO_FILE="$AUTO_LOG"      cmd_auto ;;
    detect_arch)   detect_arch ;;
    detect_pm)     detect_pm ;;
    *)
        echo "Usage: $0 {check|download|check_luci|download_luci|auto|detect_arch|detect_pm}"
        exit 1 ;;
esac
