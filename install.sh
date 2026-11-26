#!/bin/bash
# ============================================================================
#  蓝牙音箱插件 · Steam Deck 手动安装脚本
#
#  用途：绕过 Decky 的「Install Plugin from ZIP」界面，直接解压到插件目录。
#        当 UI 安装静默失败（进度条闪一下就关）时，用这个能看到真实错误。
#
#  用法（在 Deck 的桌面模式 Konsole 里）：
#      bash install.sh                    # 安装当前目录的 zip
#      bash install.sh /path/to/xxx.zip   # 指定 zip
#      bash install.sh --uninstall        # 卸载
#      bash install.sh --diag             # 只做环境诊断，不安装
# ============================================================================

set -u

PLUGIN_DIR_NAME="decky-bt-speaker"
PLUGINS_ROOT="$HOME/homebrew/plugins"
TARGET="$PLUGINS_ROOT/$PLUGIN_DIR_NAME"

RED=$'\033[91m'; GREEN=$'\033[92m'; YELLOW=$'\033[93m'; DIM=$'\033[90m'; RESET=$'\033[0m'
ok()   { echo "  ${GREEN}✓${RESET} $*"; }
err()  { echo "  ${RED}✗${RESET} $*"; }
warn() { echo "  ${YELLOW}!${RESET} $*"; }
info() { echo "  ${DIM}·${RESET} $*"; }
hr()   { echo "────────────────────────────────────────────────────"; }

# ---------------------------------------------------------------------------
# 诊断
# ---------------------------------------------------------------------------
do_diag() {
    hr; echo "环境诊断"; hr

    echo "[系统]"
    info "主机名: $(hostname 2>/dev/null)"
    info "用户: $(whoami)  HOME=$HOME"
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        info "系统: ${PRETTY_NAME:-未知}"
    fi
    info "locale: LANG=${LANG:-未设置} LC_ALL=${LC_ALL:-未设置}"

    echo
    echo "[Decky Loader]"
    if systemctl is-active --quiet plugin_loader 2>/dev/null; then
        ok "plugin_loader 服务运行中"
    else
        err "plugin_loader 服务未运行"
        warn "试试: sudo systemctl status plugin_loader"
    fi
    if [ -d "$HOME/homebrew" ]; then
        ok "homebrew 目录存在: $HOME/homebrew"
    else
        err "homebrew 目录不存在 —— Decky Loader 可能没装好"
    fi
    if [ -d "$PLUGINS_ROOT" ]; then
        ok "插件目录存在"
        local n
        n=$(ls -1 "$PLUGINS_ROOT" 2>/dev/null | wc -l)
        info "已安装插件数: $n"
        if [ "$n" -gt 0 ]; then
            echo "    已装插件："
            ls -1 "$PLUGINS_ROOT" 2>/dev/null | sed 's/^/      - /'
        fi
    else
        err "插件目录不存在: $PLUGINS_ROOT"
    fi

    echo
    echo "[音频栈]"
    for cmd in bluetoothctl busctl wpctl pactl pw-dump pw-link; do
        if command -v "$cmd" >/dev/null 2>&1; then
            ok "$cmd -> $(command -v "$cmd")"
        else
            err "$cmd 不存在"
        fi
    done

    echo
    echo "[蓝牙适配器]"
    if command -v bluetoothctl >/dev/null 2>&1; then
        if bluetoothctl show 2>/dev/null | grep -q Controller; then
            ok "检测到适配器"
            bluetoothctl show 2>/dev/null | grep -E 'Controller|Powered|Discoverable|Name:|Alias:' | sed 's/^/      /'
            if bluetoothctl show 2>/dev/null | grep -qi '0000110b'; then
                ok "支持 A2DP Sink（可以当音箱）"
            else
                err "没有 Audio Sink UUID —— 可能无法当音箱"
            fi
        else
            err "没有可用适配器"
        fi
    fi

    echo
    echo "[版本]"
    info "PipeWire: $(pipewire --version 2>/dev/null | head -1 || echo 未知)"
    info "WirePlumber: $(wireplumber --version 2>/dev/null | head -1 || echo 未知)"
    info "BlueZ: $(bluetoothctl --version 2>/dev/null || echo 未知)"

    echo
    echo "[最近的 Decky 日志（可能有安装失败的原因）]"
    if command -v journalctl >/dev/null 2>&1; then
        journalctl -u plugin_loader --no-pager -n 30 2>/dev/null | tail -30 | sed 's/^/  /' \
            || warn "读不到 journalctl（可能需要 sudo）"
    else
        warn "没有 journalctl"
    fi

    hr
}

# ---------------------------------------------------------------------------
# 卸载
# ---------------------------------------------------------------------------
do_uninstall() {
    hr; echo "卸载 $PLUGIN_DIR_NAME"; hr
    if [ -d "$TARGET" ]; then
        rm -rf "$TARGET" && ok "已删除 $TARGET" || { err "删除失败，可能需要 sudo"; exit 1; }
    else
        warn "未安装（$TARGET 不存在）"
    fi
    restart_loader
}

restart_loader() {
    echo
    echo "重启 Decky Loader..."
    if sudo -n systemctl restart plugin_loader 2>/dev/null; then
        ok "已重启（免密 sudo）"
    else
        warn "需要 sudo 密码，请输入："
        if sudo systemctl restart plugin_loader; then
            ok "已重启"
        else
            err "重启失败 —— 请手动执行: sudo systemctl restart plugin_loader"
            return 1
        fi
    fi
    sleep 2
    if systemctl is-active --quiet plugin_loader; then
        ok "plugin_loader 正在运行"
    else
        err "plugin_loader 没起来，看日志: sudo journalctl -u plugin_loader -n 50"
    fi
}

# ---------------------------------------------------------------------------
# 安装
# ---------------------------------------------------------------------------
do_install() {
    local zip="$1"

    hr; echo "安装 $PLUGIN_DIR_NAME"; hr

    if [ ! -f "$zip" ]; then
        err "找不到 zip: $zip"
        echo
        echo "用法: bash install.sh [zip路径]"
        echo "  不给参数时会在当前目录和常见位置找 $PLUGIN_DIR_NAME*.zip"
        exit 1
    fi
    info "源文件: $zip  ($(du -h "$zip" | cut -f1))"

    # --- 校验 1：zip 层级 ---
    echo
    echo "[校验 zip 结构]"
    if ! command -v unzip >/dev/null 2>&1; then
        err "缺少 unzip，先装: sudo pacman -S unzip"
        exit 1
    fi

    local list
    list=$(unzip -Z1 "$zip" 2>/dev/null)
    if [ -z "$list" ]; then
        err "zip 读不出来（文件损坏？）"
        exit 1
    fi

    # depth==1 的 plugin.json 必须恰好 1 个
    local hits
    hits=$(echo "$list" | awk -F/ 'NF==2 && $2=="plugin.json"' | wc -l)
    if [ "$hits" -ne 1 ]; then
        err "depth==1 的 plugin.json 数量 = $hits（必须恰好 1）"
        echo "    实际结构："
        echo "$list" | head -10 | sed 's/^/      /'
        echo
        warn "如果是 0 个：zip 里 plugin.json 在根（扁平），或嵌套太深"
        exit 1
    fi
    ok "层级正确：$(echo "$list" | awk -F/ 'NF==2 && $2=="plugin.json"')"

    # 非 ASCII 文件名检查
    local nonascii
    nonascii=$(echo "$list" | LC_ALL=C grep -P '[^\x00-\x7F]' 2>/dev/null | head -5)
    if [ -n "$nonascii" ]; then
        warn "zip 里有非 ASCII 文件名（Decky 可能解压失败）："
        echo "$nonascii" | sed 's/^/      /'
    else
        ok "文件名全 ASCII"
    fi

    # 必需文件
    local top
    top=$(echo "$list" | awk -F/ 'NF==2 && $2=="plugin.json"' | cut -d/ -f1)
    for f in main.py dist/index.js package.json; do
        if echo "$list" | grep -qx "$top/$f"; then
            ok "包含 $f"
        else
            err "缺少 $f"
            if [ "$f" = "package.json" ]; then
                echo "      ${RED}package.json 是必需的${RESET}：Decky 靠它的 type 字段决定加载方式。"
                echo "      缺了会按旧版 IIFE 用 eval() 加载 ESM 产物，报 Unexpected token 'export'"
            fi
            exit 1
        fi
    done

    # package.json 的 type 必须是 module
    local tmp0
    tmp0=$(mktemp -d)
    unzip -q -o "$zip" "$top/package.json" -d "$tmp0" 2>/dev/null
    if [ -f "$tmp0/$top/package.json" ]; then
        if grep -q '"type"[[:space:]]*:[[:space:]]*"module"' "$tmp0/$top/package.json"; then
            ok "package.json type = module（ESM 加载）"
        else
            err "package.json 的 type 不是 \"module\""
            echo "      Decky 会走 IIFE 加载，ESM 产物报 Unexpected token 'export'"
            rm -rf "$tmp0"; exit 1
        fi
    fi
    rm -rf "$tmp0"

    # --- 解压到临时目录 ---
    echo
    echo "[解压]"
    local tmp
    tmp=$(mktemp -d) || { err "建临时目录失败"; exit 1; }
    # shellcheck disable=SC2064
    trap "rm -rf '$tmp'" EXIT

    if ! unzip -q "$zip" -d "$tmp"; then
        err "解压失败"
        exit 1
    fi
    ok "解压到临时目录"

    if [ ! -d "$tmp/$top" ]; then
        err "解压后找不到目录 $top"
        ls -la "$tmp" | sed 's/^/      /'
        exit 1
    fi

    # --- 检查后端能否 import ---
    echo
    echo "[后端自检]"
    if command -v python3 >/dev/null 2>&1; then
        local import_err
        import_err=$(cd "$tmp/$top" && python3 -c "
import sys, os
sys.path.insert(0, os.getcwd())
# 用桩模块模拟 decky，避免真依赖 loader
import types
fake = types.ModuleType('decky')
class _L:
    def info(self,*a): pass
    def error(self,*a): pass
fake.logger = _L()
fake.DECKY_PLUGIN_RUNTIME_DIR = '/tmp/_bt_rt'
fake.DECKY_PLUGIN_LOG_DIR = '/tmp/_bt_log'
sys.modules['decky'] = fake
try:
    import main
    print('OK')
except Exception as e:
    import traceback; traceback.print_exc()
" 2>&1)
        if [ "$import_err" = "OK" ]; then
            ok "后端模块 import 成功"
        else
            err "后端 import 失败："
            echo "$import_err" | head -20 | sed 's/^/      /'
            warn "继续安装，但插件可能加载失败"
        fi
    else
        warn "没有 python3，跳过 import 检查"
    fi

    # --- 备份旧版本 ---
    echo
    echo "[安装]"
    if [ -d "$TARGET" ]; then
        local backup="$TARGET.bak.$(date +%s)"
        if mv "$TARGET" "$backup" 2>/dev/null; then
            info "旧版本已备份到: $backup"
        else
            warn "旧版本备份失败（可能权限问题），尝试直接覆盖"
        fi
    fi

    mkdir -p "$PLUGINS_ROOT" || { err "建插件目录失败"; exit 1; }

    if ! cp -r "$tmp/$top" "$TARGET"; then
        err "复制到 $TARGET 失败"
        warn "可能需要 sudo：sudo cp -r \"$tmp/$top\" \"$TARGET\""
        exit 1
    fi
    ok "已安装到 $TARGET"

    # 权限：Decky 期望插件目录对 deck 可读
    chmod -R u+rwX,go+rX "$TARGET" 2>/dev/null || true

    # --- 展示内容 ---
    echo
    info "安装内容："
    find "$TARGET" -maxdepth 1 -type f -printf '      %f  (%s bytes)\n' 2>/dev/null \
        | sort || ls -la "$TARGET" | sed 's/^/      /'

    # --- 重启 ---
    restart_loader

    # --- 验证加载 ---
    echo
    echo "[验证]"
    sleep 1
    if journalctl -u plugin_loader --no-pager -n 50 2>/dev/null | grep -qi "$PLUGIN_DIR_NAME"; then
        ok "日志里出现了本插件"
        journalctl -u plugin_loader --no-pager -n 50 2>/dev/null \
            | grep -i "$PLUGIN_DIR_NAME" | tail -5 | sed 's/^/      /'
    else
        warn "日志里没看到本插件，检查是否加载失败："
        echo "      sudo journalctl -u plugin_loader -n 80 | grep -i -A5 'bt-speaker\|error'"
    fi

    hr
    ok "完成！"
    echo
    echo "回到游戏模式，按 ${YELLOW}···${RESET} 打开 QAM 就能看到「蓝牙音箱」"
    echo "如果没出现：${DIM}sudo journalctl -u plugin_loader -n 80${RESET}"
}

# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------
case "${1:-}" in
    --diag|-d)
        do_diag
        ;;
    --uninstall|-u)
        do_uninstall
        ;;
    --help|-h)
        sed -n '2,20p' "$0" | sed 's/^# \?//'
        ;;
    *)
        ZIP="${1:-}"
        if [ -z "$ZIP" ]; then
            # 自动找
            for cand in \
                "./$PLUGIN_DIR_NAME.zip" \
                "../$PLUGIN_DIR_NAME.zip" \
                "$HOME/Downloads/$PLUGIN_DIR_NAME.zip" \
                "$HOME/$PLUGIN_DIR_NAME.zip" \
                "/tmp/$PLUGIN_DIR_NAME.zip"
            do
                if [ -f "$cand" ]; then ZIP="$cand"; break; fi
            done
        fi
        if [ -z "$ZIP" ]; then
            err "没找到 zip 文件"
            echo
            echo "用法: bash install.sh /path/to/$PLUGIN_DIR_NAME.zip"
            echo "  或先诊断: bash install.sh --diag"
            exit 1
        fi
        do_diag
        echo
        do_install "$ZIP"
        ;;
esac
