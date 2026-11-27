"""
把插件打包成 Decky 可安装的 zip。

Decky 要求：zip 里恰好有一个 depth==1 的 plugin.json，即
    decky-bt-speaker/plugin.json
    decky-bt-speaker/main.py
    decky-bt-speaker/dist/index.js

⚠️ 重要：**必须包含 package.json，且其中 `type` 必须是 `module`。**
Decky Loader 靠这个字段决定前端加载方式（loader.py / plugin.py）：
  - 有 package.json 且 type == "module" → 按 ESM 加载（`import(url)`）
  - 没有 package.json（或 type 不是 module）→ 按旧版 IIFE 加载，
    用 `eval()` 执行 —— 而我们的产物是 ESM，eval 会直接抛
    `SyntaxError: Unexpected token 'export'`，表现为插件加载失败。

⚠️ 另一个重要点：**不要**把中文文件名打进安装包。
Decky 后端解压 zip 时按 ASCII 处理文件名，含非 ASCII 字符的路径会解压失败，
表现为「安装无反应 / 装完看不到插件」。文档类文件请留在仓库里，不要进 zip。

用法：python pack.py
"""

import os
import sys
import json
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
PLUGIN_DIR_NAME = "decky-bt-speaker"
OUT_ZIP = os.path.join(os.path.dirname(ROOT), PLUGIN_DIR_NAME + ".zip")

# 只带这些文件（白名单），避免把 node_modules / 源码 / 测试塞进包里。
# 刻意不含 docs/：那里有中文文件名，会触发 Decky 解压问题。
# package.json 是**必需**的 —— 见上面说明，缺了会按 IIFE 加载导致 export 报错。
INCLUDE_FILES = [
    "plugin.json",
    "package.json",
    "main.py",
    "bt.py",
    "power.py",
    "nodes.py",
    "focus.py",
    "silence.py",
    "eq.py",
    "output.py",
    "metadata.py",
    "wifi.py",
    "quality.py",
    "dist/index.js",
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
]
INCLUDE_DIRS: list[str] = []

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

    # 自检 1：必须恰好一个 depth==1 的 plugin.json
    with zipfile.ZipFile(OUT_ZIP) as zf:
        names = zf.namelist()
    roots = [n for n in names if n.count("/") == 1 and n.endswith("plugin.json")]
    if len(roots) != 1:
        print("自检失败：depth==1 的 plugin.json 数量 = %d" % len(roots))
        return 1

    # 自检 2：目录里所有 .py（除测试/打包脚本）都必须进包，防止新增模块漏打
    packaged = set(n.split("/", 1)[1] for n in names if n.count("/") >= 1)
    skip = {"pack.py", "tests_offline.py"}
    missing_modules = []
    for fn in os.listdir(ROOT):
        if fn.endswith(".py") and fn not in skip and fn not in packaged:
            missing_modules.append(fn)
    if missing_modules:
        print("自检失败：这些 Python 模块没打进包里：%s" % ", ".join(missing_modules))
        print("请把它们加到 INCLUDE_FILES")
        return 1

    # 自检 3：文件名必须是纯 ASCII。
    # Decky 解压时按 ASCII 处理路径，含中文的条目会失败 ——
    # 表现为「安装无反应」或「装完看不到插件」，而且没有任何报错提示。
    bad_names = [n for n in names if any(ord(c) > 127 for c in n)]
    if bad_names:
        print("自检失败：zip 里有非 ASCII 文件名，Decky 会解压失败：")
        for n in bad_names:
            print("  " + n)
        print("请把这些文件移出安装包（或改成英文名）。")
        return 1

    # 自检 4：必须包含后端入口与前端产物
    required = [
        "%s/main.py" % PLUGIN_DIR_NAME,
        "%s/dist/index.js" % PLUGIN_DIR_NAME,
        "%s/plugin.json" % PLUGIN_DIR_NAME,
    ]
    missing_required = [r for r in required if r not in names]
    if missing_required:
        print("自检失败：缺少必需文件：%s" % ", ".join(missing_required))
        return 1

    # 自检 5（关键）：package.json 必须存在，且 type == "module"。
    # 缺了它 Decky 会按旧版 IIFE 用 eval() 加载 ESM 产物，直接抛
    # "SyntaxError: Unexpected token 'export'"，插件在 QAM 里显示加载错误。
    pkg_entry = "%s/package.json" % PLUGIN_DIR_NAME
    if pkg_entry not in names:
        print("自检失败：zip 里没有 package.json")
        print("  Decky 靠 package.json 的 type 字段决定加载方式：")
        print("    有 package.json + type=module -> ESM 加载（import）")
        print("    没有 -> 旧版 IIFE 加载（eval），ESM 产物会报 Unexpected token 'export'")
        return 1
    with zipfile.ZipFile(OUT_ZIP) as zf:
        try:
            pkg = json.loads(zf.read(pkg_entry).decode("utf-8"))
        except Exception as e:  # noqa: BLE001
            print("自检失败：package.json 解析不了：%s" % e)
            return 1
    if pkg.get("type") != "module":
        print("自检失败：package.json 的 type 必须是 \"module\"，当前是 %r"
              % pkg.get("type"))
        print("  否则 Decky 会走 IIFE 加载，ESM 产物会报 Unexpected token 'export'")
        return 1

    # 自检 6：dist/index.js 必须是 ESM（以 import/export 结尾而非 IIFE 包装）
    with zipfile.ZipFile(OUT_ZIP) as zf:
        dist_src = zf.read("%s/dist/index.js" % PLUGIN_DIR_NAME).decode("utf-8", "replace")
    if "export {" not in dist_src and "export default" not in dist_src:
        print("警告：dist/index.js 看起来不是 ESM 产物（没有 export 语句）")
        print("  如果它是 IIFE，package.json 的 type=module 反而不对，请检查 rollup 配置")

    # 自检 7：plugin.json 的 name 不能含「会破坏 URL 的字符」。
    #
    # 背景（一次误判的教训）
    # --------------------
    # Decky 用 name 拼前端资源 URL（loader.py）：
    #     web.get("/plugins/{plugin_name}/dist/{path:.*}", handle_plugin_dist)
    # 前端再 `import()` 这个 URL。
    #
    # 但实测证明：**name 含空格是安全的** —— 前端会做 URL 编码，
    # 「Bluetooth Speaker」加载完全正常。
    # 所以这里只拦截真正会出问题的字符：URL 保留字符与路径分隔符。
    # 非 ASCII（中文）也放行，v2.3.0 之前的「蓝牙音箱」一直能用。
    pj_entry = "%s/plugin.json" % PLUGIN_DIR_NAME
    with zipfile.ZipFile(OUT_ZIP) as zf:
        pj = json.loads(zf.read(pj_entry).decode("utf-8"))
    pj_name = str(pj.get("name", ""))
    problems = []
    if not pj_name:
        problems.append("name 为空")
    for ch in ("/", "\\", "?", "#", "%", "&", "+"):
        if ch in pj_name:
            problems.append("含 URL 保留字符 %r（会破坏资源 URL）" % ch)
    if problems:
        print("自检失败：plugin.json 的 name 不合规（当前 %r）" % pj_name)
        for p in problems:
            print("  - " + p)
        print()
        print("Decky 用 name 拼前端资源 URL：/plugins/<name>/dist/index.js")
        print("含 URL 保留字符会导致 404，前端报：")
        print("  TypeError: Failed to fetch dynamically imported module")
        return 1

    size = os.path.getsize(OUT_ZIP)
    print("已生成 %s" % OUT_ZIP)
    print("  文件数：%d  大小：%.1f KB" % (count, size / 1024.0))
    print("  plugin.json 位置：%s" % roots[0])
    return 0


if __name__ == "__main__":
    sys.exit(main())
