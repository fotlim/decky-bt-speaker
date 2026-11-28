# -*- coding: utf-8 -*-
"""商店合规自检：逐条对照 Decky 官方审核要求。

参考：
- https://wiki.deckbrew.xyz/en/plugin-dev/review-and-testing
- https://wiki.deckbrew.xyz/en/plugin-dev/submitting-plugins

这份脚本的目的不是「跑过就算」，而是把审核员会看的点**固化下来**，
避免以后改动时悄悄退化（比如又把 dist/ 提交上去、又忘了保留模板许可）。
"""

import io
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
FAILED = []


def check(name, cond, detail=""):
    if cond:
        print("  PASS  %s" % name)
    else:
        print("  FAIL  %s  %s" % (name, detail))
        FAILED.append(name)


def read(path):
    with io.open(os.path.join(ROOT, path), encoding="utf-8") as f:
        return f.read()


def git_tracked():
    try:
        out = subprocess.run(["git", "ls-files"], cwd=ROOT,
                             capture_output=True, text=True, timeout=30)
        return out.stdout.splitlines()
    except Exception:
        return None


# ---------------------------------------------------------------------------
def test_manifests():
    print("\n[清单文件]")
    pj = json.loads(read("plugin.json"))
    pkg = json.loads(read("package.json"))

    for key in ("name", "author", "api_version", "publish"):
        check("plugin.json 有 %s" % key, key in pj, str(list(pj.keys())))
    check("api_version == 1", pj.get("api_version") == 1, repr(pj.get("api_version")))
    check("name 非空", bool(pj.get("name")), repr(pj.get("name")))
    check("author 非空", bool(pj.get("author")), repr(pj.get("author")))

    pub = pj.get("publish") or {}
    check("publish.tags 是数组且非空",
          isinstance(pub.get("tags"), list) and len(pub["tags"]) > 0,
          repr(pub.get("tags")))
    check("publish.description 非空", bool(pub.get("description")))
    check("publish.image 是 https", str(pub.get("image", "")).startswith("https://"),
          repr(pub.get("image")))

    check("package.json 有 type=module", pkg.get("type") == "module",
          repr(pkg.get("type")))
    check("package.json 有 license 字段", bool(pkg.get("license")),
          repr(pkg.get("license")))
    check("package.json 有 version", bool(pkg.get("version")), repr(pkg.get("version")))
    check("package.json 有 repository", bool(pkg.get("repository")))


def test_license():
    print("\n[许可证]")
    path = os.path.join(ROOT, "LICENSE")
    if not os.path.isfile(path) and os.path.isfile(path + ".MD"):
        path = path + ".MD"
    check("存在 LICENSE 或 LICENSE.MD",
          os.path.isfile(os.path.join(ROOT, "LICENSE"))
          or os.path.isfile(os.path.join(ROOT, "LICENSE.MD")))

    txt = read("LICENSE")
    # 官方模板是 BSD 3-Clause，商店要求保留原始版权声明
    check("保留了 Steam Deck Homebrew 的原始版权",
          "Steam Deck Homebrew" in txt,
          "商店要求：基于模板的插件必须保留模板许可")
    check("包含 BSD 3-Clause 条款", "Redistribution and use in source" in txt)
    check("包含本项目版权", "大肥鱼" in txt or "decky-bt-speaker" in txt)


def test_no_build_artifacts_in_git():
    print("\n[不该入库的文件]")
    files = git_tracked()
    if files is None:
        print("  SKIP  拿不到 git 文件列表")
        return

    dist_files = [f for f in files if f.startswith("dist/")]
    check("dist/ 不在版本控制里（CI 会自己 build）", not dist_files, str(dist_files))

    nm = [f for f in files if "node_modules" in f]
    check("node_modules 不在版本控制里", not nm, str(nm[:3]))

    zips = [f for f in files if f.endswith(".zip")]
    check("没有 zip 产物入库", not zips, str(zips))

    test_settings = [f for f in files if f == "_test_settings.json"]
    check("没有测试临时文件入库", not test_settings, str(test_settings))

    pycache = [f for f in files if "__pycache__" in f or f.endswith(".pyc")]
    check("没有 __pycache__ / .pyc 入库", not pycache, str(pycache[:3]))


def test_required_dirs_absent_or_used():
    print("\n[backend / assets / defaults 目录]")
    # 商店要求：没用到就必须删掉；defaults 里只有个空 defaults.txt 也要删
    for d in ("backend", "assets", "defaults"):
        p = os.path.join(ROOT, d)
        exists = os.path.isdir(p)
        if not exists:
            check("%s/ 不存在（本项目用不到）" % d, True)
            continue
        # 存在就要有实质内容
        inner = os.listdir(p)
        check("%s/ 存在且有实质内容" % d,
              bool(inner) and inner != ["defaults.txt"], str(inner))


def test_lockfile():
    print("\n[pnpm lockfile]")
    txt = read("pnpm-lock.yaml")
    check("lockfileVersion 是 9.0（CI 要求）",
          "lockfileVersion: '9.0'" in txt or 'lockfileVersion: "9.0"' in txt,
          txt.splitlines()[0] if txt else "")


def test_no_remote_binary():
    print("\n[远程二进制 / 远程代码]")
    pkg = json.loads(read("package.json"))
    pj = json.loads(read("plugin.json"))

    def find_remote_binary(obj, path=""):
        hits = []
        if isinstance(obj, dict):
            for k, v in obj.items():
                if "remote" in k.lower() and "binary" in k.lower():
                    hits.append(path + "/" + k)
                hits += find_remote_binary(v, path + "/" + k)
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                hits += find_remote_binary(v, "%s[%d]" % (path, i))
        return hits

    check("package.json 没有 remote-binary 标记",
          not find_remote_binary(pkg), str(find_remote_binary(pkg)))
    check("plugin.json 没有 remote-binary 标记",
          not find_remote_binary(pj), str(find_remote_binary(pj)))

    # 前端不应该有运行时的网络请求（审核员会重点看）
    bad = []
    src_dir = os.path.join(ROOT, "src")
    for dirpath, _dirs, files in os.walk(src_dir):
        for fn in files:
            if not fn.endswith((".ts", ".tsx")):
                continue
            p = os.path.join(dirpath, fn)
            with io.open(p, encoding="utf-8") as f:
                for i, line in enumerate(f, 1):
                    low = line.strip()
                    if low.startswith("//") or low.startswith("*"):
                        continue
                    for pat in ("fetch(", "XMLHttpRequest", "eval(", "new Function("):
                        if pat in line:
                            bad.append("%s:%d %s" % (fn, i, pat))
    check("前端没有 fetch / eval / new Function", not bad, str(bad[:5]))


def test_backend_stdlib_only():
    print("\n[后端只用标准库（PyInstaller 冻结环境）]")
    # 第三方库在冻结环境里会 ImportError，商店审核也会问
    THIRD_PARTY = ("requests", "numpy", "psutil", "yaml", "dbus",
                   "gi", "aiohttp", "httpx")
    hits = []
    for fn in os.listdir(ROOT):
        if not fn.endswith(".py") or fn.startswith(("test", "pack", "_decky")):
            continue
        with io.open(os.path.join(ROOT, fn), encoding="utf-8") as f:
            for i, line in enumerate(f, 1):
                s = line.strip()
                if not (s.startswith("import ") or s.startswith("from ")):
                    continue
                for mod in THIRD_PARTY:
                    if s.startswith("import %s" % mod) or s.startswith("from %s" % mod):
                        hits.append("%s:%d %s" % (fn, i, s))
    check("后端没有第三方依赖", not hits, str(hits))


def test_shell_injection():
    print("\n[命令注入]")
    hits = []
    for fn in os.listdir(ROOT):
        if not fn.endswith(".py") or fn.startswith(("test", "pack", "_decky")):
            continue
        with io.open(os.path.join(ROOT, fn), encoding="utf-8") as f:
            txt = f.read()
        for pat in ("shell=True", "os.system(", "os.popen("):
            if pat in txt:
                hits.append("%s: %s" % (fn, pat))
    check("没有 shell=True / os.system / os.popen", not hits, str(hits))


def main():
    for fn in (test_manifests, test_license, test_no_build_artifacts_in_git,
               test_required_dirs_absent_or_used, test_lockfile,
               test_no_remote_binary, test_backend_stdlib_only,
               test_shell_injection):
        fn()
    print()
    if FAILED:
        print("商店合规自检失败 %d 项：%s" % (len(FAILED), ", ".join(FAILED)))
        sys.exit(1)
    print("商店合规自检全部通过 ✅")


if __name__ == "__main__":
    main()
