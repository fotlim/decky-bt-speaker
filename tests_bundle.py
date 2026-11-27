"""
产物冒烟测试：用真实 `dist/index.js` 在一个「旧版 loader」的假环境里跑一遍。

为什么需要这个？
--------------
v2.8.0 的事故是：代码里在**模块顶层**调用了 `DFL.findVar`，
而用户机器上那版 Decky loader 的 `DFL` 没有这个函数 ——
模块一加载就抛 `TypeError`，**整个插件包挂掉**。

`tsc` 查不出这个问题（`@decky/ui` 的类型声明里有 `findVar`），
构建也不报错。所以必须**真的在缺少该 API 的环境里 import 一次**，
才能确认产物不会崩。

这个测试做两件事：
  1. 造一个只有基础 UI 组件、**没有 findVar / findModuleExport** 的 `DFL`
  2. 真的 `import()` 打包产物，看它能不能加载完成

同时验证版本号注入（`__BT_META__`）有没有生效 —— 排查「装了新版还报旧错」
时，界面上那行版本号是唯一可靠的判断依据。

用法：
    python tests_bundle.py
需要先 `pnpm run build` 生成 dist/index.js。
"""

import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, "dist", "index.js")

FAILED = []


def check(name, cond, detail=""):
    if cond:
        print("  PASS  %s" % name)
    else:
        print("  FAIL  %s %s" % (name, detail))
        FAILED.append(name)


def find_node():
    """找一个能用的 node 可执行文件。"""
    for cand in (
        shutil.which("node"),
        r"C:\Users\LinOcean\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe",
    ):
        if cand and os.path.exists(cand):
            return cand
    return None


# 假环境：模拟「DFL 存在，但没有 findVar / findModuleExport / findModuleChild」。
# 这正是 v2.8.0 崩溃的那台机器。
MOCK = r"""
const DFL = {
  PanelSection: () => null,
  PanelSectionRow: () => null,
  ButtonItem: () => null,
  ToggleField: () => null,
  SliderField: () => null,
  Focusable: () => null,
  Navigation: { Navigate: () => {} },
};
const SP_REACT = {
  useState: (init) => [typeof init === "function" ? init() : init, () => {}],
  useEffect: () => {},
  useRef: (v) => ({ current: v }),
  useCallback: (f) => f,
  useMemo: (f) => f(),
};
const SP_JSX = { jsx: () => null, jsxs: () => null, Fragment: null };
globalThis.DFL = DFL;
globalThis.SP_REACT = SP_REACT;
globalThis.SP_JSX = SP_JSX;
globalThis.window = globalThis;
globalThis.document = {
  addEventListener: () => {},
  removeEventListener: () => {},
  hidden: false,
};
globalThis.__DECKY_SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED_deckyLoaderAPIInit = {
  connect: () => ({ call: async () => ({}), callPluginMethod: async () => ({}) }),
};

const target = process.argv[2];
try {
  await import("file:///" + target.replace(/\\/g, "/"));
  console.log("SMOKE_OK");
} catch (e) {
  console.log("SMOKE_FAIL " + e.constructor.name + ": " + e.message);
}
"""


def main():
    if not os.path.exists(DIST):
        print("找不到 dist/index.js，先跑 `pnpm run build`")
        return 1

    src = io.open(DIST, encoding="utf-8").read()

    print("产物静态检查")
    # 1. 模块顶层不许出现裸 DFL.<可能不存在的 API>
    safe = {
        "PanelSection", "PanelSectionRow", "ButtonItem", "ToggleField",
        "SliderField", "Focusable", "Navigation", "Dropdown", "Field",
        "TextField", "DialogButton", "staticClasses", "ModalRoot", "showModal",
        "joinClassNames", "gamepadDialogClasses", "quickAccessControlsClasses",
        "ScrollPanel", "ScrollPanelGroup", "ConfirmModal", "Menu", "MenuItem",
        "ProgressBar", "Spinner", "createReactTreePatcher",
    }
    top_level = []
    for raw in src.splitlines():
        if raw[:1] in (" ", "\t", "/", "*"):
            continue
        for m in re.finditer(r"DFL\.([A-Za-z_$][\w$]*)", raw):
            if m.group(1) not in safe:
                top_level.append(m.group(1))
    check("顶层无危险 DFL 调用", not top_level, str(top_level))

    # 2. 可选 API 必须经过 typeof 判断（检查 optionalFn 这种写法还在）
    check("有 typeof 函数判断", 'typeof fn === "function"' in src or "typeof fn==='function'" in src)

    # 3. 版本号注入必须生效
    m = re.search(r"__BT_META__\s*=\s*(\{[^}]*\})", src)
    check("有 __BT_META__ 注入", m is not None)
    if m:
        try:
            meta = json.loads(m.group(1))
        except Exception:  # noqa: BLE001
            meta = {}
        check("注入的 version 非空", bool(meta.get("version")), str(meta))
        check("注入的 build 非空", bool(meta.get("build")), str(meta))
        try:
            pkg = json.load(io.open(os.path.join(ROOT, "package.json"), encoding="utf-8"))
        except Exception:  # noqa: BLE001
            pkg = {}
        check("version 与 package.json 一致",
              meta.get("version") == pkg.get("version"),
              "%r vs %r" % (meta.get("version"), pkg.get("version")))

    # 4. 真·冒烟：在缺少 findVar 的假环境里 import 产物
    print()
    print("在「旧版 loader」假环境中加载产物")
    node = find_node()
    if not node:
        check("找到 node 可执行文件", False, "PATH 里没有 node")
        return 1

    tmpdir = tempfile.mkdtemp(prefix="bt-smoke-")
    try:
        mock_path = os.path.join(tmpdir, "smoke.mjs")
        io.open(mock_path, "w", encoding="utf-8", newline="\n").write(MOCK)
        proc = subprocess.run(
            [node, mock_path, DIST],
            capture_output=True, timeout=120,
            cwd=ROOT,
        )
        out = (proc.stdout or b"").decode("utf-8", "replace")
        err = (proc.stderr or b"").decode("utf-8", "replace")
        check("产物能在无 findVar 环境加载", "SMOKE_OK" in out,
              (out + err).strip()[:400])
        # 明确排除 v2.8.0 那种报错
        check("没有 'findVar is not a function'",
              "findVar is not a function" not in (out + err))
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

    print()
    if FAILED:
        print("失败 %d 项：%s" % (len(FAILED), ", ".join(FAILED)))
        return 1
    print("产物冒烟测试全部通过 ✅")
    return 0


if __name__ == "__main__":
    sys.exit(main())
