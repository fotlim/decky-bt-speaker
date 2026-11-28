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
    """从 AST 里收集：
    - `self.X` 的**读取**（返回的集合里，无点的是第一段，带点的是链式后续段）
    - `self.X = ...` 的**赋值**（这些是实例属性，运行时才有）

    ⚠️ 为什么要拆链式属性？
    ----------------------
    v3.0.0 那个 bug 是 `self.dim.session.enter()`。它的 AST 是：

        Attribute(
          value=Attribute(value=Name('self'), attr='dim'),
          attr='session')

    只判断「`node.value` 是不是 `Name('self')`」的话，**只能看到 `dim`**，
    `session` 完全被漏掉 —— 而 `session` 才是真正不存在的那个。

    所以这里把 `self.a.b.c` 拆成 `['a', 'b', 'c']`，逐段记录：
      - `a`      → 第一段，必须在类/实例上存在
      - `a.b`    → 后续段，属于运行时对象，需另用「目标类的方法清单」核对
    """
    reads = set()
    writes = set()

    def chain_of(node):
        """把 self.a.b.c 拆成 ['a','b','c']；不是以 self 开头就返回 None。"""
        chain = []
        cur = node
        while isinstance(cur, ast.Attribute):
            chain.append(cur.attr)
            cur = cur.value
        if isinstance(cur, ast.Name) and cur.id == "self" and chain:
            chain.reverse()
            return chain
        return None

    class V(ast.NodeVisitor):
        def visit_Attribute(self, node):
            chain = chain_of(node)
            if chain:
                reads.add(chain[0])                        # self.a
                for i in range(1, len(chain)):
                    reads.add("%s.%s" % (chain[0], chain[i]))  # self.a.b
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
            chain = chain_of(tgt)
            if chain:
                writes.add(chain[0])

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

    # 逐个检查**第一段**（self.X）—— 带点的链式后续段单独查（见下）
    first_seg = {n for n in reads if "." not in n}
    chained = {n for n in reads if "." in n}
    missing = sorted(n for n in first_seg if n not in available)

    print()
    print("检查 self.X 引用是否都存在")
    check("没有引用不存在的成员", not missing,
          "缺失: %s" % ", ".join(missing))

    # 检查链式属性（self.dim.xxx）的后续段是否是该对象的真实成员。
    #
    # 这是 v3.0.0 那个 bug 的直接对应检查：`self.dim.session.enter()`
    # 里 `session` 不存在。旧版 collect_self_attrs 只记录最外层 `dim`，
    # 根本看不到 `session`；现在会得到 `dim.session` 这个键。
    print()
    print("检查链式属性（self.X.Y）的后续段")
    try:
        import dimsession  # noqa: E402
        ds_members = set(dir(dimsession.DimSession))
        bad_chain = []
        for key in sorted(chained):
            head, _, attr = key.partition(".")
            if head != "dim":
                continue  # 只对已知类型的成员做严格检查
            if attr not in ds_members:
                bad_chain.append(key)
        check("self.dim.Y 的 Y 都是 DimSession 真实成员", not bad_chain,
              "非法: %s" % ", ".join(bad_chain))
    except Exception as e:  # noqa: BLE001
        check("导入 dimsession", False, str(e))

    # 额外：检查对 DimSession 的调用是否都是真实方法
    print()
    print("检查 DimSession 的公开接口")
    try:
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
