"""
把插件打包成 Decky 可安装的 zip。

Decky 要求：zip 里恰好有一个 depth==1 的 plugin.json，即
    decky-bt-speaker/plugin.json
    decky-bt-speaker/main.py
    decky-bt-speaker/dist/index.js

用法：python pack.py
"""

import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
PLUGIN_DIR_NAME = "decky-bt-speaker"
OUT_ZIP = os.path.join(os.path.dirname(ROOT), PLUGIN_DIR_NAME + ".zip")

# 只带这些文件（白名单），避免把 node_modules / 源码 / 测试塞进包里
INCLUDE_FILES = [
    "plugin.json",
    "main.py",
    "bt.py",
    "dist/index.js",
    "README.md",
    "LICENSE",
]
INCLUDE_DIRS: list[str] = ["docs"]


def main():
    missing = []
    for rel in INCLUDE_FILES:
        if not os.path.isfile(os.path.join(ROOT, rel)):
            missing.append(rel)
    if missing:
        print("缺少文件：%s" % ", ".join(missing))
        print("先跑 `pnpm run build` 生成 dist/index.js")
        return 1

    if os.path.exists(OUT_ZIP):
        os.remove(OUT_ZIP)

    count = 0
    with zipfile.ZipFile(OUT_ZIP, "w", zipfile.ZIP_DEFLATED) as zf:
        for rel in INCLUDE_FILES:
            src = os.path.join(ROOT, rel)
            arc = "%s/%s" % (PLUGIN_DIR_NAME, rel.replace(os.sep, "/"))
            zf.write(src, arc)
            count += 1
        for d in INCLUDE_DIRS:
            base = os.path.join(ROOT, d)
            for dirpath, _dirnames, filenames in os.walk(base):
                for fn in filenames:
                    src = os.path.join(dirpath, fn)
                    relp = os.path.relpath(src, ROOT).replace(os.sep, "/")
                    zf.write(src, "%s/%s" % (PLUGIN_DIR_NAME, relp))
                    count += 1

    # 自检：必须恰好一个 depth==1 的 plugin.json
    with zipfile.ZipFile(OUT_ZIP) as zf:
        names = zf.namelist()
    roots = [n for n in names if n.count("/") == 1 and n.endswith("plugin.json")]
    if len(roots) != 1:
        print("自检失败：depth==1 的 plugin.json 数量 = %d" % len(roots))
        return 1

    size = os.path.getsize(OUT_ZIP)
    print("已生成 %s" % OUT_ZIP)
    print("  文件数：%d  大小：%.1f KB" % (count, size / 1024.0))
    print("  plugin.json 位置：%s" % roots[0])
    return 0


if __name__ == "__main__":
    sys.exit(main())
