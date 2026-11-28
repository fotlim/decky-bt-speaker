"""
i18n 一致性校验（可重复运行）

检查四件事：
  1. EN / ZH 两个词典的 key 完全一致
  2. 源码里 t("...") 用到的 key 都有定义
  3. 后端返回的自检 key（chk.*）都有翻译
  4. 前端 JSX 里没有残留的硬编码中文（注释除外）

用法：python tests_i18n.py
"""

import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
I18N = os.path.join(ROOT, "src", "i18n.ts")


def _collect_tsx():
    """递归收集所有前端源文件。

    为什么递归而不是写死列表？
    ----------------------
    重构前 views 下只有 3 个文件，写死没问题。后来拆成
    `views/page/*.tsx`（每个 tab 一个文件），写死的列表就漏掉了它们 ——
    表现为「源码有引用」这项突然从 184 掉到 39。

    改成递归后，以后再加文件也不会漏。
    """
    out = []
    base = os.path.join(ROOT, "src")
    for dirpath, _dirnames, filenames in os.walk(base):
        for fn in filenames:
            if fn.endswith((".tsx", ".ts")):
                # i18n.ts 本身是词典定义，不算「引用」
                if fn == "i18n.ts":
                    continue
                out.append(os.path.join(dirpath, fn))
    return sorted(out)


VIEWS = _collect_tsx()

CJK = re.compile(r"[\u4e00-\u9fff]")

FAILED = []


def check(name, cond, detail=""):
    if cond:
        print("  PASS  %s" % name)
    else:
        print("  FAIL  %s %s" % (name, detail))
        FAILED.append(name)


def load_dicts():
    src = io.open(I18N, encoding="utf-8").read()

    def ext(name):
        m = re.search(r"const %s: Dict = \{(.*?)\n\};" % name, src, re.S)
        if not m:
            return {}
        body = m.group(1)
        # 形如  "key": "value"
        return dict(re.findall(r'"([^"]+)"\s*:\s*"((?:[^"\\]|\\.)*)"', body))

    return ext("EN"), ext("ZH")


def main():
    en, zh = load_dicts()

    print("词典规模")
    check("EN 有 key", len(en) > 100, "实际 %d" % len(en))
    check("ZH 有 key", len(zh) > 100, "实际 %d" % len(zh))
    check("EN/ZH 数量一致", len(en) == len(zh), "EN=%d ZH=%d" % (len(en), len(zh)))

    print()
    print("词典一致性")
    miss_zh = sorted(set(en) - set(zh))
    miss_en = sorted(set(zh) - set(en))
    check("ZH 无缺失", not miss_zh, str(miss_zh[:8]))
    check("EN 无缺失", not miss_en, str(miss_en[:8]))

    print()
    print("源码引用的 key")
    used = set()
    for f in VIEWS:
        if not os.path.exists(f):
            continue
        txt = io.open(f, encoding="utf-8").read()
        used |= set(re.findall(r't\("([a-z]+\.[a-zA-Z]+)"', txt))
    check("源码有引用", len(used) > 50, "实际 %d" % len(used))
    undef = sorted(used - set(en))
    check("所有引用的 key 都有定义", not undef, str(undef[:8]))

    print()
    print("后端自检 key")
    main_py = os.path.join(ROOT, "main.py")
    if os.path.exists(main_py):
        ms = io.open(main_py, encoding="utf-8").read()
        chk = set(re.findall(r'add\("(chk\.[a-zA-Z]+)"', ms))
        check("自检 key 数量", len(chk) >= 10, "实际 %d" % len(chk))
        miss = sorted(chk - set(en))
        check("自检 key 都有翻译", not miss, str(miss))

    # ------------------------------------------------------------------
    # 后端不能返回**显示文案**，只能返回 i18n key
    #
    # 真机反馈「切英文后音质预设 / 延迟档位 / EQ 预设还是中文」——
    # 根因是这几个模块直接返回了中文字符串，前端只是原样显示。
    # v2.5.0 修过「自检项返回中文」，但只修了自检项，漏了预设列表。
    #
    # 这里锁住：预设类的 label/desc 必须是 *_key 形式。
    # ------------------------------------------------------------------
    print()
    print("后端预设只返回 i18n key（不返回文案）")
    PRESET_FILES = ["quality.py", "output.py", "eq.py"]
    for fn in PRESET_FILES:
        path = os.path.join(ROOT, fn)
        if not os.path.exists(path):
            continue
        src = io.open(path, encoding="utf-8").read()
        # 找形如 "label": "均衡（推荐）" 的字面量（带中文的）
        bad = re.findall(r'"(label|desc)"\s*:\s*"[^"]*[\u4e00-\u9fff][^"]*"', src)
        check("%s 无中文 label/desc 字面量" % fn, not bad,
              "发现: %s" % (bad[:3] if bad else ""))
        # 必须用 *_key
        if "PRESETS" in src or "CODEC_PRESETS" in src or "LATENCY_PROFILES" in src:
            check("%s 使用 *_key 字段" % fn, "label_key" in src)

    # 后端返回的 label_key 必须在前端词典里有翻译
    print()
    print("后端返回的 i18n key 都有翻译")
    missing_keys = []
    for fn in PRESET_FILES:
        path = os.path.join(ROOT, fn)
        if not os.path.exists(path):
            continue
        src = io.open(path, encoding="utf-8").read()
        for m in re.finditer(r'"(?:label_key|desc_key)"\s*:\s*"([^"]+)"', src):
            key = m.group(1)
            if key not in en:
                missing_keys.append("%s -> %s" % (fn, key))
    check("预设 key 全部有翻译", not missing_keys,
          "缺失: %s" % (missing_keys[:5] if missing_keys else ""))

    print()
    print("硬编码中文残留（注释除外）")

    # 剥掉一行里的行内注释，只留下真正的代码。
    #
    # 为什么要这么做？
    # --------------
    # 早期只判断「整行是否以 // 或 /* 开头」，所以
    #     } catch { /* 轮询失败不打断扫描 */ }
    #     const FAST_MS = 4000;   // 有外部音源在播
    # 这种**行内注释**会被误报成「硬编码中文」。
    # 重构后源码里这类注释变多，误报也变多，必须处理。
    _INLINE_BLOCK = re.compile(r"/\*.*?\*/")
    # 行内 `//`：只在它前面不是 `:` 时才当注释切掉 ——
    # 这样 `"http://x"` 这类字符串里的 `//` 不会被误切。
    _INLINE_LINE = re.compile(r"(?<!:)//.*$")

    def strip_comments(line):
        s = _INLINE_BLOCK.sub("", line)
        s = _INLINE_LINE.sub("", s)
        return s

    total_hits = 0
    for f in VIEWS:
        if not os.path.exists(f):
            continue
        lines = io.open(f, encoding="utf-8").read().splitlines()
        hits = []
        in_block = False
        in_jsx = False
        for i, ln in enumerate(lines, 1):
            st = ln.strip()
            # 跟踪 JSX 注释 {/* ... */}
            if "{/*" in st:
                if "*/}" not in st:
                    in_jsx = True
                continue
            if in_jsx:
                if "*/}" in st:
                    in_jsx = False
                continue
            # 跟踪多行注释 /* ... */
            if st.startswith("/*") and "*/" not in st:
                in_block = True
                continue
            if in_block:
                if "*/" in st:
                    in_block = False
                continue
            # 单行块注释 /** ... */ 或 /* ... */
            if st.startswith("/*") or st.startswith("*"):
                continue
            if st.startswith("//") or st.startswith("*/"):
                continue
            # 剥掉行内注释后再判断
            code_only = strip_comments(ln)
            if CJK.search(code_only):
                hits.append((i, st[:80]))
        name = os.path.basename(f)
        check("%s 无硬编码中文" % name, not hits,
              "共 %d 处，首个: %s" % (len(hits), hits[0] if hits else ""))
        total_hits += len(hits)

    print()
    if FAILED:
        print("失败 %d 项：%s" % (len(FAILED), ", ".join(FAILED)))
        return 1
    print("i18n 全部通过 ✅  （EN/ZH 各 %d 个 key，源码引用 %d 个）" % (len(en), len(used)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
