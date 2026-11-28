# -*- coding: utf-8 -*-
"""性能回归测试：确保 `status()` 不会重复 fork 同一条外部命令。

为什么单独一个文件？
-------------------
v3.3.0 做了一轮「减轻系统压力」的优化，核心是三件事：

1. `pactl list cards` 在**同一次** `status()` 里原来跑两遍
   （`focus.get_active_profile()` 和 `a2dp.read_cards()` 各一次）
2. `wpctl status` 原来跑两遍（音量解析 + `output.list_sinks()`）
3. `pw-dump` 原来跑两遍（`silence` 和 `a2dp` 各一次）

这三处都是「功能正确、但白烧进程」，纯看代码不容易发现，
改回去也不会报错 —— 只会悄悄变慢。所以用测试锁住。

做法：把 `run_cmd` 替换成记账版，统计每条命令被调了几次。
"""

import asyncio
import importlib.util
import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import btutil
import bt
import a2dp
import focus
import silence
import metadata

FAILED = []

STUB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_decky_stub.py")


def install_decky_stub():
    """`main.py` 顶层 `import decky`，离线测试需要一个桩。"""
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


def check(name, cond, detail=""):
    if cond:
        print("  PASS  %s" % name)
    else:
        print("  FAIL  %s  %s" % (name, detail))
        FAILED.append(name)


class Recorder:
    """记录每条命令被调用了几次。"""

    def __init__(self, outputs=None):
        self.calls = []
        self.outputs = outputs or {}

    async def __call__(self, argv, timeout=8.0, env_extra=None):
        self.calls.append(tuple(argv))
        key = " ".join(argv)
        for pat, out in self.outputs.items():
            if pat in key:
                return 0, out
        return 0, ""

    def count(self, needle):
        return sum(1 for c in self.calls if needle in " ".join(c))


CARDS_SAMPLE = """Card #52
\tName: bluez_card.CC_42_10_8A_70_42
\tActive Profile: a2dp-sink-sbc_xq
\tProfiles:
\t\ta2dp-sink-sbc_xq: High Fidelity Playback (A2DP Sink, codec SBC-XQ)
\t\toff: Off
"""


def install_recorder(rec):
    """把各模块里的 run_cmd 换成记账版，并清空共享缓存。

    ⚠️ 还要把 `which` 也换掉：测试跑在 Windows 上，`which("pactl")`
    返回 None，各模块会直接早退，命令根本不会发出去 —— 那样统计出来的
    永远是 0 次，测试就变成了「永远通过」的假测试。
    """
    btutil.cache_clear()
    btutil.run_cmd = rec
    bt.run_cmd = rec
    a2dp.run_cmd = rec
    a2dp.run_cached = btutil.run_cached
    focus.run_cmd = rec
    focus.run_cached = btutil.run_cached
    silence.run_cmd = rec
    silence.run_cached = btutil.run_cached
    metadata.run_cmd = rec
    metadata.reset_cache()
    # 让 which 假装所有命令都装着
    btutil.which = lambda name: "/usr/bin/" + name
    bt.which = btutil.which
    a2dp.which = btutil.which
    focus.which = btutil.which
    silence.which = btutil.which
    metadata.which = btutil.which


def test_pactl_shared():
    """同一次轮询里 `pactl list cards` 只该跑一次。"""
    print("\n[pactl list cards 共享缓存]")
    rec = Recorder({"list cards": CARDS_SAMPLE})
    install_recorder(rec)

    foc = focus.Focus(wp=None)

    async def go():
        # 模拟 status() 里的调用顺序：先读编码器，再读 A2DP 卡片
        await foc.get_active_profile()
        await a2dp.read_cards()

    asyncio.run(go())
    n = rec.count("list cards")
    check("pactl list cards 只跑 1 次（原本 2 次）", n == 1, "实际 %d 次" % n)


def test_pw_dump_shared():
    """同一次轮询里 `pw-dump` 只该跑一次。"""
    print("\n[pw-dump 共享缓存]")
    rec = Recorder({"pw-dump": "[]"})
    install_recorder(rec)

    async def go():
        # 静音守卫和 A2DP 就绪判断读的是同一份 pw-dump
        await silence.read_node_states()
        await a2dp.read_node_states()

    asyncio.run(go())
    n = rec.count("pw-dump")
    check("pw-dump 只跑 1 次（原本 2 次）", n == 1, "实际 %d 次" % n)


def test_wpctl_status_shared():
    """`wpctl status` 在一次轮询里只该跑一次。"""
    print("\n[wpctl status 共享缓存]")
    rec = Recorder({"wpctl status": "PipeWire 'pipewire-0'\n"})
    install_recorder(rec)

    wp = bt.Wp()

    async def go():
        await wp.status_text()
        await wp.status_text()      # 第二次应命中缓存

    asyncio.run(go())
    n = rec.count("wpctl status")
    check("wpctl status 只跑 1 次（原本 2 次）", n == 1, "实际 %d 次" % n)


def test_versions_cached():
    """版本号只该真正查一次（之后走缓存）。"""
    print("\n[版本号缓存]")
    # ⚠️ 必须给出真实格式的版本输出：`bt.versions()` 在「三个都空」时
    #    会认为环境异常、故意不缓存。给空串的话这个测试会假失败。
    rec = Recorder({
        "pipewire --version": "pipewire\nCompiled with libpipewire 0.3.65\n",
        "wireplumber --version": "wireplumber 0.4.13\n",
        "bluetoothctl --version": "bluetoothctl: 5.66\n",
    })
    install_recorder(rec)
    bt.reset_versions_cache()

    async def go():
        await bt.versions()
        await bt.versions()
        await bt.versions()

    asyncio.run(go())
    n = rec.count("--version")
    # 三个命令各一次 = 3；如果没缓存就是 9
    check("版本查询只跑 3 次（3 个命令 × 1 轮，原本 × 3 轮 = 9）",
          n == 3, "实际 %d 次" % n)


def test_player_tree_cached():
    """`busctl tree` 在播放期间只该定期跑，不是每次轮询都跑。"""
    print("\n[player 路径树缓存]")
    tree = ("\u2514\u2500/org/bluez/hci0/dev_CC_42_10_8A_70_42\n"
            "  \u2514\u2500/org/bluez/hci0/dev_CC_42_10_8A_70_42/player0\n")
    rec = Recorder({"tree org.bluez": tree})
    install_recorder(rec)

    meta = metadata.Metadata()

    async def go():
        for _ in range(5):
            await meta._list_players()

    asyncio.run(go())
    n = rec.count("tree org.bluez")
    check("连续 5 次 _list_players 只跑 1 次 busctl tree", n == 1, "实际 %d 次" % n)


def test_multi_property_busctl():
    """Track / Status / Position 应该合并成一次 busctl。"""
    print("\n[busctl 多属性合并]")
    outputs = {
        "get-property": (
            'a{sv} 3 "Title" s "Song" "Artist" s "Someone" "Duration" u 210000\n'
            's "playing"\n'
            "u 59000\n"
        ),
    }
    rec = Recorder(outputs)
    install_recorder(rec)

    meta = metadata.Metadata()

    async def go():
        return await meta.read("CC:42:10:8A:70:42")

    # read() 会先调 busctl tree（这里让它失败，走拼路径的降级分支）
    track = asyncio.run(go())
    n = rec.count("get-property")
    check("读一次曲目只发 1 条 busctl get-property（原本 3 条）",
          n == 1, "实际 %d 条" % n)
    check("曲名解析正确", bool(track and track.get("title") == "Song"),
          "得到 %r" % (track or {}).get("title"))
    check("状态解析正确（无类型前缀）",
          bool(track and track.get("status") == "playing"),
          "得到 %r" % (track or {}).get("status"))
    check("位置解析正确",
          bool(track and track.get("position_ms") == 59000),
          "得到 %r" % (track or {}).get("position_ms"))


def test_multi_property_fallback():
    """行数对不上时必须退回逐个读，不能把 Status 当成 Position。"""
    print("\n[busctl 多属性：行数不匹配时安全降级]")
    outputs = {
        # 故意只给两行（3 个属性却只有 2 行）
        "get-property": 's "playing"\nu 59000\n',
    }
    rec = Recorder(outputs)
    install_recorder(rec)

    meta = metadata.Metadata()

    async def go():
        return await meta._get_many("/x", ("Track", "Status", "Position"))

    got = asyncio.run(go())
    check("行数不匹配时返回空 dict（调用方退回逐个读）", got == {}, "得到 %r" % got)


def test_run_cached_only_caches_success():
    """失败的命令不能进缓存，否则会一直返回旧错误。"""
    print("\n[run_cached 只缓存成功]")
    btutil.cache_clear()
    calls = []

    async def failing(argv, timeout=8.0, env_extra=None):
        calls.append(argv)
        return 1, "boom"

    orig = btutil.run_cmd
    btutil.run_cmd = failing
    try:
        async def go():
            await btutil.run_cached(["pactl", "list", "cards"])
            await btutil.run_cached(["pactl", "list", "cards"])

        asyncio.run(go())
    finally:
        btutil.run_cmd = orig
    check("失败的命令不被缓存（两次都真的执行了）", len(calls) == 2,
          "实际执行 %d 次" % len(calls))


def test_cache_bounded():
    """`_cached` 的 dict 不能无限增长（key 里含 MAC，设备越多条目越涨）。"""
    print("\n[缓存容量上限]")
    import main as M

    p = M.Plugin.__new__(M.Plugin)
    p._cache = {}
    p._log = lambda *a: None

    for i in range(300):
        p._cached("dev_info:AA:BB:CC:DD:EE:%02X" % (i % 256), 30.0, lambda: i)

    n = len(p._cache)
    check("写入 300 条后缓存不超过硬上限（%d）" % M.Plugin._CACHE_MAX,
          n <= M.Plugin._CACHE_MAX, "实际 %d 条" % n)


def test_auto_gain_session_reset():
    """换音源后自动增益标记必须重置（否则「每会话一次」变成「一辈子一次」）。"""
    print("\n[自动增益的会话边界]")
    import main as M

    p = M.Plugin.__new__(M.Plugin)
    p.settings = {"auto_gain": True}
    p._log = lambda *a: None
    p._last_manual_volume = 0.0
    p._auto_gain_done = False
    p._gain_session = None
    p.wp = type("W", (), {"set_volume_of": staticmethod(lambda *a: _noop())})()

    async def go():
        # 第一个音源：偏轻 -> 补一次
        await p._apply_auto_gain(11, 0.5)
        first = p._auto_gain_done
        # 同一音源再来一次：不该重复补（标记仍是 True，且会话没变）
        await p._apply_auto_gain(11, 0.5)
        same_session = p._gain_session
        # 换音源（节点 id 变了）：标记必须重置
        await p._apply_auto_gain(12, 0.5)
        return first, same_session, p._gain_session

    first, same_session, new_session = asyncio.run(go())
    check("首次遇到偏轻音源会补一次", first is True)
    check("同一音源会话标识不变", same_session == 11, "得到 %r" % (same_session,))
    check("换音源后会话标识更新（标记随之重置）", new_session == 12,
          "得到 %r" % (new_session,))


async def _noop():
    return True


def test_inflight_dedup():
    """同一 key 的并发缓存计算只能真的算一次（QAM + 全屏页会并发进来）。"""
    print("\n[并发缓存去重]")
    import main as M

    p = M.Plugin.__new__(M.Plugin)
    p._cache = {}
    p._inflight_cache = {}
    p._log = lambda *a: None

    calls = {"n": 0}

    async def slow():
        calls["n"] += 1
        await asyncio.sleep(0.15)   # 故意慢，让并发真的重叠
        return "value"

    async def go():
        # 5 个并发请求同一个 key
        return await asyncio.gather(*[
            p._cached_async("same-key", 30.0, slow) for _ in range(5)
        ])

    results = asyncio.run(go())
    check("并发 5 次只真正计算 1 次", calls["n"] == 1, "实际 %d 次" % calls["n"])
    check("5 个调用都拿到结果", all(r == "value" for r in results), str(results))
    check("in-flight 表已清空", not p._inflight_cache, str(p._inflight_cache))


def test_cache_failure_not_cached():
    """factory 失败不能把 None 写进缓存（否则 Wi-Fi 信息会整块消失 60 秒）。"""
    print("\n[失败不污染缓存]")
    import main as M

    p = M.Plugin.__new__(M.Plugin)
    p._cache = {}
    p._inflight_cache = {}
    p._log = lambda *a: None

    state = {"fail": True, "n": 0}

    async def flaky():
        state["n"] += 1
        if state["fail"]:
            raise RuntimeError("boom")
        return "good"

    async def go():
        first = await p._cached_async("flaky", 60.0, flaky)
        # 缓存里不该有这条（失败不写）
        in_cache = "flaky" in p._cache
        # 让下一次成功
        state["fail"] = False
        second = await p._cached_async("flaky", 60.0, flaky)
        return first, in_cache, second, state["n"]

    first, in_cache, second, n = asyncio.run(go())
    check("失败时返回 None（不抛给调用方）", first is None, repr(first))
    check("失败的结果没有写进缓存", in_cache is False)
    check("下次调用会重试并成功", second == "good", repr(second))
    check("确实重试了（共调用 2 次）", n == 2, "实际 %d 次" % n)


def test_keepalive_decoupled():
    """静音守卫不能被「可被发现」开关连带关掉。

    ⚠️ 用 AST 检查而不是搜字符串：docstring 里就写着
    「早期静音守卫写在 `if not discoverable: continue` 之后」，
    搜字符串会把这句说明当成真代码，造成假失败。
    """
    print("\n[保活与静音守卫解耦]")
    import ast
    import inspect
    import main as M

    src = inspect.getsource(M.Plugin._keep_alive_loop)
    tree = ast.parse(src.lstrip())

    # 找出所有 `continue`，看它是不是在 `if discoverable` 里面
    bad = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Continue):
            continue
        # 这个 continue 是否直接挂在 if 里？检查所有 If 节点的 body
        for parent in ast.walk(tree):
            if isinstance(parent, ast.If) and any(b is node for b in parent.body):
                cond = ast.unparse(parent.test) if hasattr(ast, "unparse") else ""
                if "discoverable" in cond:
                    bad.append((node.lineno, cond))
    check("保活循环里没有因 discoverable 而 continue", not bad, str(bad))

    # 静音检查必须存在
    names = [n.attr for n in ast.walk(tree) if isinstance(n, ast.Attribute)]
    check("保活循环仍然调用静音检查", "_check_silence" in names, str(names))
    check("可发现保活拆成了独立方法",
          hasattr(M.Plugin, "_keep_discoverable"))


def main():
    if not install_decky_stub():
        print("缺少 _decky_stub.py，无法导入 main")
        sys.exit(1)
    for fn in (test_pactl_shared, test_pw_dump_shared, test_wpctl_status_shared,
               test_versions_cached, test_player_tree_cached,
               test_multi_property_busctl, test_multi_property_fallback,
               test_run_cached_only_caches_success,
               test_cache_bounded, test_auto_gain_session_reset,
               test_inflight_dedup, test_cache_failure_not_cached,
               test_keepalive_decoupled):
        fn()
    print()
    if FAILED:
        print("失败 %d 项：%s" % (len(FAILED), ", ".join(FAILED)))
        sys.exit(1)
    print("性能回归全部通过 ✅")


if __name__ == "__main__":
    main()
