"""
接口自检：不启动 Decky、不连蓝牙，静态检查 Plugin 类引用的成员是否存在。

为什么需要这个？
--------------
v3.0.0 重构时犯过一个错：把 `DimSession` 实例存进 `self.dim`，
但调用处写成了 `self.dim.session.xxx()`（把 `self.dim` 当成容器了）。
结果真机上一打开插件就报：

    AttributeError: 'DimSession' object has no attribute 'session'

**离线测试全绿、tsc 全绿、打包全绿 —— 因为没有一处真正去访问那个属性。**
这类错误只能在运行时暴露，除非专门做静态检查。

本文件做三件事：
  1. 导入 `main` 模块，拿到 `Plugin` 类
  2. 用 `ast` 解析源码，收集所有 `self.<name>` 的引用
  3. 检查每个 name 是否是类属性 / 类方法 / 实例上确实会设置的属性

第 3 步的难点是「实例属性在 `_main()` 里才赋值」，所以静态拿不到。
解法：把已知会在 `_main()` 里赋值的名字列一份白名单（从 AST 里自动提取
`self.X = ...` 的赋值目标），这样不需要手工维护。

用法：python tests_api.py
"""

import ast
import importlib.util
import io
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
MAIN = os.path.join(ROOT, "main.py")
STUB = os.path.join(ROOT, "_decky_stub.py")

FAILED = []


def check(name, cond, detail=""):
    if cond:
        print("  PASS  %s" % name)
    else:
        print("  FAIL  %s %s" % (name, detail))
        FAILED.append(name)


def install_decky_stub():
    """把 _decky_stub.py 注册成 `decky` 模块。

    为什么需要？—— 真机上 Decky Loader 会注入 `decky`，开发机上没有，
    `import main` 会直接 `ModuleNotFoundError`。没有桩的话这个自检根本跑不起来。
    """
    if "decky" in sys.modules:
        return True
    if not os.path.exists(STUB):
        return False
    spec = importlib.util.spec_from_file_location("decky", STUB)
    if spec is None or spec.loader is None:
        return False
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    sys.modules["decky"] = mod
    return True


def collect_self_attrs(tree):
    """从 AST 里收集两类名字：
    - 所有 `self.X` 的**读取**（调用、属性访问、传参都算）
    - 所有 `self.X = ...` 的**赋值**（这些是实例属性，运行时才有）
    """
    reads = set()
    writes = set()

    class V(ast.NodeVisitor):
        def visit_Attribute(self, node):
            # 只关心 self.X 这种
            if isinstance(node.value, ast.Name) and node.value.id == "self":
                # 判断是读还是写：看父节点是不是赋值目标
                reads.add(node.attr)
            self.generic_visit(node)

        def visit_Assign(self, node):
            for tgt in node.targets:
                self._mark_write(tgt)
            self.generic_visit(node)

        def visit_AnnAssign(self, node):
            self._mark_write(node.target)
            self.generic_visit(node)

        def visit_AugAssign(self, node):
            self._mark_write(node.target)
            self.generic_visit(node)

        def _mark_write(self, tgt):
            if (isinstance(tgt, ast.Attribute)
                    and isinstance(tgt.value, ast.Name)
                    and tgt.value.id == "self"):
                writes.add(tgt.attr)

    V().visit(tree)
    return reads, writes


def main():
    if not os.path.exists(MAIN):
        print("找不到 main.py")
        return 1

    src = io.open(MAIN, encoding="utf-8").read()
    tree = ast.parse(src)

    reads, writes = collect_self_attrs(tree)
    print("静态分析：%d 处 self.X 读取，%d 处赋值" % (len(reads), len(writes)))

    # 导入 main 拿 Plugin 类（会执行模块级 import，但不会启动插件）
    sys.path.insert(0, ROOT)
    check("能装上 decky 桩", install_decky_stub(), "缺少 _decky_stub.py")
    try:
        import main as plugin_main  # noqa: E402
    except Exception as e:  # noqa: BLE001
        print("导入 main.py 失败：%s" % e)
        return 1

    Plugin = getattr(plugin_main, "Plugin", None)
    check("能拿到 Plugin 类", Plugin is not None)
    if Plugin is None:
        return 1

    # 类上真实存在的成员：类属性 + 方法
    class_members = set()
    for name in dir(Plugin):
        class_members.add(name)

    # 实例上会有的：类属性 ∪ _main() 里赋值的
    available = class_members | writes

    # 逐个检查读取的名字
    missing = sorted(n for n in reads if n not in available)

    print()
    print("检查 self.X 引用是否都存在")
    check("没有引用不存在的成员", not missing,
          "缺失: %s" % ", ".join(missing))

    # 额外：检查对 DimSession 的调用是否都是真实方法
    #
    # 这是 v3.0.0 那个 bug 的直接对应检查 —— 当时写的是
    # `self.dim.session.xxx()`，而 DimSession 根本没有 `session` 属性。
    print()
    print("检查 DimSession 的公开接口")
    try:
        import dimsession  # noqa: E402
        ds_methods = {n for n in dir(dimsession.DimSession) if not n.startswith("_")}
        for m in ("enter", "exit", "shutdown", "status", "screen_status",
                  "diagnose", "inhibit_status", "inhibit_dict", "set_save"):
            check("DimSession 有 %s()" % m, m in ds_methods, str(sorted(ds_methods)))
        check("DimSession 没有 session 属性（v3.0.0 的错误写法）",
              not hasattr(dimsession.DimSession, "session"))
    except Exception as e:  # noqa: BLE001
        check("导入 dimsession", False, str(e))

    # 额外：确认 main.py 里没有残留的 self.dim.session 写法
    print()
    print("回归：禁止 self.dim.session 写法")
    bad = [i for i, ln in enumerate(src.splitlines(), 1)
           if "self.dim.session" in ln]
    check("源码里没有 self.dim.session", not bad, "行号: %s" % bad)

    print()
    if FAILED:
        print("失败 %d 项：%s" % (len(FAILED), ", ".join(FAILED)))
        return 1
    print("接口自检全部通过 ✅")
    return 0


if __name__ == "__main__":
    sys.exit(main())
