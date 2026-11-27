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
VIEWS = [
    os.path.join(ROOT, "src", "views", "Speaker.tsx"),
    os.path.join(ROOT, "src", "views", "BtSpeakerPage.tsx"),
    os.path.join(ROOT, "src", "index.tsx"),
]

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

    print()
    print("硬编码中文残留（注释除外）")
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
            if CJK.search(ln):
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
