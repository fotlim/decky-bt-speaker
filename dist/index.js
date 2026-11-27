var __BT_META__ = {"version":"2.9.0","build":"11-27 22:14"};

const manifest = {"name":"Bluetooth Speaker"};
const API_VERSION = 2;
const internalAPIConnection = window.__DECKY_SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED_deckyLoaderAPIInit;
if (!internalAPIConnection) {
    throw new Error('[@decky/api]: Failed to connect to the loader as as the loader API was not initialized. This is likely a bug in Decky Loader.');
}
let api$1;
try {
    api$1 = internalAPIConnection.connect(API_VERSION, manifest.name);
}
catch {
    api$1 = internalAPIConnection.connect(1, manifest.name);
    console.warn(`[@decky/api] Requested API version ${API_VERSION} but the running loader only supports version 1. Some features may not work.`);
}
if (api$1._version != API_VERSION) {
    console.warn(`[@decky/api] Requested API version ${API_VERSION} but the running loader only supports version ${api$1._version}. Some features may not work.`);
}
const call$1 = api$1.call;
const routerHook = api$1.routerHook;
const toaster = api$1.toaster;
const definePlugin = (fn) => {
    return (...args) => {
        return fn(...args);
    };
};

var DefaultContext = {
  color: undefined,
  size: undefined,
  className: undefined,
  style: undefined,
  attr: undefined
};
var IconContext = SP_REACT.createContext && /*#__PURE__*/SP_REACT.createContext(DefaultContext);

var _excluded = ["attr", "size", "title"];
function _objectWithoutProperties(e, t) { if (null == e) return {}; var o, r, i = _objectWithoutPropertiesLoose(e, t); if (Object.getOwnPropertySymbols) { var n = Object.getOwnPropertySymbols(e); for (r = 0; r < n.length; r++) o = n[r], -1 === t.indexOf(o) && {}.propertyIsEnumerable.call(e, o) && (i[o] = e[o]); } return i; }
function _objectWithoutPropertiesLoose(r, e) { if (null == r) return {}; var t = {}; for (var n in r) if ({}.hasOwnProperty.call(r, n)) { if (-1 !== e.indexOf(n)) continue; t[n] = r[n]; } return t; }
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), true).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: true, configurable: true, writable: true }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function Tree2Element(tree) {
  return tree && tree.map((node, i) => /*#__PURE__*/SP_REACT.createElement(node.tag, _objectSpread({
    key: i
  }, node.attr), Tree2Element(node.child)));
}
function GenIcon(data) {
  return props => /*#__PURE__*/SP_REACT.createElement(IconBase, _extends({
    attr: _objectSpread({}, data.attr)
  }, props), Tree2Element(data.child));
}
function IconBase(props) {
  var elem = conf => {
    var attr = props.attr,
      size = props.size,
      title = props.title,
      svgProps = _objectWithoutProperties(props, _excluded);
    var computedSize = size || conf.size || "1em";
    var className;
    if (conf.className) className = conf.className;
    if (props.className) className = (className ? className + " " : "") + props.className;
    return /*#__PURE__*/SP_REACT.createElement("svg", _extends({
      stroke: "currentColor",
      fill: "currentColor",
      strokeWidth: "0"
    }, conf.attr, attr, svgProps, {
      className: className,
      style: _objectSpread(_objectSpread({
        color: props.color || conf.color
      }, conf.style), props.style),
      height: computedSize,
      width: computedSize,
      xmlns: "http://www.w3.org/2000/svg"
    }), title && /*#__PURE__*/SP_REACT.createElement("title", null, title), props.children);
  };
  return IconContext !== undefined ? /*#__PURE__*/SP_REACT.createElement(IconContext.Consumer, null, conf => elem(conf)) : elem(DefaultContext);
}

// THIS FILE IS AUTO GENERATED
function FaBluetooth (props) {
  return GenIcon({"attr":{"viewBox":"0 0 448 512"},"child":[{"tag":"path","attr":{"d":"M292.6 171.1L249.7 214l-.3-86 43.2 43.1m-43.2 219.8l43.1-43.1-42.9-42.9-.2 86zM416 259.4C416 465 344.1 512 230.9 512S32 465 32 259.4 115.4 0 228.6 0 416 53.9 416 259.4zm-158.5 0l79.4-88.6L211.8 36.5v176.9L138 139.6l-27 26.9 92.7 93-92.7 93 26.9 26.9 73.8-73.8 2.3 170 127.4-127.5-83.9-88.7z"},"child":[]}]})(props);
}function FaBluetoothB (props) {
  return GenIcon({"attr":{"viewBox":"0 0 320 512"},"child":[{"tag":"path","attr":{"d":"M196.48 260.023l92.626-103.333L143.125 0v206.33l-86.111-86.111-31.406 31.405 108.061 108.399L25.608 368.422l31.406 31.405 86.111-86.111L145.84 512l148.552-148.644-97.912-103.333zm40.86-102.996l-49.977 49.978-.338-100.295 50.315 50.317zM187.363 313.04l49.977 49.978-50.315 50.316.338-100.294z"},"child":[]}]})(props);
}function FaVolumeUp (props) {
  return GenIcon({"attr":{"viewBox":"0 0 576 512"},"child":[{"tag":"path","attr":{"d":"M215.03 71.05L126.06 160H24c-13.26 0-24 10.74-24 24v144c0 13.25 10.74 24 24 24h102.06l88.97 88.95c15.03 15.03 40.97 4.47 40.97-16.97V88.02c0-21.46-25.96-31.98-40.97-16.97zm233.32-51.08c-11.17-7.33-26.18-4.24-33.51 6.95-7.34 11.17-4.22 26.18 6.95 33.51 66.27 43.49 105.82 116.6 105.82 195.58 0 78.98-39.55 152.09-105.82 195.58-11.17 7.32-14.29 22.34-6.95 33.5 7.04 10.71 21.93 14.56 33.51 6.95C528.27 439.58 576 351.33 576 256S528.27 72.43 448.35 19.97zM480 256c0-63.53-32.06-121.94-85.77-156.24-11.19-7.14-26.03-3.82-33.12 7.46s-3.78 26.21 7.41 33.36C408.27 165.97 432 209.11 432 256s-23.73 90.03-63.48 115.42c-11.19 7.14-14.5 22.07-7.41 33.36 6.51 10.36 21.12 15.14 33.12 7.46C447.94 377.94 480 319.54 480 256zm-141.77-76.87c-11.58-6.33-26.19-2.16-32.61 9.45-6.39 11.61-2.16 26.2 9.45 32.61C327.98 228.28 336 241.63 336 256c0 14.38-8.02 27.72-20.92 34.81-11.61 6.41-15.84 21-9.45 32.61 6.43 11.66 21.05 15.8 32.61 9.45 28.23-15.55 45.77-45 45.77-76.88s-17.54-61.32-45.78-76.86z"},"child":[]}]})(props);
}function FaVolumeMute (props) {
  return GenIcon({"attr":{"viewBox":"0 0 512 512"},"child":[{"tag":"path","attr":{"d":"M215.03 71.05L126.06 160H24c-13.26 0-24 10.74-24 24v144c0 13.25 10.74 24 24 24h102.06l88.97 88.95c15.03 15.03 40.97 4.47 40.97-16.97V88.02c0-21.46-25.96-31.98-40.97-16.97zM461.64 256l45.64-45.64c6.3-6.3 6.3-16.52 0-22.82l-22.82-22.82c-6.3-6.3-16.52-6.3-22.82 0L416 210.36l-45.64-45.64c-6.3-6.3-16.52-6.3-22.82 0l-22.82 22.82c-6.3 6.3-6.3 16.52 0 22.82L370.36 256l-45.63 45.63c-6.3 6.3-6.3 16.52 0 22.82l22.82 22.82c6.3 6.3 16.52 6.3 22.82 0L416 301.64l45.64 45.64c6.3 6.3 16.52 6.3 22.82 0l22.82-22.82c6.3-6.3 6.3-16.52 0-22.82L461.64 256z"},"child":[]}]})(props);
}function FaMoon (props) {
  return GenIcon({"attr":{"viewBox":"0 0 512 512"},"child":[{"tag":"path","attr":{"d":"M283.211 512c78.962 0 151.079-35.925 198.857-94.792 7.068-8.708-.639-21.43-11.562-19.35-124.203 23.654-238.262-71.576-238.262-196.954 0-72.222 38.662-138.635 101.498-174.394 9.686-5.512 7.25-20.197-3.756-22.23A258.156 258.156 0 0 0 283.211 0c-141.309 0-256 114.511-256 256 0 141.309 114.511 256 256 256z"},"child":[]}]})(props);
}function FaMobileAlt (props) {
  return GenIcon({"attr":{"viewBox":"0 0 320 512"},"child":[{"tag":"path","attr":{"d":"M272 0H48C21.5 0 0 21.5 0 48v416c0 26.5 21.5 48 48 48h224c26.5 0 48-21.5 48-48V48c0-26.5-21.5-48-48-48zM160 480c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32zm112-108c0 6.6-5.4 12-12 12H60c-6.6 0-12-5.4-12-12V60c0-6.6 5.4-12 12-12h200c6.6 0 12 5.4 12 12v312z"},"child":[]}]})(props);
}function FaLaptop (props) {
  return GenIcon({"attr":{"viewBox":"0 0 640 512"},"child":[{"tag":"path","attr":{"d":"M624 416H381.54c-.74 19.81-14.71 32-32.74 32H288c-18.69 0-33.02-17.47-32.77-32H16c-8.8 0-16 7.2-16 16v16c0 35.2 28.8 64 64 64h512c35.2 0 64-28.8 64-64v-16c0-8.8-7.2-16-16-16zM576 48c0-26.4-21.6-48-48-48H112C85.6 0 64 21.6 64 48v336h512V48zm-64 272H128V64h384v256z"},"child":[]}]})(props);
}function FaCog (props) {
  return GenIcon({"attr":{"viewBox":"0 0 512 512"},"child":[{"tag":"path","attr":{"d":"M487.4 315.7l-42.6-24.6c4.3-23.2 4.3-47 0-70.2l42.6-24.6c4.9-2.8 7.1-8.6 5.5-14-11.1-35.6-30-67.8-54.7-94.6-3.8-4.1-10-5.1-14.8-2.3L380.8 110c-17.9-15.4-38.5-27.3-60.8-35.1V25.8c0-5.6-3.9-10.5-9.4-11.7-36.7-8.2-74.3-7.8-109.2 0-5.5 1.2-9.4 6.1-9.4 11.7V75c-22.2 7.9-42.8 19.8-60.8 35.1L88.7 85.5c-4.9-2.8-11-1.9-14.8 2.3-24.7 26.7-43.6 58.9-54.7 94.6-1.7 5.4.6 11.2 5.5 14L67.3 221c-4.3 23.2-4.3 47 0 70.2l-42.6 24.6c-4.9 2.8-7.1 8.6-5.5 14 11.1 35.6 30 67.8 54.7 94.6 3.8 4.1 10 5.1 14.8 2.3l42.6-24.6c17.9 15.4 38.5 27.3 60.8 35.1v49.2c0 5.6 3.9 10.5 9.4 11.7 36.7 8.2 74.3 7.8 109.2 0 5.5-1.2 9.4-6.1 9.4-11.7v-49.2c22.2-7.9 42.8-19.8 60.8-35.1l42.6 24.6c4.9 2.8 11 1.9 14.8-2.3 24.7-26.7 43.6-58.9 54.7-94.6 1.5-5.5-.7-11.3-5.6-14.1zM256 336c-44.1 0-80-35.9-80-80s35.9-80 80-80 80 35.9 80 80-35.9 80-80 80z"},"child":[]}]})(props);
}

/** 包一层 call：后端出错时返回 {__bt_error__}，这里转成可读 Error 抛出 */
async function call(route, ...args) {
    const r = await call$1(route, ...args);
    if (r && typeof r === "object" && "__bt_error__" in r) {
        throw new Error(String(r["__bt_error__"]));
    }
    return r;
}
const api = {
    status: () => call("status"),
    setDiscoverable: (on) => call("set_discoverable", on),
    setPower: (on) => call("set_power", on),
    unblockRfkill: () => call("unblock_rfkill"),
    restartAgent: () => call("restart_agent"),
    pairDevice: (mac) => call("pair_device", mac),
    scanStart: (timeout = 20) => call("scan_start", timeout),
    /** 拉取当前扫描结果（边扫边出） */
    scanList: () => call("scan_list"),
    /** 停止扫描 */
    scanStop: () => call("scan_stop"),
    pairDeviceFull: (mac) => call("pair_device_full", mac),
    repairDevice: (mac) => call("repair_device", mac),
    setAlias: (alias) => call("set_alias", alias),
    deviceAction: (mac, action, value) => call("device_action", mac, action, value),
    /** 等 A2DP 就绪（界面显示「正在协商」时可反复调用刷新） */
    waitA2dp: (mac, seconds = 12) => call("wait_a2dp", mac, seconds),
    /** 强制把蓝牙卡切到 a2dp-sink（协商卡在 off / HFP 时用） */
    fixA2dp: (mac) => call("fix_a2dp", mac),
    /** 断开所有已连接设备 */
    /** 息屏状态 */
    getScreen: () => call("get_screen"),
    /** 息屏（背光归 0 + 抑制自动休眠，否则蓝牙会断） */
    dimScreen: () => call("dim_screen"),
    /** 恢复显示 */
    undimScreen: () => call("undim_screen"),
    /** 休眠抑制状态 + 系统里所有 inhibitor 锁 */
    getInhibit: () => call("get_inhibit"),
    /** 息屏能力诊断 */
    getScreenDiag: () => call("get_screen_diag"),
    setVolume: (v) => call("set_volume", v),
    /** 相对调节：不读当前值，直接增减。避免依赖读取，因此不会出现同步问题。 */
    stepVolume: (delta) => call("step_volume", delta),
    setMute: (m) => call("set_mute", m),
    stepSourceVolume: (nodeId, delta) => call("step_source_volume", nodeId, delta),
    setSourceMute: (nodeId, m) => call("set_source_mute", nodeId, m),
    boostVolume: (gain = 1.5) => call("boost_volume", gain),
    diagnoseStutter: () => call("diagnose_stutter"),
    fixStutter: () => call("fix_stutter"),
    setCodecPreset: (preset) => call("set_codec_preset", preset),
    setFocusMode: (mode) => call("set_focus_mode", mode),
    setSilenceTimeout: (sec) => call("set_silence_timeout", sec),
    setVolumeBaseline: (v) => call("set_volume_baseline", v),
    resetVolumeBaseline: () => call("reset_volume_baseline"),
    setEqPreset: (preset) => call("set_eq_preset", preset),
    removeEq: () => call("remove_eq"),
    importAutoeq: (text) => call("import_autoeq", text),
    setLatencyProfile: (profile) => call("set_latency_profile", profile),
    setMultiOutput: (on) => call("set_multi_output", on),
    setSetting: (key, value) => call("set_setting", key, value),
    applyTuning: () => call("apply_tuning"),
    removeTuning: () => call("remove_tuning"),
    diagnose: () => call("diagnose"),
    report: () => call("report"),
    getLog: (tail = 200) => call("get_log", tail),
};

/**
 * 状态单例：QAM 面板和全屏页共用一份轮询。
 *
 * 性能设计（评审反馈「2 秒轮询太频繁」的回应）
 * ------------------------------------------------
 * 后端每次 `status` 要 fork+exec 4~6 个外部命令
 * （bluetoothctl show / wpctl get-volume / wpctl status /
 *   bluetoothctl devices / pactl list cards），在 Deck 上不便宜。
 * 而且这些状态绝大多数时候根本没变。
 *
 * 所以做了三层节流：
 *
 * 1. **可见性感知**：QAM 收起 / 全屏页关闭时降频到 30 秒（而不是停掉，
 *    否则重新打开时会看到过期数据）。
 * 2. **自适应间隔**：有外部音源在播时 4 秒（需要跟播放状态），
 *    空闲时 10 秒（只需要知道有没有人连上来）。
 * 3. **请求去重**：`_inflight` 保证同一时刻只有一个 status 在跑，
 *    多个组件同时挂载不会重复请求。
 *
 * 理想方案是后端订阅 D-Bus 的 PropertiesChanged 信号做事件驱动，
 * 但那需要常驻 `dbus-monitor` 进程，权衡后这里先用自适应轮询
 * （零额外常驻进程，实现简单，实测开销可接受）。
 */
const FAST_MS = 4000; // 有外部音源在播
const IDLE_MS = 10000; // 已连接但没有音源
const HIDDEN_MS = 30000; // 界面不可见
let _state = null;
let _error = null;
let _loading = true;
let _subs = new Set();
let _timer = null;
let _inflight = null;
let _visible = false;
function emit() { _subs.forEach((f) => f()); }
/** 按当前状态算出下次该等多久。 */
function nextInterval() {
    if (!_visible)
        return HIDDEN_MS;
    if (_state?.live)
        return FAST_MS; // 有人在放歌，需要跟进度
    if (_state?.connected?.length)
        return IDLE_MS;
    return IDLE_MS;
}
async function refresh(force = false) {
    if (_inflight && !force)
        return _inflight;
    _inflight = (async () => {
        try {
            const r = await api.status();
            _state = r;
            _error = r.ok ? null : (r.error || "unknown error");
        }
        catch (e) {
            _error = e?.message || String(e);
        }
        finally {
            _loading = false;
            _inflight = null;
            emit();
            reschedule();
        }
    })();
    return _inflight;
}
/** 用 setTimeout 链而不是 setInterval：间隔可以随状态动态变化。 */
function reschedule() {
    if (_timer) {
        clearTimeout(_timer);
        _timer = null;
    }
    if (_subs.size === 0)
        return; // 没人订阅就不轮询
    _timer = setTimeout(() => { refresh(); }, nextInterval());
}
function setVisible(v) {
    if (_visible === v)
        return;
    _visible = v;
    // 刚变可见立刻刷新一次，避免看到过期数据
    if (v)
        refresh(true);
    else
        reschedule();
}
function startPolling() {
    if (!_timer)
        refresh(true);
}
function stopPolling() {
    if (_timer) {
        clearTimeout(_timer);
        _timer = null;
    }
}
function useSpeaker() {
    const [, force] = SP_REACT.useState(0);
    SP_REACT.useEffect(() => {
        const f = () => force((n) => n + 1);
        _subs.add(f);
        startPolling();
        // 页面可见性：切到别的界面时降频
        const onVis = () => setVisible(!document.hidden);
        document.addEventListener("visibilitychange", onVis);
        setVisible(!document.hidden);
        return () => {
            _subs.delete(f);
            document.removeEventListener("visibilitychange", onVis);
            // 最后一个订阅者离开时停掉定时器（下次挂载会重新起）
            if (_subs.size === 0) {
                _visible = false;
                if (_timer) {
                    clearTimeout(_timer);
                    _timer = null;
                }
            }
        };
    }, []);
    return { state: _state, error: _error, loading: _loading, refresh: () => { refresh(true); } };
}
/** 供 QAM 面板显式标记可见性（QAM 收起时 document.hidden 不一定变）。 */
function setPanelVisible(v) { setVisible(v); }

const ROUTE = "/decky/bt-speaker";
const COLORS = {
    bg: "#0f1620",
    accent: "#4c9aff",
    accentWarm: "#ec4141",
    ok: "#4cc38a",
    text: "#e8ebee",
    sub: "#9aa6b2",
    dim: "#6b7783",
    border: "rgba(255,255,255,0.07)",
};

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------
/**
 * 从 catch 到的任意值里取出可读的错误文本。
 *
 * 为什么需要它？
 * ------------
 * TS 4.4+ 的 `useUnknownInCatchVariables` 下，`catch (e)` 里的 e 是 `unknown`，
 * 直接读 `e.message` 会编译报错。早期代码为了省事全写成 `catch (e: any)`，
 * 但那等于关掉了类型检查 —— 后端返回什么形状都不会被发现。
 *
 * 统一走这个函数，既能拿到消息，又保持 unknown 的类型安全。
 */
function errMsg(e) {
    if (e == null)
        return "unknown error";
    if (typeof e === "string")
        return e;
    if (e instanceof Error)
        return e.message;
    if (typeof e === "object") {
        const m = e.message;
        if (typeof m === "string")
            return m;
        try {
            return JSON.stringify(e);
        }
        catch {
            return String(e);
        }
    }
    return String(e);
}
function Pill({ children, tone = "dim" }) {
    const map = {
        ok: { bg: "rgba(76,195,138,0.16)", fg: COLORS.ok },
        warn: { bg: "rgba(236,65,65,0.16)", fg: COLORS.accentWarm },
        accent: { bg: "rgba(76,154,255,0.16)", fg: COLORS.accent },
        dim: { bg: "rgba(255,255,255,0.07)", fg: COLORS.sub },
    };
    const c = map[tone] || map.dim;
    return (SP_JSX.jsx("span", { style: {
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "2px 8px", borderRadius: 10, fontSize: 11,
            background: c.bg, color: c.fg, whiteSpace: "nowrap",
        }, children: children }));
}
function SectionTitle({ children, right }) {
    return (SP_JSX.jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", margin: "18px 4px 10px" }, children: [SP_JSX.jsx("div", { style: { fontSize: 18, fontWeight: 600, color: COLORS.text }, children: children }), right] }));
}
function Loading({ text = "加载中…" }) {
    return SP_JSX.jsx("div", { style: { padding: 24, color: COLORS.sub, fontSize: 14, textAlign: "center" }, children: text });
}
function ErrorText({ text }) {
    return (SP_JSX.jsx("div", { style: {
            margin: "8px 4px", padding: "10px 12px", borderRadius: 8, fontSize: 12.5, lineHeight: 1.6,
            color: "#ffb3b3", background: "rgba(236,65,65,0.10)", border: "1px solid rgba(236,65,65,0.25)",
            whiteSpace: "pre-wrap", wordBreak: "break-word",
        }, children: text }));
}
function Hint({ children }) {
    return (SP_JSX.jsx("div", { style: { margin: "6px 4px", fontSize: 12, lineHeight: 1.65, color: COLORS.dim }, children: children }));
}
function Card({ children, onClick, active = false }) {
    const inner = (SP_JSX.jsx("div", { style: {
            display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
            borderRadius: 10, background: active ? "rgba(76,154,255,0.12)" : "rgba(255,255,255,0.045)",
            border: `1px solid ${active ? "rgba(76,154,255,0.35)" : COLORS.border}`,
        }, children: children }));
    if (!onClick)
        return inner;
    return (SP_JSX.jsx(DFL.Focusable, { onActivate: onClick, onClick: onClick, style: { cursor: "pointer", marginBottom: 8 }, children: inner }));
}
function Avatar({ icon, connected }) {
    const isPhone = (icon || "").includes("phone");
    const glyph = isPhone ? "📱" : (icon || "").includes("computer") ? "💻" : "🔊";
    return (SP_JSX.jsx("div", { style: {
            width: 40, height: 40, borderRadius: 20, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
            background: connected ? "rgba(76,195,138,0.16)" : "rgba(255,255,255,0.06)",
            border: `1px solid ${connected ? "rgba(76,195,138,0.4)" : COLORS.border}`,
        }, children: glyph }));
}

/**
 * 轻量 i18n：跟随 Steam 客户端语言，默认英文。
 *
 * 为什么不直接用 i18next？
 * ----------------------
 * Decky Loader 内部用 i18next，但那是给 loader 自己用的，
 * 插件无法直接复用它的实例和语言包。自己做一个极小的查表方案更可靠，
 * 也避免引入额外依赖（Decky 插件体积越小越好）。
 *
 * 语言从哪来？
 * -----------
 * 按可靠性排序依次尝试：
 *   1. `SteamClient.Settings.GetLanguage()`（最准，跟随 Steam 界面语言）
 *   2. `navigator.language`
 *   3. 兜底 `en`
 *
 * 中文用户会拿到 `schinese` / `zh-CN` 等，统一归一化成 `zh`。
 */
const EN = {
    // 通用
    "common.ok": "OK",
    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.saving": "Saving…",
    "common.remove": "Remove",
    "common.retry": "Retry",
    "common.reading": "Reading…",
    "common.none": "None",
    "common.unknown": "Unknown",
    "common.empty": "(empty)",
    // 插件名
    "plugin.name": "Bluetooth Speaker",
    // QAM 面板
    "qam.btOn": "Bluetooth on",
    "qam.btOff": "Bluetooth off",
    "qam.discoverable": "Discoverable",
    "qam.notVisible": "Hidden",
    "qam.connectedCount": "{n} connected",
    "qam.allowDiscover": "Allow devices to find and connect",
    "qam.allowDiscoverDescOn": "This Deck appears in phone / PC Bluetooth lists",
    "qam.allowDiscoverDescOff": "Turn on so other devices can find it",
    "qam.turnOnBt": "Turn on Bluetooth",
    "qam.unblockRfkill": "Unblock radio (needs sudo)",
    "qam.rfkillHard": "Bluetooth is hardware-blocked. Software can't fix it — restart the Deck.",
    "qam.rfkillSoft": "Bluetooth is blocked by the radio switch. This is the most common reason it won't turn on.",
    "qam.playing": "Now playing: {name}",
    "qam.externalSource": "External source",
    "qam.disconnect": "Disconnect",
    "qam.volume": "Volume",
    "qam.volumeHint": "use Steam volume keys for exact value",
    "qam.mute": "Mute",
    "qam.unmute": "Unmute",
    "qam.clipping": "may clip",
    "qam.boost": "Too quiet? Boost to 130%",
    "qam.boostHint": "Set absolute volume (no read-back needed):",
    "qam.boosted": "Boosted to 130%",
    "qam.boosted100": "Volume set to 100%",
    "qam.boosted130": "Volume set to 130%",
    "qam.boosted150": "Volume set to 150%",
    "qam.boosted200": "Volume set to 200% (may clip)",
    "qam.hintFind": "Look for {alias} in your phone's Bluetooth settings, then just play.",
    "qam.manage": "Devices / Settings",
    "qam.dimScreen": "Turn off screen (keep playing)",
    "qam.dimHint": "Tap anywhere or press any key to wake",
    "qam.dimFailed": "Cannot turn off screen",
    "qam.inhibitFailed": "Bluetooth may drop while screen is off",
    "qam.inhibitFailedBody": "The plugin could not stop the system from auto-suspending. Your Deck will sleep on the idle timer and the audio link drops. Turn off \"sleep after idle\" in Steam > Settings > Power, or check systemd-inhibit permissions.",
    "qam.dimKeepAwake": "Auto-suspend is blocked while the screen is off",
    "qam.dimScreenHint": "The screen turns off and the Deck stays awake, so the audio link survives.",
    "qam.playingLabel": "Playing",
    "qam.negotiating": "Negotiating audio (A2DP)…",
    "qam.negotiatingHint": "The Bluetooth link is up, but the audio profile is still being negotiated. It usually takes 1-6 seconds before the Deck shows up as a speaker on your device. Just wait a moment.",
    "qam.a2dpForce": "Force A2DP sink profile",
    "qam.a2dpFixed": "Switched to A2DP sink",
    "qam.a2dpFixFailed": "Could not switch profile",
    // 全屏页
    "page.title": "Bluetooth Speaker",
    "page.readingAdapter": "Reading Bluetooth adapter…",
    "page.a2dpSink": "A2DP Sink",
    "page.noSink": "No Sink role",
    "tab.devices": "Paired",
    "tab.settings": "Settings",
    "tab.eq": "Equalizer",
    "tab.diag": "Diagnostics",
    // 设备
    "dev.search": "Search nearby devices",
    "dev.searchHint": "Streaming scan: results appear as they're found. Tap again to stop early.",
    "dev.searchHintWarn": "Tip: turn on \"Allow devices to find and connect\" in QAM first.",
    "dev.searching": "Searching…",
    "dev.stopScan": "Stop",
    "dev.foundCount": "{n} found",
    "dev.showUnnamed": "Show unnamed devices",
    "dev.showUnnamedDesc": "Devices that don't broadcast a name are shown with a type + MAC tail label. Turn off to hide clutter.",
    "dev.hiddenCount": "{n} unnamed devices hidden",
    "dev.hiddenPaired": "{n} unnamed paired devices hidden",
    "dev.allHidden": "All {n} devices found are unnamed. Turn on \"Show unnamed devices\" to see them.",
    "dev.pair": "Pair",
    "dev.pairing": "Pairing…",
    "dev.paired": "Paired {name}",
    "dev.pairFailed": "Pair failed",
    "dev.noneFound": "No unpaired devices found. The phone may already be paired, or its Bluetooth is off.",
    "dev.noDevices": "No devices paired yet. Use \"Search nearby devices\" above to find your phone.",
    "dev.pairedCount": "Paired ({n})",
    "dev.connected": "Connected",
    "dev.notConnected": "Not connected",
    "dev.connect": "Connect",
    "dev.connecting": "Connecting…",
    "dev.disconnected": "Disconnected",
    "dev.repair": "Repair",
    "dev.repairing": "Repairing…",
    "dev.removed": "Pairing removed",
    "dev.noName": "device did not broadcast a name",
    "dev.unknownLabel": "Unknown device · {mac}",
    "dev.pairedTag": "Paired",
    "dev.untrusted": "Untrusted",
    "dev.blocked": "Blocked",
    "dev.trust": "Trust",
    "dev.untrust": "Untrust",
    "dev.trustedOn": "Trusted — auto-reconnect allowed",
    "dev.trustedOff": "Untrusted — auto-reconnect disabled",
    "dev.connectedToast": "Connected {name}",
    "dev.connectFailed": "Connect failed",
    "dev.hint": "Once connected, play music on your phone and it comes out of the Deck. Only one A2DP source at a time.",
    "dev.hintPair": "Pairing code / passkey incorrect? Tap \"Repair\" — it clears the old bond key on the Deck side. If it still fails, \"Forget\" the device on your phone too.",
    // 设置
    "set.name": "Device name",
    "set.nameHint": "The name others see in their Bluetooth list.",
    "set.audioTuning": "Speaker tuning",
    "set.audioTuningLabel": "Enable \"speaker optimization\"",
    "set.audioTuningDesc": "Writes a user-level WirePlumber config: A2DP-only roles, external stream goes straight to speakers, no fallback to call mono. Restarts WirePlumber.",
    "set.tuningOn": "Speaker optimization enabled",
    "set.tuningOff": "Restored system defaults",
    "set.tuningHint": "Config: {path}. If you get no sound after connecting, or it sounds muffled, turn this on and reconnect.",
    "set.pairing": "Pairing",
    "set.pairingHint": "The pairing agent answers requests from your phone. If the phone shows a code but the Deck does nothing, restart it here.",
    "set.agentReady": "Pairing agent ready",
    "set.agentRunning": "Agent running, registration unconfirmed",
    "set.agentDown": "Pairing agent not running",
    "set.restartAgent": "Restart agent",
    "set.focus": "Audio focus",
    "set.focusHint": "How phone audio and game audio share the speakers. Your system default output is never rewritten.",
    "set.focusCoexist": "Coexist with game",
    "set.focusCoexistDesc": "Both play, neither takes over (recommended)",
    "set.focusReceiver": "Receiver first",
    "set.focusReceiverDesc": "Prioritize phone audio quality, disable auto call-mode switch",
    "set.focusManual": "Manual",
    "set.focusManualDesc": "Plugin stays out of it, use the system volume panel",
    "set.codec": "Audio quality (codec)",
    "set.codecHint": "Bluetooth quality is mostly decided by the codec. SBC-XQ is a high-quality SBC variant: ~452 kbps vs 328, with almost no compatibility loss.",
    "set.codecCurrent": "Active codec: {codec}",
    "set.codecReconnect": "After changing the codec, disconnect and reconnect on your phone so it renegotiates.",
    "set.stutter": "Stutter / quality",
    "set.stutterWifi": "2.4 GHz Wi-Fi interference detected",
    "set.stutterWifiBody": "Bluetooth shares the 2.4 GHz radio with Wi-Fi — the top cause of audio stutter. Switching Wi-Fi to 5 GHz usually fixes it immediately.",
    "set.stutterOk": "Wi-Fi is on 5 GHz or not connected — no conflict with Bluetooth.",
    "set.fixStutter": "Fix stuttering",
    "set.diagStutter": "Diagnose",
    "set.stutterHint": "\"Fix stuttering\" switches to the anti-stutter latency profile (bigger buffer) and sets volume to 100%.",
    "set.latencyHint": "A2DP latency depends on codec and buffering. This trades battery / low latency / anti-stutter.",
    "set.outputsNow": "Current outputs:",
    "set.avdtpLimit": "The reverse is impossible: AVDTP (v1.3 §5.3) allows only one A2DP source device per adapter at a time.",
    "set.codecInfo": "Codec",
    "set.codecActive": "Active codec",
    "set.codecRole": "Direction",
    "set.defaultOutput": "Default output",
    "set.power": "Power saving",
    "set.powerHint": "Phones often stay connected after the music stops. Auto-disconnect keeps the radio free.",
    "set.silence": "Auto-disconnect after silence",
    "set.silenceOff": "Off",
    "set.silenceRemain": "({n}s left)",
    "set.normalize": "Volume normalization",
    "set.normalizeHint": "Track-to-track volume jumps are common. A baseline is recorded and jumps over 25% are flagged. Baseline: {base}",
    "set.normJumps": "{n} jumps detected",
    "set.normUnset": "not set",
    "set.setBaseline": "Use current volume",
    "set.resetBaseline": "Reset",
    "set.behavior": "Behavior",
    "set.autoStart": "Enter discoverable mode on load",
    "set.autoStartDesc": "Turn Bluetooth on automatically when Decky loads",
    "set.keepAlive": "Stay discoverable",
    "set.keepAliveDesc": "BlueZ hides the adapter after 180s by default; re-checked every minute",
    "set.resume": "Restore after sleep",
    "set.resumeDescOn": "Watching ({backend}): restores discoverable and reconnects the last device",
    "set.resumeDescOff": "Listen for suspend/resume and restore Bluetooth state (closing the lid won't drop the link)",
    "set.resumeEvents": "{n} suspend/resume events captured, last: {last}",
    "set.lastDevice": "last device {mac}",
    "set.sysinfo": "System info",
    // EQ
    "eq.presets": "Presets",
    "eq.hint": "Uses PipeWire's built-in param_eq (no external plugins). Switching restarts PipeWire — expect a second of silence.",
    "eq.bands": "{n} bands",
    "eq.custom": "Custom (AutoEQ import)",
    "eq.customActive": "Using imported curve",
    "eq.active": "Active",
    "eq.import": "Import AutoEQ / Squiglink curve",
    "eq.importHint": "Copy the contents of ParametricEQ.txt from AutoEq or squig.link and paste it here. Format: `Filter 1: ON PK Fc 21 Hz Gain 6.7 dB Q 1.100`.",
    "eq.configPath": "Config file:",
    "eq.paste": "Paste curve…",
    "eq.collapse": "Collapse",
    "eq.removeEq": "Remove EQ entirely",
    "eq.applyImport": "Import and apply",
    "eq.importing": "Importing…",
    "eq.applied": "EQ switched",
    "eq.appliedBody": "PipeWire restarted, there may be a second of silence",
    "eq.imported": "Imported {n} EQ bands",
    "eq.skipped": "skipped {n} unrecognized lines",
    // 诊断
    "diag.checks": "Self-check",
    "diag.modules": "Backend modules",
    "diag.tools": "Command availability",
    "diag.adapterRaw": "Raw adapter info",
    "diag.wpStatus": "Audio status",
    "diag.report": "Full report",
    "diag.copy": "Copy diagnostic report",
    "diag.copied": "Report copied",
    "diag.copiedBody": "Paste it to the author",
    "diag.generated": "Report generated",
    "diag.generatedBody": "Select and copy below",
    "diag.viewLog": "View log",
    "diag.pluginLog": "Plugin log",
    "diag.agent": "Pairing agent",
    // 自检项（后端只返回 key，这里翻译）
    "chk.bluetoothctl": "bluetoothctl available",
    "chk.busctl": "busctl available",
    "chk.wpctl": "wpctl available",
    "chk.adapter": "Bluetooth adapter detected",
    "chk.a2dpSink": "Adapter supports A2DP Sink",
    "chk.powered": "Bluetooth is powered on",
    "chk.agent": "Pairing agent running",
    "chk.discoverable": "Discoverable",
    "chk.pipewireSink": "PipeWire has an audio output",
    "chk.pwVersion": "PipeWire version readable",
    "chk.wpVersion": "WirePlumber version readable",
    "chk.modules": "All backend modules loaded",
    "chk.inhibit": "systemd-inhibit available (keeps Bluetooth alive while screen is off)",
    // Toast
    "toast.failed": "Operation failed",
    "toast.saveFailed": "Save failed",
    "toast.switchFailed": "Switch failed",
    "toast.nameChanged": "Device name set to {name}",
    "toast.renameFailed": "Rename failed",
};
const ZH = {
    "common.ok": "确定",
    "common.cancel": "取消",
    "common.save": "保存",
    "common.saving": "保存中…",
    "common.remove": "移除",
    "common.retry": "重试",
    "common.reading": "读取中…",
    "common.none": "无",
    "common.unknown": "未知",
    "common.empty": "（空）",
    "plugin.name": "蓝牙音箱",
    "qam.btOn": "蓝牙已开",
    "qam.btOff": "蓝牙已关",
    "qam.discoverable": "可被发现",
    "qam.notVisible": "不可见",
    "qam.connectedCount": "{n} 台已连接",
    "qam.allowDiscover": "允许设备发现并连接",
    "qam.allowDiscoverDescOn": "手机 / 电脑的蓝牙列表里能看到这台 Deck",
    "qam.allowDiscoverDescOff": "打开后其它设备才能搜到",
    "qam.turnOnBt": "打开蓝牙",
    "qam.unblockRfkill": "解除射频阻挡（需要 sudo）",
    "qam.rfkillHard": "蓝牙被硬件开关阻挡（Hard blocked），软件解不了，请重启 Deck。",
    "qam.rfkillSoft": "蓝牙被射频开关阻挡了（Soft blocked），这是打不开蓝牙最常见的原因。",
    "qam.playing": "正在播放：{name}",
    "qam.externalSource": "外部音源",
    "qam.disconnect": "断开",
    "qam.volume": "音量",
    "qam.volumeHint": "精确数值请用 Steam 音量键",
    "qam.mute": "静音",
    "qam.unmute": "取消静音",
    "qam.clipping": "可能破音",
    "qam.boost": "声音太小？增强到 130%",
    "qam.boostHint": "直接设置绝对音量（不需要读取当前值）：",
    "qam.boosted": "已增益到 130%",
    "qam.boosted100": "音量已设为 100%",
    "qam.boosted130": "音量已设为 130%",
    "qam.boosted150": "音量已设为 150%",
    "qam.boosted200": "音量已设为 200%（可能破音）",
    "qam.hintFind": "在手机的「蓝牙」里找 {alias}，配对后直接放歌即可～",
    "qam.manage": "设备管理 / 设置",
    "qam.dimScreen": "息屏当音箱（继续播放）",
    "qam.dimHint": "触摸屏幕或按任意键唤醒",
    "qam.dimFailed": "无法关闭屏幕",
    "qam.inhibitFailed": "息屏期间蓝牙可能会断",
    "qam.inhibitFailedBody": "插件没能阻止系统自动休眠。闲置计时器走完 Deck 会睡下去，音频链路随之断开。请在 Steam > 设置 > 电源 里关掉「闲置后休眠」，或检查 systemd-inhibit 权限。",
    "qam.dimKeepAwake": "息屏期间已阻止系统自动休眠",
    "qam.dimScreenHint": "息屏后会保持唤醒，音频链路不会断。",
    "qam.playingLabel": "正在播放",
    "qam.negotiating": "正在协商音频（A2DP）…",
    "qam.negotiatingHint": "蓝牙链路已连上，但音频 profile 还在协商。通常 1~6 秒后你的设备上才会出现这台 Deck 作为音箱。稍等一下就好。",
    "qam.a2dpForce": "强制切到 A2DP 接收模式",
    "qam.a2dpFixed": "已切到 A2DP 接收模式",
    "qam.a2dpFixFailed": "切换 profile 失败",
    "page.title": "蓝牙音箱",
    "page.readingAdapter": "正在读取蓝牙适配器…",
    "page.a2dpSink": "A2DP Sink",
    "page.noSink": "无 Sink 角色",
    "tab.devices": "已配对设备",
    "tab.settings": "设置",
    "tab.eq": "均衡器",
    "tab.diag": "诊断",
    "dev.search": "搜索附近设备",
    "dev.searchHint": "流式扫描：搜到一个显示一个。再点一次可提前停止。",
    "dev.searchHintWarn": "建议先在 QAM 里打开「允许设备发现并连接」，否则对方可能搜不到这台 Deck。",
    "dev.searching": "正在搜索…",
    "dev.stopScan": "停止",
    "dev.foundCount": "已找到 {n} 个",
    "dev.showUnnamed": "显示没有名称的设备",
    "dev.showUnnamedDesc": "不广播名称的设备会用「类型 + MAC 后缀」标注。关掉可以过滤杂项。",
    "dev.hiddenCount": "已隐藏 {n} 个无名称设备",
    "dev.hiddenPaired": "已隐藏 {n} 个无名称的已配对设备",
    "dev.allHidden": "找到的 {n} 个设备都没有名称。打开「显示没有名称的设备」即可看到。",
    "dev.pair": "配对",
    "dev.pairing": "配对中…",
    "dev.paired": "已配对 {name}",
    "dev.pairFailed": "配对失败",
    "dev.noneFound": "没搜到未配对的设备。可能是：手机已经配过这台 Deck、或手机蓝牙没打开、或对方不可被发现。",
    "dev.noDevices": "还没有配对过任何设备。用上面的「搜索附近设备」找到手机后点「配对」即可，不用退出插件去系统蓝牙设置。",
    "dev.pairedCount": "已配对（{n}）",
    "dev.connected": "已连接",
    "dev.notConnected": "未连接",
    "dev.connect": "连接",
    "dev.connecting": "正在连接…",
    "dev.disconnected": "已断开",
    "dev.repair": "修复配对",
    "dev.repairing": "正在修复配对…",
    "dev.removed": "已移除配对",
    "dev.noName": "设备未广播名称",
    "dev.unknownLabel": "未知设备 · {mac}",
    "dev.pairedTag": "已配对",
    "dev.untrusted": "未信任",
    "dev.blocked": "已拉黑",
    "dev.trust": "信任",
    "dev.untrust": "取消信任",
    "dev.trustedOn": "已信任 —— 允许自动重连",
    "dev.trustedOff": "已取消信任 —— 禁止自动重连",
    "dev.connectedToast": "已连接 {name}",
    "dev.connectFailed": "连接失败",
    "dev.hint": "连接成功后在手机上播放音乐，声音就会从 Deck 的喇叭出来。同一时间只能有一个源在放（蓝牙 A2DP 的限制）。",
    "dev.hintPair": "配对码 / 通行密钥不正确？点「修复配对」——它会清除 Deck 端保存的旧绑定密钥再重新配对。如果仍失败，请在手机端也「忘记」这个设备后重新搜索。",
    "set.name": "设备名",
    "set.nameHint": "别人蓝牙列表里看到的名字。建议改成一个好认的名字。",
    "set.audioTuning": "音箱优化",
    "set.audioTuningLabel": "启用「音箱优化」配置",
    "set.audioTuningDesc": "写入用户级 WirePlumber 配置：只保留 A2DP 角色、外部推流直出、避免掉成通话单声道。改完会自动重启 WirePlumber。",
    "set.tuningOn": "已启用音箱优化",
    "set.tuningOff": "已恢复系统默认",
    "set.tuningHint": "配置文件：{path}。连上了却没声音、或者声音变成单声道发闷时，打开它再重连一次通常就好了。",
    "set.pairing": "配对",
    "set.pairingHint": "配对 agent 负责应答手机的配对请求。如果手机弹了配对码但 Deck 没反应，说明 agent 没工作，点下面的按钮重启它再试。",
    "set.agentReady": "配对 agent 已就绪",
    "set.agentRunning": "配对 agent 运行中，但未确认注册",
    "set.agentDown": "配对 agent 未运行",
    "set.restartAgent": "重启 agent",
    "set.focus": "音频焦点",
    "set.focusHint": "决定「手机推流」和「Deck 游戏声音」怎么共存。不会改写你的系统默认输出。",
    "set.focusCoexist": "与游戏共存",
    "set.focusCoexistDesc": "两者都出声，互不抢占（推荐）",
    "set.focusReceiver": "接收端优先",
    "set.focusReceiverDesc": "优先保证手机推流音质，关闭自动切通话模式",
    "set.focusManual": "手动",
    "set.focusManualDesc": "插件不插手，完全自己用系统音量面板调",
    "set.codec": "音质（编码器）",
    "set.codecHint": "蓝牙音质主要由编码器决定。SBC-XQ 是普通 SBC 的高质量变体，码率从 328 提到约 452 kbps，兼容性几乎无损失，是最划算的提升。",
    "set.codecCurrent": "当前实际编码器：{codec}",
    "set.codecReconnect": "改完编码器后，需要在手机上断开重连一次才会重新协商。",
    "set.stutter": "卡顿 / 音质",
    "set.stutterWifi": "检测到 2.4GHz Wi-Fi 干扰",
    "set.stutterWifiBody": "蓝牙与 2.4GHz Wi-Fi 共用同一个射频，这是音频卡顿的头号原因。把 Wi-Fi 切到 5GHz 通常能立刻解决。",
    "set.stutterOk": "Wi-Fi 在 5GHz 或未连接，与蓝牙不冲突。",
    "set.fixStutter": "一键抗卡顿",
    "set.diagStutter": "诊断卡顿",
    "set.stutterHint": "「一键抗卡顿」会把延迟档位切到抗卡顿（加大缓冲）并把音量拉到 100%。",
    "set.latencyHint": "蓝牙 A2DP 的延迟取决于编码器与缓冲。这里是「省电 / 低延迟 / 抗卡顿」的取舍。",
    "set.outputsNow": "当前输出设备：",
    "set.avdtpLimit": "⚠️ 反方向做不到：受 AVDTP 协议限制（v1.3 §5.3），同一适配器同一时刻只能有一个蓝牙 A2DP 源设备连进来。",
    "set.codecInfo": "编码器",
    "set.codecActive": "当前编码",
    "set.codecRole": "方向",
    "set.defaultOutput": "默认输出",
    "set.power": "省电",
    "set.powerHint": "手机放完歌常忘了断开，A2DP 链路会一直占着蓝牙射频。这里可以自动收尾。",
    "set.silence": "静音多久后自动断开",
    "set.silenceOff": "关闭",
    "set.silenceRemain": "（还有 {n} 秒）",
    "set.normalize": "音量归一化",
    "set.normalizeHint": "手机切歌时音量忽大忽小很常见。这里记录一个基线，跳变超过 25% 会提示。当前基线：{base}",
    "set.normJumps": "已检测到 {n} 次跳变",
    "set.normUnset": "未设置",
    "set.setBaseline": "以当前音量为准",
    "set.resetBaseline": "重置",
    "set.behavior": "行为",
    "set.autoStart": "插件加载时自动进入可被发现",
    "set.autoStartDesc": "打开 Decky 后自动开好蓝牙，省得每次手动点",
    "set.keepAlive": "保持可被发现",
    "set.keepAliveDesc": "BlueZ 默认 180 秒后自动隐藏，这里每分钟复查一次",
    "set.resume": "睡眠唤醒后自动恢复",
    "set.resumeDescOn": "已监听（{backend}）：唤醒后自动恢复可发现并重连上次的设备",
    "set.resumeDescOff": "监听 logind 的睡眠信号，唤醒后自动恢复蓝牙状态（合盖再开盖不会失联）",
    "set.resumeEvents": "已捕获 {n} 次睡眠/唤醒事件，最近一次：{last}",
    "set.lastDevice": "上次设备 {mac}",
    "set.sysinfo": "系统信息",
    "eq.presets": "预设",
    "eq.hint": "用 PipeWire 内置的 param_eq（不依赖任何外部插件）。切换会重启 PipeWire，可能有一两秒静音。",
    "eq.bands": "{n} 段",
    "eq.custom": "自定义（AutoEQ 导入）",
    "eq.customActive": "当前正在使用导入的曲线",
    "eq.active": "生效中",
    "eq.import": "导入 AutoEQ / Squiglink 曲线",
    "eq.importHint": "从 AutoEq 或 squig.link 复制 ParametricEQ.txt 的内容粘进来。格式形如 `Filter 1: ON PK Fc 21 Hz Gain 6.7 dB Q 1.100`。",
    "eq.configPath": "配置文件：",
    "eq.paste": "粘贴曲线…",
    "eq.collapse": "收起",
    "eq.removeEq": "完全移除 EQ",
    "eq.applyImport": "导入并应用",
    "eq.importing": "导入中…",
    "eq.applied": "均衡器已切换",
    "eq.appliedBody": "PipeWire 已重启，可能有一两秒静音",
    "eq.imported": "已导入 {n} 段 EQ",
    "eq.skipped": "跳过 {n} 行无法识别",
    "diag.checks": "自检",
    "diag.modules": "后端模块",
    "diag.tools": "命令可用性",
    "diag.adapterRaw": "适配器原始信息",
    "diag.wpStatus": "音频状态",
    "diag.report": "完整报告",
    "diag.copy": "复制诊断报告",
    "diag.copied": "诊断报告已复制",
    "diag.copiedBody": "直接粘贴给作者即可",
    "diag.generated": "报告已生成",
    "diag.generatedBody": "下面可手动选中复制",
    "diag.viewLog": "查看日志",
    "diag.pluginLog": "插件日志",
    "diag.agent": "配对 agent",
    // 自检项
    "chk.bluetoothctl": "bluetoothctl 可用",
    "chk.busctl": "busctl 可用",
    "chk.wpctl": "wpctl 可用",
    "chk.adapter": "检测到蓝牙适配器",
    "chk.a2dpSink": "适配器支持 A2DP Sink",
    "chk.powered": "蓝牙已上电",
    "chk.agent": "配对 agent 在运行",
    "chk.discoverable": "可被发现",
    "chk.pipewireSink": "PipeWire 有音频输出",
    "chk.pwVersion": "PipeWire 版本可读",
    "chk.wpVersion": "WirePlumber 版本可读",
    "chk.modules": "后端模块全部加载",
    "chk.inhibit": "systemd-inhibit 可用（息屏时保持蓝牙不断）",
    "toast.failed": "操作失败",
    "toast.saveFailed": "保存失败",
    "toast.switchFailed": "切换失败",
    "toast.nameChanged": "设备名已改为 {name}",
    "toast.renameFailed": "改名失败",
};
const DICTS = { en: EN, zh: ZH };
/** 把各种语言标识归一化成我们支持的两种。 */
function normalizeLang(raw) {
    const s = (raw || "").toLowerCase().trim();
    if (!s)
        return "en";
    // Steam 用的是 schinese / tchinese，浏览器是 zh-CN / zh-TW
    if (s.includes("schinese") || s.includes("tchinese") || s.startsWith("zh"))
        return "zh";
    return "en";
}
/** 探测当前语言。 */
function detectLang() {
    // 1. Steam 客户端语言（最准）
    try {
        const sc = globalThis.SteamClient;
        const v = sc?.Settings?.GetLanguage?.();
        if (typeof v === "string" && v)
            return normalizeLang(v);
    }
    catch {
        /* ignore */
    }
    // 2. 浏览器 / CEF 语言
    try {
        const nav = globalThis.navigator;
        const v = nav?.language || nav?.languages?.[0];
        if (typeof v === "string" && v)
            return normalizeLang(v);
    }
    catch {
        /* ignore */
    }
    // 3. 兜底
    return "en";
}
let _lang = null;
function getLang() {
    if (_lang === null)
        _lang = detectLang();
    return _lang;
}
/**
 * 取翻译。支持 `{name}` 占位符。
 *
 * 用法：t("qam.connectedCount", { n: 2 })
 */
function t(key, vars) {
    const lang = getLang();
    const dict = DICTS[lang] || EN;
    let s = dict[key];
    // 缺翻译时回退英文，再回退 key 本身（方便发现漏翻）
    if (s === undefined)
        s = EN[key];
    if (s === undefined)
        return key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            s = s.split("{" + k + "}").join(String(v));
        }
    }
    return s;
}

/**
 * 息屏状态的共享单例。
 *
 * 为什么要单独抽出来？
 * ------------------
 * 息屏遮罩现在挂在**全局组件**上（`routerHook.addGlobalComponent`），
 * 而不是 QAM 面板内部 —— 因为 QAM 面板的 DOM 被 Steam 的容器包着，
 * 还可能带 `transform`，会让 `position: fixed` 失效、也盖不住顶栏。
 *
 * 于是「QAM 里的按钮」和「全局遮罩」成了两个互不相邻的组件，
 * 需要一个共享状态来通信。用极小的观察者模式即可，不引入任何依赖。
 */
let _dimmed = false;
const _listeners = new Set();
function setDimmed(v) {
    if (_dimmed === v)
        return;
    _dimmed = v;
    _listeners.forEach((f) => {
        try {
            f(v);
        }
        catch {
            /* 单个订阅者出错不影响其他人 */
        }
    });
}
function subscribeDim(f) {
    _listeners.add(f);
    // 立即同步一次当前值，避免挂载时机差异导致状态不一致
    try {
        f(_dimmed);
    }
    catch {
        /* ignore */
    }
    return () => {
        _listeners.delete(f);
    };
}

/**
 * 版本号与构建标识 —— 用来一眼确认「当前跑的到底是哪一版」。
 *
 * 为什么需要这个？
 * --------------
 * 排查「装了新版但还是报旧错误」时，最需要的是**确认当前运行的是哪一版**。
 * 之前只能靠猜（看截图时间、看界面有没有新功能），效率极低，
 * 还容易把「CEF 缓存了旧 index.js」误判成「代码没修好」。
 *
 * 现在 QAM 面板底部会显示 `v2.8.2 · 11-27 22:15`，一眼就能对上。
 *
 * 实现方式
 * --------
 * `__BT_META__` 是一个**普通全局对象**，由 `rollup.config.js` 里的自定义
 * 插件在 `intro` 阶段注入（在模块代码之前执行）：
 *
 *     var __BT_META__ = {"version":"2.8.2","build":"11-27 22:15"};
 *
 * 为什么不用标识符替换（`__BT_VERSION__` 这种）？
 * ----------------------------------------------
 * 我第一版就是那么写的，结果替换插件把**字符串字面量**里的
 * `"__BT_VERSION__"` 也替换了，生成出 `name === ""2.8.2""` 这种非法语法，
 * 构建直接失败。字符串替换天然分不清「标识符」和「字符串内容」，
 * 而注入一个对象则完全没有这个问题。
 *
 * ⚠️ v2.8.0 事故的教训同样适用：任何构建期注入都可能缺失，
 * 所以这里所有取值都做了兜底，拿不到就返回空串，绝不让插件加载失败。
 */
/** 安全读取注入的元信息；缺失时返回空对象（不抛错）。 */
function meta() {
    try {
        const m = typeof __BT_META__ !== "undefined" ? __BT_META__ : undefined;
        if (m && typeof m === "object") {
            return {
                version: typeof m.version === "string" ? m.version : "",
                build: typeof m.build === "string" ? m.build : "",
            };
        }
    }
    catch {
        /* ReferenceError（未注入）或任何异常，都降级为空 */
    }
    return { version: "", build: "" };
}
/** 形如 `v2.8.2 · 11-27 22:15`；拿不到版本就只显示构建时间。 */
function versionLabel() {
    const { version, build } = meta();
    if (!version && !build)
        return "";
    if (!version)
        return build;
    return build ? `v${version} · ${build}` : `v${version}`;
}

/** 音量调节按钮：只发指令不读状态，因此不存在同步问题。 */
function VolBtn({ onClick, label }) {
    return (SP_JSX.jsx(DFL.Focusable, { onClick: onClick, onActivate: onClick, style: {
            flex: 1, minWidth: 0, padding: "9px 0", borderRadius: 9, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(255,255,255,0.07)", border: `1px solid ${COLORS.border}`,
            fontSize: 12.5, color: COLORS.text, whiteSpace: "nowrap",
        }, children: label }));
}
function Speaker() {
    const { state, error } = useSpeaker();
    const [busy, setBusy] = SP_REACT.useState(false);
    // 本地音量值：用户拖动后一直保留，直到「后端确认读到我们设的值」才交还
    const [vol, setVol] = SP_REACT.useState(null);
    const [dragging] = SP_REACT.useState(false);
    SP_REACT.useRef(null);
    const settleTimer = SP_REACT.useRef(null);
    // 外部音源音量：同样的确认式交还
    const [srcVol, setSrcVol] = SP_REACT.useState(null);
    const srcTimer = SP_REACT.useRef(null);
    // QAM 面板挂载即视为可见；卸载时通知 store 降频
    SP_REACT.useEffect(() => {
        setPanelVisible(true);
        return () => setPanelVisible(false);
    }, []);
    // ---- 息屏（当音箱时省电 / 防烧屏）--------------------------------------
    //
    // ⚠️ 遮罩不在这里渲染。它挂成**全局组件**（见 index.tsx），
    //    因为 QAM 面板的 DOM 被 Steam 容器包着、容器带 transform，
    //    会让 position:fixed 的包含块退化，盖不住顶栏。
    //    这里只负责「按按钮 → 调后端 → 更新共享状态」。
    const [dimmed, setDimmedState] = SP_REACT.useState(false);
    const dimTimer = SP_REACT.useRef(null);
    // 跟随共享状态（全局遮罩被输入唤醒时，按钮文案也要跟着变回来）
    SP_REACT.useEffect(() => subscribeDim((v) => setDimmedState(v)), []);
    // 组件卸载时一定恢复背光，避免留下黑屏
    SP_REACT.useEffect(() => () => {
        if (dimTimer.current)
            clearTimeout(dimTimer.current);
    }, []);
    const enterDim = async () => {
        try {
            const r = await api.dimScreen();
            // 先通知全局遮罩显示，再更新本地按钮状态
            setDimmed(true);
            setDimmedState(true);
            const secs = (r.max_seconds || 300) * 1000;
            if (dimTimer.current)
                clearTimeout(dimTimer.current);
            dimTimer.current = setTimeout(() => { exitDim(); }, secs);
            // ⚠️ 休眠抑制没拿到 = 息屏后蓝牙一定会断（系统会自己睡下去）。
            //    必须单独提示，否则用户只会看到「放一会儿歌就断了」的怪现象。
            if (r.inhibit && r.inhibit.ok === false) {
                toaster.toast({
                    title: t("qam.inhibitFailed"),
                    body: (r.inhibit.error || "") + " " + t("qam.inhibitFailedBody"),
                });
            }
        }
        catch (e) {
            toaster.toast({ title: t("qam.dimFailed"), body: errMsg(e) });
        }
    };
    const exitDim = async () => {
        if (dimTimer.current) {
            clearTimeout(dimTimer.current);
            dimTimer.current = null;
        }
        setDimmed(false);
        setDimmedState(false);
        try {
            await api.undimScreen();
        }
        catch { /* ignore */ }
    };
    const backendVol = state ? Math.round(state.volume.volume * 100) : 0;
    // ⚠️ 同步策略（真机反馈「音量调节没同步」的修复核心）
    // 之前是「松手后固定 3 秒交还」，但空闲时轮询间隔是 10 秒，
    // 3 秒时后端读到的还是旧值 -> 滑杆立刻跳回去。
    //
    // 现在改为「**确认式交还**」：只有当后端读到的值和我们设的值足够接近
    // （±2% 容差）时才交还控制权；否则继续用本地值，并给一个 15 秒上限兜底
    // （防止后端写入失败时滑杆永远卡在本地值）。
    SP_REACT.useEffect(() => {
        if (vol === null || dragging)
            return;
        const diff = Math.abs(backendVol - vol);
        if (diff <= 2) {
            // 后端已确认 -> 交还控制权
            setVol(null);
            if (settleTimer.current) {
                clearTimeout(settleTimer.current);
                settleTimer.current = null;
            }
        }
    }, [backendVol, vol, dragging]);
    // 兜底：15 秒还没确认就强制交还，避免永远卡住
    SP_REACT.useEffect(() => {
        if (vol === null || dragging)
            return;
        if (settleTimer.current)
            clearTimeout(settleTimer.current);
        settleTimer.current = setTimeout(() => {
            setVol(null);
            settleTimer.current = null;
        }, 15000);
        return () => {
            if (settleTimer.current) {
                clearTimeout(settleTimer.current);
                settleTimer.current = null;
            }
        };
    }, [vol, dragging]);
    // 外部源音量：后端读到的值和我们设的接近时才交还
    SP_REACT.useEffect(() => {
        if (srcVol === null)
            return;
        const backendSrc = Math.round((state?.live?.volume || 0) * 100);
        if (Math.abs(backendSrc - srcVol) <= 2) {
            setSrcVol(null);
            if (srcTimer.current) {
                clearTimeout(srcTimer.current);
                srcTimer.current = null;
            }
        }
    }, [state?.live?.volume, srcVol]);
    const ad = state?.adapter;
    const connected = state?.connected || [];
    const act = async (fn, okMsg) => {
        if (busy)
            return;
        setBusy(true);
        try {
            await fn();
            if (okMsg)
                toaster.toast({ title: okMsg, body: "" });
        }
        catch (e) {
            toaster.toast({ title: t("toast.failed"), body: errMsg(e) });
        }
        finally {
            setBusy(false);
        }
    };
    const toggleDiscoverable = async (on) => {
        await act(() => api.setDiscoverable(on), on ? t("qam.discoverable") : t("qam.notVisible"));
    };
    const toggleMute = () => {
        if (!state)
            return;
        act(() => api.setMute(!state.volume.muted), state.volume.muted ? t("common.ok") : t("common.ok"));
    };
    return (SP_JSX.jsxs(DFL.PanelSection, { children: [SP_JSX.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "2px 2px 8px" }, children: [SP_JSX.jsx("div", { style: {
                            width: 38, height: 38, borderRadius: 19, display: "flex", alignItems: "center", justifyContent: "center",
                            background: ad?.discoverable ? "rgba(76,154,255,0.18)" : "rgba(255,255,255,0.06)",
                            color: ad?.discoverable ? COLORS.accent : COLORS.dim, flexShrink: 0,
                        }, children: SP_JSX.jsx(FaBluetooth, { size: 17 }) }), SP_JSX.jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [SP_JSX.jsx("div", { style: { fontSize: 14, fontWeight: 600, color: COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: ad ? ad.alias : t("plugin.name") }), SP_JSX.jsxs("div", { style: { display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }, children: [ad?.powered ? SP_JSX.jsx(Pill, { tone: "ok", children: t("qam.btOn") }) : SP_JSX.jsx(Pill, { tone: "warn", children: t("qam.btOff") }), ad?.discoverable ? SP_JSX.jsx(Pill, { tone: "accent", children: t("qam.discoverable") }) : SP_JSX.jsx(Pill, { children: t("qam.notVisible") }), connected.length > 0 && SP_JSX.jsx(Pill, { tone: "ok", children: t("qam.connectedCount", { n: connected.length }) })] })] })] }), error && SP_JSX.jsx(ErrorText, { text: error }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ToggleField, { label: t("qam.allowDiscover"), description: ad?.discoverable ? t("qam.allowDiscoverDescOn") : t("qam.allowDiscoverDescOff"), checked: !!ad?.discoverable, disabled: busy || !ad?.powered, onChange: toggleDiscoverable }) }), ad && !ad.powered && (SP_JSX.jsxs(SP_JSX.Fragment, { children: [state?.rfkill?.found && (state.rfkill.soft || state.rfkill.hard) && (SP_JSX.jsx("div", { style: {
                            margin: "6px 0", padding: "9px 11px", borderRadius: 8, fontSize: 11.5, lineHeight: 1.6,
                            background: "rgba(236,65,65,0.10)", border: "1px solid rgba(236,65,65,0.28)",
                            color: "#ffb3b3",
                        }, children: state.rfkill.hard
                            ? t("qam.rfkillHard")
                            : t("qam.rfkillSoft") })), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", onClick: () => act(() => api.setPower(true), t("qam.btOn")), children: t("qam.turnOnBt") }) }), state?.rfkill?.soft && !state.rfkill.hard && (SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", onClick: () => act(() => api.unblockRfkill(), t("qam.unblockRfkill")), children: t("qam.unblockRfkill") }) }))] })), connected.length > 0 && (SP_JSX.jsx("div", { style: { margin: "6px 0 2px" }, children: connected.map((d) => (SP_JSX.jsxs("div", { style: {
                        display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", marginBottom: 6,
                        borderRadius: 9, background: "rgba(76,195,138,0.10)", border: "1px solid rgba(76,195,138,0.25)",
                    }, children: [SP_JSX.jsx("div", { style: { color: COLORS.ok, flexShrink: 0 }, children: (d.icon || "").includes("phone") ? SP_JSX.jsx(FaMobileAlt, { size: 15 }) : SP_JSX.jsx(FaLaptop, { size: 15 }) }), SP_JSX.jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [SP_JSX.jsx("div", { style: { fontSize: 13, color: COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: d.display || d.name }), SP_JSX.jsx("div", { style: { fontSize: 11, color: COLORS.dim, marginTop: 1 }, children: t("qam.playingLabel") })] }), SP_JSX.jsx(DFL.Focusable, { onClick: () => act(() => api.deviceAction(d.mac, "disconnect"), t("dev.disconnected") + " " + (d.display || d.name)), onActivate: () => act(() => api.deviceAction(d.mac, "disconnect"), t("dev.disconnected") + " " + (d.display || d.name)), style: { fontSize: 11.5, color: COLORS.sub, padding: "4px 9px", borderRadius: 7, background: "rgba(255,255,255,0.07)", cursor: "pointer", flexShrink: 0 }, children: t("qam.disconnect") })] }, d.mac))) })), connected.length > 0 && state?.a2dp && !state.a2dp.ready && (SP_JSX.jsxs("div", { style: {
                    margin: "6px 0 2px", padding: "9px 11px", borderRadius: 8, fontSize: 11.5,
                    lineHeight: 1.6, background: "rgba(76,154,255,0.10)",
                    border: "1px solid rgba(76,154,255,0.28)", color: "#a8c8ff",
                }, children: [SP_JSX.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 7 }, children: [SP_JSX.jsx("span", { style: {
                                    width: 6, height: 6, borderRadius: 3, background: COLORS.accent,
                                    animation: "pulse 1.2s ease-in-out infinite",
                                } }), t("qam.negotiating")] }), SP_JSX.jsx("div", { style: { marginTop: 5, color: COLORS.dim, fontSize: 11 }, children: t("qam.negotiatingHint") }), SP_JSX.jsx(DFL.Focusable, { onClick: () => act(async () => {
                            const r = await api.fixA2dp(connected[0]?.mac);
                            if (r.ok) {
                                toaster.toast({ title: t("qam.a2dpFixed"), body: r.profile || "" });
                            }
                            else {
                                toaster.toast({
                                    title: t("qam.a2dpFixFailed"),
                                    body: r.detail || r.reason || "",
                                });
                            }
                        }), onActivate: () => act(async () => {
                            const r = await api.fixA2dp(connected[0]?.mac);
                            if (r.ok) {
                                toaster.toast({ title: t("qam.a2dpFixed"), body: r.profile || "" });
                            }
                            else {
                                toaster.toast({
                                    title: t("qam.a2dpFixFailed"),
                                    body: r.detail || r.reason || "",
                                });
                            }
                        }), style: {
                            marginTop: 7, padding: "7px 11px", borderRadius: 7, cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: "rgba(76,154,255,0.18)", fontSize: 11.5, color: "#fff",
                        }, children: t("qam.a2dpForce") })] })), state?.live && (SP_JSX.jsxs("div", { style: {
                    margin: "8px 0 2px", padding: "10px 12px", borderRadius: 10,
                    background: "rgba(76,154,255,0.10)", border: "1px solid rgba(76,154,255,0.28)",
                }, children: [SP_JSX.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }, children: [SP_JSX.jsx("span", { style: {
                                    width: 7, height: 7, borderRadius: 4, background: COLORS.ok, flexShrink: 0,
                                    opacity: state.track?.status === "playing" ? 1 : 0.4,
                                } }), SP_JSX.jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [SP_JSX.jsx("div", { style: { fontSize: 12.5, color: COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: state.track?.title || t("qam.playing", { name: state.live.name }) }), state.track?.artist && (SP_JSX.jsxs("div", { style: { fontSize: 11, color: COLORS.sub, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: [state.track.artist, state.track.album ? ` · ${state.track.album}` : ""] }))] }), SP_JSX.jsx(Pill, { tone: "accent", children: state.track?.status_label || t("qam.externalSource") })] }), state.track && state.track.duration_ms > 0 && (SP_JSX.jsxs("div", { style: { fontSize: 10.5, color: COLORS.dim, marginBottom: 4 }, children: [state.track.position, " / ", state.track.duration] })), SP_JSX.jsxs(DFL.Focusable, { "flow-children": "row", style: { display: "flex", gap: 6, marginTop: 2 }, children: [SP_JSX.jsx(VolBtn, { onClick: () => act(() => api.stepSourceVolume(state.live.id, -10)), label: "\u221210%" }), SP_JSX.jsx(VolBtn, { onClick: () => act(() => api.setSourceMute(state.live.id, !state.live.muted)), label: state.live.muted ? t("qam.unmute") : t("qam.mute") }), SP_JSX.jsx(VolBtn, { onClick: () => act(() => api.stepSourceVolume(state.live.id, 10)), label: "+10%" })] })] })), SP_JSX.jsxs("div", { style: { width: "100%", marginTop: 8 }, children: [SP_JSX.jsxs("div", { style: {
                            display: "flex", alignItems: "center", gap: 6, padding: "0 2px", marginBottom: 6,
                            color: COLORS.sub, fontSize: 12,
                        }, children: [state?.volume.muted ? SP_JSX.jsx(FaVolumeMute, { size: 12 }) : SP_JSX.jsx(FaVolumeUp, { size: 12 }), SP_JSX.jsx("span", { children: t("qam.volume") }), SP_JSX.jsx("span", { style: { fontSize: 11, color: COLORS.dim, marginLeft: "auto" }, children: t("qam.volumeHint") })] }), SP_JSX.jsxs(DFL.Focusable, { "flow-children": "row", style: { display: "flex", gap: 8 }, children: [SP_JSX.jsx(VolBtn, { onClick: () => act(() => api.stepVolume(-10)), label: "\u221210%" }), SP_JSX.jsx(VolBtn, { onClick: () => act(() => api.stepVolume(-5)), label: "\u22125%" }), SP_JSX.jsx(VolBtn, { onClick: toggleMute, label: state?.volume.muted ? t("qam.unmute") : t("qam.mute") }), SP_JSX.jsx(VolBtn, { onClick: () => act(() => api.stepVolume(5)), label: "+5%" }), SP_JSX.jsx(VolBtn, { onClick: () => act(() => api.stepVolume(10)), label: "+10%" })] })] }), SP_JSX.jsxs("div", { style: { marginTop: 8 }, children: [SP_JSX.jsx("div", { style: { fontSize: 11.5, color: COLORS.dim, marginBottom: 6, padding: "0 2px" }, children: t("qam.boostHint") }), SP_JSX.jsxs(DFL.Focusable, { "flow-children": "row", style: { display: "flex", gap: 8 }, children: [SP_JSX.jsx(VolBtn, { onClick: () => act(() => api.boostVolume(1.0), t("qam.boosted100")), label: "100%" }), SP_JSX.jsx(VolBtn, { onClick: () => act(() => api.boostVolume(1.3), t("qam.boosted130")), label: "130%" }), SP_JSX.jsx(VolBtn, { onClick: () => act(() => api.boostVolume(1.5), t("qam.boosted150")), label: "150%" }), SP_JSX.jsx(VolBtn, { onClick: () => act(() => api.boostVolume(2.0), t("qam.boosted200")), label: "200%" })] })] }), connected.length === 0 && ad?.discoverable && (SP_JSX.jsx("div", { style: { fontSize: 11.5, color: COLORS.dim, margin: "4px 4px 0", lineHeight: 1.6 }, children: t("qam.hintFind", { alias: ad.alias }) })), state?.screen?.available && (SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsxs(DFL.Focusable, { onClick: enterDim, onActivate: enterDim, style: {
                            marginTop: 8, padding: "10px 12px", borderRadius: 9, cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            background: "rgba(255,255,255,0.06)", border: `1px solid ${COLORS.border}`,
                            fontSize: 12.5, color: COLORS.text,
                        }, children: [SP_JSX.jsx(FaMoon, { size: 11 }), " ", t("qam.dimScreen")] }), SP_JSX.jsx("div", { style: { fontSize: 11, color: COLORS.dim, margin: "5px 4px 0", lineHeight: 1.5 }, children: state.screen.inhibit_held
                            ? t("qam.dimKeepAwake")
                            : (state.screen.inhibit_available === false
                                ? t("qam.inhibitFailedBody")
                                : t("qam.dimScreenHint")) })] })), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", onClick: () => DFL.Navigation.Navigate(ROUTE), children: SP_JSX.jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }, children: [SP_JSX.jsx(FaCog, { size: 12 }), " ", t("qam.manage")] }) }) }), versionLabel() && (SP_JSX.jsx("div", { style: {
                    fontSize: 10, color: COLORS.dim, textAlign: "center",
                    marginTop: 6, letterSpacing: 0.3, userSelect: "text",
                }, children: versionLabel() }))] }));
}

function BtSpeakerPage() {
    const { state, error, refresh } = useSpeaker();
    const [tab, setTab] = SP_REACT.useState("devices");
    const [busyMac, setBusyMac] = SP_REACT.useState(null);
    const ad = state?.adapter;
    const paired = state?.paired || [];
    const connectedMacs = new Set((state?.connected || []).map((d) => d.mac));
    const act = async (mac, action, label) => {
        if (busyMac)
            return;
        setBusyMac(mac);
        try {
            if (action === "repair") {
                await api.repairDevice(mac);
            }
            else {
                await api.deviceAction(mac, action);
            }
            toaster.toast({ title: label, body: "" });
            setTimeout(refresh, 800);
        }
        catch (e) {
            toaster.toast({ title: t("toast.failed"), body: errMsg(e) });
        }
        finally {
            setBusyMac(null);
        }
    };
    return (
    // 外层：铺满屏幕，负责给 Steam 的顶栏 / 底栏让位。
    // Steam 游戏模式顶部有状态栏（电量/时间），底部有 A/B 按钮提示条，
    // 全屏路由页如果直接用 inset:0 会被两头遮住。
    // 用 padding 而非 margin，保证背景色仍然铺满整屏。
    SP_JSX.jsx("div", { style: {
            position: "absolute", inset: 0, background: COLORS.bg,
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 58px)",
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 62px)",
            paddingLeft: "calc(env(safe-area-inset-left, 0px) + 34px)",
            paddingRight: "calc(env(safe-area-inset-right, 0px) + 34px)",
            display: "flex", flexDirection: "column",
            boxSizing: "border-box",
        }, children: SP_JSX.jsxs("div", { style: {
                flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden",
                display: "flex", flexDirection: "column",
                // 给滚动到底时留一点余量，最后一项不至于贴边
                paddingBottom: 16,
            }, children: [SP_JSX.jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }, children: [SP_JSX.jsxs("div", { children: [SP_JSX.jsx("div", { style: { fontSize: 26, fontWeight: 700, color: COLORS.text }, children: t("page.title") }), SP_JSX.jsx("div", { style: { fontSize: 13, color: COLORS.sub, marginTop: 3 }, children: ad ? `${ad.alias} · ${ad.address || t("common.unknown")}` : t("page.readingAdapter") })] }), SP_JSX.jsxs("div", { style: { display: "flex", gap: 8 }, children: [ad?.powered ? SP_JSX.jsx(Pill, { tone: "ok", children: t("qam.btOn") }) : SP_JSX.jsx(Pill, { tone: "warn", children: t("qam.btOff") }), ad?.discoverable ? SP_JSX.jsx(Pill, { tone: "accent", children: t("qam.discoverable") }) : SP_JSX.jsx(Pill, { children: t("qam.notVisible") }), ad?.a2dp_sink ? SP_JSX.jsx(Pill, { tone: "ok", children: t("page.a2dpSink") }) : SP_JSX.jsx(Pill, { tone: "warn", children: t("page.noSink") })] })] }), error && SP_JSX.jsx(ErrorText, { text: error }), SP_JSX.jsx(DFL.Focusable, { "flow-children": "row", style: { display: "flex", gap: 10, margin: "14px 0 4px" }, children: [
                        ["devices", t("tab.devices")],
                        ["settings", t("tab.settings")],
                        ["eq", t("tab.eq")],
                        ["diag", t("tab.diag")],
                    ].map(([k, label]) => (SP_JSX.jsx(DFL.Focusable, { onActivate: () => setTab(k), onClick: () => setTab(k), style: {
                            padding: "7px 16px", borderRadius: 18, cursor: "pointer", fontSize: 13.5,
                            background: tab === k ? COLORS.accent : "rgba(255,255,255,0.06)",
                            color: tab === k ? "#fff" : COLORS.sub,
                        }, children: label }, k))) }), !state ? SP_JSX.jsx(Loading, {}) : (SP_JSX.jsxs(SP_JSX.Fragment, { children: [tab === "devices" && (SP_JSX.jsx(DevicesTab, { paired: paired, connectedMacs: connectedMacs, busyMac: busyMac, onAction: act, discoverable: !!ad?.discoverable, alias: ad?.alias || "" })), tab === "settings" && SP_JSX.jsx(SettingsTab, { state: state, refresh: refresh }), tab === "eq" && SP_JSX.jsx(EqTab, { state: state, refresh: refresh }), tab === "diag" && SP_JSX.jsx(DiagTab, {})] }))] }) }));
}
// ---------------------------------------------------------------------------
function DevicesTab({ paired, connectedMacs, busyMac, onAction, discoverable, alias, }) {
    // 「显示没有名称的设备」开关放在外层，同时作用于「已配对列表」和「扫描结果」。
    // 早期只作用于扫描结果，用户看到的「未知设备」其实来自已配对列表 —— 所以开关
    // 看起来没生效。现在两边共用同一个状态。
    const [showUnnamed, setShowUnnamed] = SP_REACT.useState(true);
    const shownPaired = showUnnamed ? paired : paired.filter((d) => d.has_real_name !== false);
    const hiddenPaired = paired.length - shownPaired.length;
    const unnamedToggle = (SP_JSX.jsx("div", { style: { marginTop: 10, marginBottom: 4 }, children: SP_JSX.jsx(ToggleRow, { label: t("dev.showUnnamed"), desc: t("dev.showUnnamedDesc"), checked: showUnnamed, onChange: setShowUnnamed }) }));
    if (!paired.length) {
        return (SP_JSX.jsxs("div", { style: { marginTop: 16 }, children: [SP_JSX.jsx(ScanPanel, { alias: alias, discoverable: discoverable, onPaired: () => onAction("", "connect", ""), showUnnamed: showUnnamed }), unnamedToggle, SP_JSX.jsx(Hint, { children: t("dev.noDevices") })] }));
    }
    return (SP_JSX.jsxs("div", { style: { marginTop: 16 }, children: [SP_JSX.jsx(ScanPanel, { alias: alias, discoverable: discoverable, onPaired: () => onAction("", "connect", ""), showUnnamed: showUnnamed }), unnamedToggle, SP_JSX.jsx(SectionTitle, { children: t("dev.pairedCount", { n: shownPaired.length }) }), !showUnnamed && hiddenPaired > 0 && (SP_JSX.jsx(Hint, { children: t("dev.hiddenPaired", { n: hiddenPaired }) })), SP_JSX.jsx(DFL.Focusable, { "flow-children": "column", children: shownPaired.map((d) => {
                    const connected = connectedMacs.has(d.mac);
                    const busy = busyMac === d.mac;
                    return (SP_JSX.jsxs("div", { style: {
                            display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", marginBottom: 8,
                            borderRadius: 11, background: "rgba(255,255,255,0.045)", border: `1px solid ${COLORS.border}`,
                        }, children: [SP_JSX.jsx(Avatar, { connected: connected, icon: d.icon }), SP_JSX.jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [SP_JSX.jsx("div", { style: { fontSize: 15, color: COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: devLabel(d) }), SP_JSX.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.dim, marginTop: 2, flexWrap: "wrap" }, children: [SP_JSX.jsx("span", { children: d.mac }), connected && SP_JSX.jsx(Pill, { tone: "ok", children: t("dev.connected") }), d.trusted === false && SP_JSX.jsx(Pill, { tone: "warn", children: t("dev.untrusted") }), d.blocked && SP_JSX.jsx(Pill, { tone: "warn", children: t("dev.blocked") }), d.has_real_name === false && (SP_JSX.jsxs("span", { style: { color: "#e0a800" }, children: ["\u00B7 ", t("dev.noName")] }))] })] }), SP_JSX.jsx(DFL.Focusable, { onClick: () => onAction(d.mac, connected ? "disconnect" : "connect", connected ? t("dev.disconnected") : t("dev.connectedToast", { name: devLabel(d) })), onActivate: () => onAction(d.mac, connected ? "disconnect" : "connect", connected ? t("dev.disconnected") : t("dev.connectedToast", { name: devLabel(d) })), style: {
                                    padding: "7px 16px", borderRadius: 18, fontSize: 13, cursor: busy ? "default" : "pointer",
                                    background: connected ? "rgba(255,255,255,0.08)" : COLORS.accent,
                                    color: connected ? COLORS.sub : "#fff", opacity: busy ? 0.5 : 1,
                                }, children: busy ? "…" : connected ? t("qam.disconnect") : t("dev.connect") }), SP_JSX.jsx(DFL.Focusable, { onClick: () => onAction(d.mac, d.trusted === false ? "trust" : "untrust", d.trusted === false ? t("dev.trustedOn") : t("dev.trustedOff")), onActivate: () => onAction(d.mac, d.trusted === false ? "trust" : "untrust", d.trusted === false ? t("dev.trustedOn") : t("dev.trustedOff")), style: {
                                    padding: "7px 14px", borderRadius: 18, fontSize: 13, cursor: "pointer",
                                    background: d.trusted === false ? "rgba(255,255,255,0.08)" : "rgba(76,195,138,0.16)",
                                    color: d.trusted === false ? COLORS.sub : COLORS.ok,
                                }, children: d.trusted === false ? t("dev.trust") : t("dev.untrust") }), SP_JSX.jsx(DFL.Focusable, { onClick: () => onAction(d.mac, "repair", t("dev.repairing")), onActivate: () => onAction(d.mac, "repair", t("dev.repairing")), style: {
                                    padding: "7px 14px", borderRadius: 18, fontSize: 13, cursor: "pointer",
                                    background: "rgba(76,154,255,0.16)", color: COLORS.accent,
                                }, children: t("dev.repair") }), SP_JSX.jsx(DFL.Focusable, { onClick: () => onAction(d.mac, "remove", t("dev.removed")), onActivate: () => onAction(d.mac, "remove", t("dev.removed")), style: {
                                    padding: "7px 14px", borderRadius: 18, fontSize: 13, cursor: "pointer",
                                    background: "rgba(236,65,65,0.14)", color: COLORS.accentWarm,
                                }, children: t("common.remove") })] }, d.mac));
                }) }), SP_JSX.jsxs(Hint, { children: [t("dev.hint"), SP_JSX.jsx("br", {}), SP_JSX.jsx("b", { style: { color: COLORS.sub }, children: t("dev.hintPair") })] })] }));
}
/** 设备显示名：无名设备用本地化的「未知设备 · XX:XX」而不是后端的裸 MAC 后缀。 */
function devLabel(d) {
    const disp = d.display || d.name || d.mac;
    if (d.has_real_name === false) {
        const tail = String(d.mac || "").slice(-5);
        return t("dev.unknownLabel", { mac: tail });
    }
    return disp;
}
// ---------------------------------------------------------------------------
// 扫描面板：流式扫描 + 可中途停止 + 信号强度 + 无名称设备开关
// ---------------------------------------------------------------------------
function ScanPanel({ alias, discoverable, onPaired, showUnnamed }) {
    const [scanning, setScanning] = SP_REACT.useState(false);
    const [devices, setDevices] = SP_REACT.useState([]);
    const [scanned, setScanned] = SP_REACT.useState(false);
    const [busyMac, setBusyMac] = SP_REACT.useState(null);
    const [elapsed, setElapsed] = SP_REACT.useState(0);
    const pollRef = SP_REACT.useRef(null);
    const tickRef = SP_REACT.useRef(null);
    // 扫描时每 2 秒拉一次结果，边扫边出
    const startScan = async () => {
        if (scanning)
            return;
        setScanning(true);
        setScanned(false);
        setDevices([]);
        setElapsed(0);
        try {
            await api.scanStart(20);
            // 计时器
            const started = Date.now();
            tickRef.current = setInterval(() => {
                setElapsed(Math.floor((Date.now() - started) / 1000));
            }, 500);
            // 轮询器
            pollRef.current = setInterval(async () => {
                try {
                    const r = await api.scanList();
                    setDevices(r.devices || []);
                }
                catch { /* ignore */ }
            }, 2000);
            // 首次立刻拉一次
            const r0 = await api.scanList();
            setDevices(r0.devices || []);
            // 20 秒后自动结束
            setTimeout(() => finishScan(), 20500);
        }
        catch (e) {
            toaster.toast({ title: t("toast.failed"), body: errMsg(e) });
            finishScan();
        }
    };
    const finishScan = async () => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
        if (tickRef.current) {
            clearInterval(tickRef.current);
            tickRef.current = null;
        }
        try {
            await api.scanStop();
        }
        catch { /* ignore */ }
        try {
            const r = await api.scanList();
            setDevices(r.devices || []);
        }
        catch { /* ignore */ }
        setScanning(false);
        setScanned(true);
    };
    // 卸载时清理定时器
    SP_REACT.useEffect(() => () => {
        if (pollRef.current)
            clearInterval(pollRef.current);
        if (tickRef.current)
            clearInterval(tickRef.current);
    }, []);
    const pair = async (mac, name, paired) => {
        if (busyMac)
            return;
        setBusyMac(mac);
        try {
            if (paired) {
                // 已配对过的设备：直接连接，不用重新配对
                await api.deviceAction(mac, "connect");
                toaster.toast({ title: t("dev.connectedToast", { name }), body: "" });
            }
            else {
                await api.pairDeviceFull(mac);
                toaster.toast({ title: t("dev.paired", { name }), body: "" });
            }
            setDevices((prev) => prev.filter((d) => d.mac !== mac));
            onPaired();
        }
        catch (e) {
            toaster.toast({
                title: paired ? t("dev.connectFailed") : t("dev.pairFailed"),
                body: errMsg(e),
            });
        }
        finally {
            setBusyMac(null);
        }
    };
    const shown = showUnnamed ? devices : devices.filter((d) => d.has_real_name !== false);
    const hiddenCount = devices.length - shown.length;
    return (SP_JSX.jsxs("div", { style: { marginBottom: 8 }, children: [SP_JSX.jsx(SectionTitle, { children: t("dev.search") }), SP_JSX.jsx(Hint, { children: discoverable ? t("dev.searchHint") : t("dev.searchHintWarn") }), SP_JSX.jsxs(DFL.Focusable, { "flow-children": "row", style: { display: "flex", gap: 10, marginTop: 8, alignItems: "center" }, children: [SP_JSX.jsx(DFL.Focusable, { onClick: scanning ? finishScan : startScan, onActivate: scanning ? finishScan : startScan, style: {
                            display: "inline-flex", alignItems: "center", gap: 8,
                            padding: "9px 18px", borderRadius: 18, cursor: "pointer",
                            background: scanning ? "rgba(236,65,65,0.16)" : COLORS.accent,
                            color: scanning ? COLORS.accentWarm : "#fff", fontSize: 13.5,
                        }, children: scanning
                            ? `${t("dev.stopScan")} · ${elapsed}s`
                            : t("dev.search") }), scanning && (SP_JSX.jsx("span", { style: { fontSize: 12, color: COLORS.dim }, children: t("dev.foundCount", { n: devices.length }) }))] }), !showUnnamed && hiddenCount > 0 && (SP_JSX.jsx(Hint, { children: t("dev.hiddenCount", { n: hiddenCount }) })), shown.length > 0 && (SP_JSX.jsx(DFL.Focusable, { "flow-children": "column", style: { marginTop: 12 }, children: shown.map((d) => {
                    const busy = busyMac === d.mac;
                    const isPhone = (d.icon || "").includes("phone");
                    const isComputer = (d.icon || "").includes("computer");
                    // 信号强度条（RSSI 通常 -100..-30，越高越好）
                    const rssi = typeof d.rssi === "number" ? d.rssi : null;
                    const bars = rssi === null ? 0 : Math.max(1, Math.min(4, Math.round((rssi + 100) / 17.5)));
                    return (SP_JSX.jsxs("div", { style: {
                            display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", marginBottom: 8,
                            borderRadius: 11, background: "rgba(255,255,255,0.045)", border: `1px solid ${COLORS.border}`,
                        }, children: [SP_JSX.jsx("div", { style: {
                                    width: 40, height: 40, borderRadius: 20, flexShrink: 0,
                                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                                    background: "rgba(255,255,255,0.06)", border: `1px solid ${COLORS.border}`,
                                }, children: isPhone ? "📱" : isComputer ? "💻" : "🔊" }), SP_JSX.jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [SP_JSX.jsx("div", { style: { fontSize: 15, color: COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: devLabel(d) }), SP_JSX.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.dim, marginTop: 2, flexWrap: "wrap" }, children: [SP_JSX.jsx("span", { children: d.mac }), rssi !== null && (SP_JSX.jsxs("span", { style: { display: "inline-flex", alignItems: "flex-end", gap: 1 }, children: [[1, 2, 3, 4].map((b) => (SP_JSX.jsx("span", { style: {
                                                            width: 3, height: 3 + b * 2, borderRadius: 1,
                                                            background: b <= bars ? COLORS.ok : "rgba(255,255,255,0.15)",
                                                        } }, b))), SP_JSX.jsxs("span", { style: { marginLeft: 3 }, children: [rssi, " dBm"] })] })), d.paired && SP_JSX.jsx(Pill, { tone: "accent", children: t("dev.pairedTag") }), d.connected && SP_JSX.jsx(Pill, { tone: "ok", children: t("dev.connected") }), d.has_real_name === false && (SP_JSX.jsxs("span", { style: { color: "#e0a800" }, children: ["\u00B7 ", t("dev.noName")] }))] })] }), SP_JSX.jsx(DFL.Focusable, { onClick: () => pair(d.mac, devLabel(d), !!d.paired), onActivate: () => pair(d.mac, devLabel(d), !!d.paired), style: {
                                    padding: "7px 18px", borderRadius: 18, fontSize: 13, flexShrink: 0,
                                    cursor: busy ? "default" : "pointer",
                                    background: busy ? "rgba(255,255,255,0.08)" : COLORS.accent,
                                    color: busy ? COLORS.sub : "#fff",
                                }, children: busy
                                    ? (d.paired ? t("dev.connecting") : t("dev.pairing"))
                                    : (d.paired ? t("dev.connect") : t("dev.pair")) })] }, d.mac));
                }) })), scanned && shown.length === 0 && (SP_JSX.jsx(Hint, { children: devices.length > 0 && !showUnnamed
                    ? t("dev.allHidden", { n: devices.length })
                    : t("dev.noneFound") }))] }));
}
// ---------------------------------------------------------------------------
function SettingsTab({ state, refresh }) {
    const [alias, setAlias] = SP_REACT.useState(state.adapter?.alias || "");
    const [busy, setBusy] = SP_REACT.useState(false);
    const s = state.settings || {};
    SP_REACT.useEffect(() => { setAlias(state.adapter?.alias || ""); }, [state.adapter?.alias]);
    const save = async (key, value, label) => {
        try {
            await api.setSetting(key, value);
            toaster.toast({ title: label, body: "" });
        }
        catch (e) {
            toaster.toast({ title: t("toast.saveFailed"), body: errMsg(e) });
        }
    };
    const changeFocus = async (mode) => {
        try {
            const r = await api.setFocusMode(mode);
            toaster.toast({
                title: t("set.focus"),
                body: r.applied && r.applied.length ? r.applied.join("、") : "",
            });
            refresh();
        }
        catch (e) {
            toaster.toast({ title: t("toast.switchFailed"), body: errMsg(e) });
        }
    };
    const setSilence = async (sec) => {
        try {
            await api.setSilenceTimeout(sec);
            refresh();
        }
        catch (e) {
            toaster.toast({ title: t("toast.saveFailed"), body: errMsg(e) });
        }
    };
    const applyAlias = async () => {
        const v = alias.trim();
        if (!v || busy)
            return;
        setBusy(true);
        try {
            await api.setAlias(v);
            toaster.toast({ title: t("toast.nameChanged", { name: v }), body: "" });
        }
        catch (e) {
            toaster.toast({ title: t("toast.renameFailed"), body: errMsg(e) });
        }
        finally {
            setBusy(false);
        }
    };
    return (SP_JSX.jsxs("div", { style: { marginTop: 16, maxWidth: 720 }, children: [SP_JSX.jsx(SectionTitle, { children: t("set.name") }), SP_JSX.jsx(Hint, { children: t("set.nameHint") }), SP_JSX.jsxs("div", { style: { display: "flex", gap: 10, marginTop: 8 }, children: [SP_JSX.jsx("input", { value: alias, onChange: (e) => setAlias(e.target.value), maxLength: 40, placeholder: "Steam Deck", style: {
                            flex: 1, padding: "10px 12px", borderRadius: 9, fontSize: 14,
                            background: "rgba(255,255,255,0.06)", border: `1px solid ${COLORS.border}`,
                            color: COLORS.text, outline: "none",
                        } }), SP_JSX.jsx(DFL.Focusable, { onClick: applyAlias, onActivate: applyAlias, style: {
                            padding: "10px 20px", borderRadius: 9, fontSize: 14, cursor: "pointer",
                            background: COLORS.accent, color: "#fff", opacity: busy ? 0.6 : 1,
                        }, children: busy ? t("common.saving") : t("common.save") })] }), SP_JSX.jsx(SectionTitle, { children: t("set.audioTuning") }), SP_JSX.jsx(ToggleRow, { label: t("set.audioTuningLabel"), desc: t("set.audioTuningDesc"), checked: !!state.tuning?.installed, onChange: async (v) => {
                    try {
                        if (v) {
                            await api.applyTuning();
                            toaster.toast({ title: t("set.tuningOn"), body: "" });
                        }
                        else {
                            await api.removeTuning();
                            toaster.toast({ title: t("set.tuningOff"), body: "" });
                        }
                        refresh();
                    }
                    catch (e) {
                        toaster.toast({ title: t("toast.failed"), body: errMsg(e) });
                    }
                } }), SP_JSX.jsx(Hint, { children: t("set.tuningHint", { path: state.tuning?.path || "~/.config/wireplumber/wireplumber.conf.d/50-bt-speaker.conf" }) }), SP_JSX.jsx(SectionTitle, { children: t("set.pairing") }), SP_JSX.jsx(Hint, { children: t("set.pairingHint") }), SP_JSX.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, marginTop: 8 }, children: [SP_JSX.jsx("div", { style: {
                            width: 8, height: 8, borderRadius: 4, flexShrink: 0,
                            background: state.agent_registered ? COLORS.ok : state.agent ? "#e0a800" : COLORS.accentWarm,
                        } }), SP_JSX.jsx("div", { style: { flex: 1, fontSize: 13, color: COLORS.text }, children: state.agent_registered
                            ? t("set.agentReady")
                            : state.agent
                                ? t("set.agentRunning")
                                : t("set.agentDown") }), SP_JSX.jsx(DFL.Focusable, { onClick: async () => {
                            try {
                                const r = await api.restartAgent();
                                toaster.toast({
                                    title: r.registered ? t("set.agentReady") : t("set.agentRunning"),
                                    body: "",
                                });
                                setTimeout(refresh, 800);
                            }
                            catch (e) {
                                toaster.toast({ title: t("toast.failed"), body: errMsg(e) });
                            }
                        }, onActivate: async () => {
                            try {
                                await api.restartAgent();
                                setTimeout(refresh, 800);
                            }
                            catch { /* ignore */ }
                        }, style: {
                            padding: "7px 14px", borderRadius: 16, fontSize: 12.5, cursor: "pointer",
                            background: "rgba(255,255,255,0.08)", color: COLORS.text, flexShrink: 0,
                        }, children: t("set.restartAgent") })] }), SP_JSX.jsx(SectionTitle, { children: t("set.codec") }), SP_JSX.jsx(Hint, { children: t("set.codecHint") }), SP_JSX.jsx(DFL.Focusable, { "flow-children": "column", style: { marginTop: 8 }, children: (state.quality?.presets || []).map((p) => {
                    const active = (s.codec_preset || "balanced") === p.key;
                    return (SP_JSX.jsxs(DFL.Focusable, { onClick: async () => {
                            try {
                                const r = await api.setCodecPreset(p.key);
                                toaster.toast({
                                    title: `${t("set.codec")}: ${p.label}`,
                                    body: r.active_profile ? `${t("set.codecCurrent", { codec: r.active_profile })}` : "",
                                });
                                setTimeout(refresh, 1500);
                            }
                            catch (e) {
                                toaster.toast({ title: t("toast.switchFailed"), body: errMsg(e) });
                            }
                        }, onActivate: async () => {
                            try {
                                await api.setCodecPreset(p.key);
                                setTimeout(refresh, 1500);
                            }
                            catch { /* ignore */ }
                        }, style: {
                            display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", marginBottom: 8,
                            borderRadius: 10, cursor: "pointer",
                            background: active ? "rgba(76,154,255,0.13)" : "rgba(255,255,255,0.045)",
                            border: `1px solid ${active ? "rgba(76,154,255,0.4)" : COLORS.border}`,
                        }, children: [SP_JSX.jsx("div", { style: {
                                    width: 16, height: 16, borderRadius: 8, flexShrink: 0,
                                    border: `2px solid ${active ? COLORS.accent : "rgba(255,255,255,0.25)"}`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                }, children: active && SP_JSX.jsx("div", { style: { width: 8, height: 8, borderRadius: 4, background: COLORS.accent } }) }), SP_JSX.jsxs("div", { style: { flex: 1 }, children: [SP_JSX.jsx("div", { style: { fontSize: 14, color: COLORS.text }, children: p.label }), SP_JSX.jsx("div", { style: { fontSize: 11.5, color: COLORS.dim, marginTop: 2 }, children: p.desc })] }), SP_JSX.jsxs(Pill, { children: ["resample ", p.resample] })] }, p.key));
                }) }), SP_JSX.jsxs(Hint, { children: [t("set.codecCurrent", { codec: state.quality?.active_profile || t("common.none") }), SP_JSX.jsx("span", { style: { color: COLORS.accent } }), SP_JSX.jsx("br", {}), t("set.codecReconnect")] }), SP_JSX.jsx(SectionTitle, { children: t("set.stutter") }), state.wifi && state.wifi.risk === "high" && (SP_JSX.jsxs("div", { style: {
                    margin: "6px 0 10px", padding: "10px 12px", borderRadius: 9, fontSize: 12, lineHeight: 1.7,
                    background: "rgba(236,65,65,0.10)", border: "1px solid rgba(236,65,65,0.28)",
                    color: "#ffb3b3", whiteSpace: "pre-wrap",
                }, children: [SP_JSX.jsxs("b", { children: ["\u26A0\uFE0F ", t("set.stutterWifi")] }), "\n", state.wifi.wifi_24g.map((w) => `${w.ssid || w.interface} (ch ${w.channel}, ${w.freq_mhz} MHz)`).join(" / "), "\n", t("set.stutterWifiBody")] })), state.wifi && state.wifi.risk === "none" && (SP_JSX.jsx(Hint, { children: t("set.stutterOk") })), SP_JSX.jsxs(DFL.Focusable, { "flow-children": "row", style: { display: "flex", gap: 10, marginTop: 8 }, children: [SP_JSX.jsx(DFL.Focusable, { onClick: async () => {
                            try {
                                const r = await api.fixStutter();
                                toaster.toast({
                                    title: t("set.fixStutter"),
                                    body: (r.applied || []).join("、"),
                                });
                                setTimeout(refresh, 1500);
                            }
                            catch (e) {
                                toaster.toast({ title: t("toast.failed"), body: errMsg(e) });
                            }
                        }, onActivate: async () => {
                            try {
                                await api.fixStutter();
                                setTimeout(refresh, 1500);
                            }
                            catch { /* ignore */ }
                        }, style: {
                            padding: "9px 18px", borderRadius: 18, cursor: "pointer", fontSize: 13,
                            background: COLORS.accent, color: "#fff",
                        }, children: t("set.fixStutter") }), SP_JSX.jsx(DFL.Focusable, { onClick: async () => {
                            try {
                                const r = await api.diagnoseStutter();
                                const lines = [];
                                if (r.too_slow?.count > 0) {
                                    lines.push(`client too slow x${r.too_slow.count}`);
                                }
                                else if (r.too_slow?.checked) {
                                    lines.push("no client too slow in log");
                                }
                                if (r.codec)
                                    lines.push(`${t("set.codecCurrent", { codec: r.codec })}`);
                                if (r.wifi?.advice)
                                    lines.push(r.wifi.advice);
                                toaster.toast({
                                    title: t("set.diagStutter"),
                                    body: lines.join("; ").slice(0, 300) || t("common.none"),
                                });
                            }
                            catch (e) {
                                toaster.toast({ title: t("toast.failed"), body: errMsg(e) });
                            }
                        }, onActivate: async () => {
                            try {
                                await api.diagnoseStutter();
                            }
                            catch { /* ignore */ }
                        }, style: {
                            padding: "9px 18px", borderRadius: 18, cursor: "pointer", fontSize: 13,
                            background: "rgba(255,255,255,0.08)", color: COLORS.text,
                        }, children: t("set.diagStutter") })] }), SP_JSX.jsx(Hint, { children: t("set.stutterHint") }), SP_JSX.jsx(SectionTitle, { children: t("set.focus") }), SP_JSX.jsx(Hint, { children: t("set.focusHint") }), SP_JSX.jsx(DFL.Focusable, { "flow-children": "column", style: { marginTop: 8 }, children: [
                    ["coexist", t("set.focusCoexist"), t("set.focusCoexistDesc")],
                    ["receiver_first", t("set.focusReceiver"), t("set.focusReceiverDesc")],
                    ["manual", t("set.focusManual"), t("set.focusManualDesc")],
                ].map(([mode, label, desc]) => {
                    const active = (s.focus_mode || "coexist") === mode;
                    return (SP_JSX.jsxs(DFL.Focusable, { onClick: () => changeFocus(mode), onActivate: () => changeFocus(mode), style: {
                            display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", marginBottom: 8,
                            borderRadius: 10, cursor: "pointer",
                            background: active ? "rgba(76,154,255,0.13)" : "rgba(255,255,255,0.045)",
                            border: `1px solid ${active ? "rgba(76,154,255,0.4)" : COLORS.border}`,
                        }, children: [SP_JSX.jsx("div", { style: {
                                    width: 16, height: 16, borderRadius: 8, flexShrink: 0,
                                    border: `2px solid ${active ? COLORS.accent : "rgba(255,255,255,0.25)"}`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                }, children: active && SP_JSX.jsx("div", { style: { width: 8, height: 8, borderRadius: 4, background: COLORS.accent } }) }), SP_JSX.jsxs("div", { style: { flex: 1 }, children: [SP_JSX.jsx("div", { style: { fontSize: 14, color: COLORS.text }, children: label }), SP_JSX.jsx("div", { style: { fontSize: 11.5, color: COLORS.dim, marginTop: 2 }, children: desc })] })] }, mode));
                }) }), SP_JSX.jsx(SectionTitle, { children: t("set.power") }), SP_JSX.jsx(Hint, { children: t("set.powerHint") }), SP_JSX.jsxs("div", { style: { marginTop: 8 }, children: [SP_JSX.jsxs("div", { style: { fontSize: 13.5, color: COLORS.text, marginBottom: 6 }, children: [t("set.silence"), state.silence?.enabled && state.silence.was_active && state.silence.remaining !== null
                                ? t("set.silenceRemain", { n: state.silence.remaining })
                                : ""] }), SP_JSX.jsx(DFL.SliderField, { value: s.silence_disconnect ?? 0, min: 0, max: 600, step: 30, showValue: false, onChange: (v) => { setSilence(v); } }), SP_JSX.jsxs("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 11.5, color: COLORS.dim }, children: [SP_JSX.jsx("span", { children: t("set.silenceOff") }), SP_JSX.jsx("span", { children: "5m" }), SP_JSX.jsx("span", { children: "10m" })] })] }), SP_JSX.jsx(SectionTitle, { children: t("set.normalize") }), SP_JSX.jsxs(Hint, { children: [t("set.normalizeHint", { base: state.normalize?.baseline != null ? Math.round(state.normalize.baseline * 100) + "%" : t("set.normUnset") }), state.normalize?.jumps ? t("set.normJumps", { n: state.normalize.jumps }) : ""] }), SP_JSX.jsxs(DFL.Focusable, { "flow-children": "row", style: { display: "flex", gap: 10, marginTop: 8 }, children: [SP_JSX.jsx(DFL.Focusable, { onClick: async () => {
                            try {
                                await api.setVolumeBaseline(state.live?.volume ?? state.volume.volume);
                                toaster.toast({ title: t("set.setBaseline"), body: "" });
                                refresh();
                            }
                            catch (e) {
                                toaster.toast({ title: t("toast.saveFailed"), body: errMsg(e) });
                            }
                        }, onActivate: async () => {
                            try {
                                await api.setVolumeBaseline(state.live?.volume ?? state.volume.volume);
                                refresh();
                            }
                            catch { /* ignore */ }
                        }, style: { padding: "8px 16px", borderRadius: 18, background: "rgba(255,255,255,0.08)", color: COLORS.text, fontSize: 13, cursor: "pointer" }, children: t("set.setBaseline") }), SP_JSX.jsx(DFL.Focusable, { onClick: async () => {
                            try {
                                await api.resetVolumeBaseline();
                                refresh();
                            }
                            catch { /* ignore */ }
                        }, onActivate: async () => {
                            try {
                                await api.resetVolumeBaseline();
                                refresh();
                            }
                            catch { /* ignore */ }
                        }, style: { padding: "8px 16px", borderRadius: 18, background: "rgba(255,255,255,0.08)", color: COLORS.sub, fontSize: 13, cursor: "pointer" }, children: t("set.resetBaseline") })] }), SP_JSX.jsx(SectionTitle, { children: t("set.behavior") }), SP_JSX.jsx(Hint, { children: t("set.latencyHint") }), SP_JSX.jsx(DFL.Focusable, { "flow-children": "row", style: { display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }, children: (state.output?.latency_profiles || []).map((p) => {
                    const active = (s.latency_profile || "balanced") === p.key;
                    return (SP_JSX.jsxs(DFL.Focusable, { onClick: async () => {
                            try {
                                await api.setLatencyProfile(p.key);
                                toaster.toast({ title: p.label, body: "" });
                                setTimeout(refresh, 1200);
                            }
                            catch (e) {
                                toaster.toast({ title: t("toast.switchFailed"), body: errMsg(e) });
                            }
                        }, onActivate: async () => {
                            try {
                                await api.setLatencyProfile(p.key);
                                setTimeout(refresh, 1200);
                            }
                            catch { /* ignore */ }
                        }, style: {
                            flex: "1 1 180px", padding: "11px 14px", borderRadius: 10, cursor: "pointer",
                            background: active ? "rgba(76,154,255,0.13)" : "rgba(255,255,255,0.045)",
                            border: `1px solid ${active ? "rgba(76,154,255,0.4)" : COLORS.border}`,
                        }, children: [SP_JSX.jsx("div", { style: { fontSize: 13.5, color: COLORS.text }, children: p.label }), SP_JSX.jsxs("div", { style: { fontSize: 11, color: COLORS.accent, marginTop: 2 }, children: ["~", p.latency_ms, "ms"] }), SP_JSX.jsx("div", { style: { fontSize: 11, color: COLORS.dim, marginTop: 3, lineHeight: 1.4 }, children: p.desc })] }, p.key));
                }) }), SP_JSX.jsx(SectionTitle, { children: t("set.sysinfo") }), SP_JSX.jsx(ToggleRow, { label: "Deck multi-output", desc: "Play to speakers + BT headset + wired headset at once.", checked: !!s.multi_output, onChange: async (v) => {
                    try {
                        await api.setMultiOutput(v);
                        toaster.toast({ title: v ? "multi-output on" : "multi-output off", body: "" });
                        setTimeout(refresh, 1500);
                    }
                    catch (e) {
                        toaster.toast({ title: t("toast.failed"), body: errMsg(e) });
                    }
                } }), SP_JSX.jsxs(Hint, { children: [t("set.outputsNow"), " ", (state.output?.sinks || []).map((k) => k.name).join(" · ") || t("common.reading"), SP_JSX.jsx("br", {}), t("set.avdtpLimit")] }), SP_JSX.jsx(SectionTitle, { children: t("set.codecInfo") }), SP_JSX.jsxs("div", { style: { fontSize: 13, color: COLORS.sub, lineHeight: 1.9 }, children: [SP_JSX.jsxs("div", { children: [t("set.codecActive"), ": ", state.codec?.codec || t("common.none")] }), SP_JSX.jsxs("div", { children: ["Profile\uFF1A", state.codec?.profile || "—"] }), SP_JSX.jsxs("div", { children: [t("set.codecRole"), ": ", state.codec?.role || "—"] })] }), SP_JSX.jsx(SectionTitle, { children: t("set.behavior") }), SP_JSX.jsx(ToggleRow, { label: t("set.autoStart"), desc: t("set.autoStartDesc"), checked: !!s.auto_start, onChange: (v) => save("auto_start", v, t("common.ok")) }), SP_JSX.jsx(ToggleRow, { label: t("set.keepAlive"), desc: t("set.keepAliveDesc"), checked: !!s.keep_alive, onChange: (v) => save("keep_alive", v, t("common.ok")) }), SP_JSX.jsx(ToggleRow, { label: t("set.resume"), desc: state.power?.watching
                    ? t("set.resumeDescOn", { backend: state.power.backend })
                    : t("set.resumeDescOff"), checked: !!s.resume_restore, onChange: (v) => save("resume_restore", v, t("common.ok")) }), state.power?.watching && (SP_JSX.jsxs(Hint, { children: [t("set.resumeEvents", { n: state.power.events, last: state.power.last ? (state.power.last[0] === "sleep" ? "sleep" : "resume") : "-" }), s.last_device ? t("set.lastDevice", { mac: s.last_device }) : ""] })), SP_JSX.jsx(SectionTitle, { children: t("set.sysinfo") }), SP_JSX.jsxs("div", { style: { fontSize: 13, color: COLORS.sub, lineHeight: 1.9 }, children: [SP_JSX.jsxs("div", { children: ["PipeWire\uFF1A", state.versions?.pipewire || t("common.unknown")] }), SP_JSX.jsxs("div", { children: ["WirePlumber\uFF1A", state.versions?.wireplumber || t("common.unknown")] }), SP_JSX.jsxs("div", { children: ["BlueZ\uFF1A", state.versions?.bluez || t("common.unknown")] }), SP_JSX.jsxs("div", { children: [t("set.defaultOutput"), ": ", state.sink || t("common.unknown")] })] })] }));
}
function ToggleRow({ label, desc, checked, onChange }) {
    return (SP_JSX.jsxs(DFL.Focusable, { onClick: () => onChange(!checked), onActivate: () => onChange(!checked), style: {
            display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", marginBottom: 8,
            borderRadius: 11, background: "rgba(255,255,255,0.045)", border: `1px solid ${COLORS.border}`,
            cursor: "pointer",
        }, children: [SP_JSX.jsxs("div", { style: { flex: 1 }, children: [SP_JSX.jsx("div", { style: { fontSize: 14.5, color: COLORS.text }, children: label }), SP_JSX.jsx("div", { style: { fontSize: 12, color: COLORS.dim, marginTop: 3, lineHeight: 1.5 }, children: desc })] }), SP_JSX.jsx("div", { style: {
                    width: 42, height: 24, borderRadius: 12, flexShrink: 0, position: "relative",
                    background: checked ? COLORS.accent : "rgba(255,255,255,0.14)", transition: "background .15s",
                }, children: SP_JSX.jsx("div", { style: {
                        position: "absolute", top: 3, left: checked ? 21 : 3, width: 18, height: 18, borderRadius: 9,
                        background: "#fff", transition: "left .15s",
                    } }) })] }));
}
// ---------------------------------------------------------------------------
function EqTab({ state, refresh }) {
    const [busy, setBusy] = SP_REACT.useState(null);
    const [importText, setImportText] = SP_REACT.useState("");
    const [showImport, setShowImport] = SP_REACT.useState(false);
    const presets = state.eq?.presets || [];
    const current = state.eq?.preset || "flat";
    const apply = async (key) => {
        if (busy)
            return;
        setBusy(key);
        try {
            await api.setEqPreset(key);
            toaster.toast({ title: t("eq.applied"), body: t("eq.appliedBody") });
            setTimeout(refresh, 1500);
        }
        catch (e) {
            toaster.toast({ title: t("toast.switchFailed"), body: errMsg(e) });
        }
        finally {
            setBusy(null);
        }
    };
    const doImport = async () => {
        if (!importText.trim())
            return;
        setBusy("import");
        try {
            const r = await api.importAutoeq(importText);
            toaster.toast({
                title: t("eq.imported", { n: r.bands }),
                body: r.skipped ? t("eq.skipped", { n: r.skipped }) : "",
            });
            setShowImport(false);
            setImportText("");
            setTimeout(refresh, 1500);
        }
        catch (e) {
            toaster.toast({ title: t("toast.failed"), body: errMsg(e) });
        }
        finally {
            setBusy(null);
        }
    };
    const box = {
        marginTop: 8, padding: 10, borderRadius: 9, width: "100%", minHeight: 120,
        fontSize: 12, color: COLORS.text, fontFamily: "monospace",
        background: "rgba(0,0,0,0.35)", border: `1px solid ${COLORS.border}`,
        outline: "none", resize: "vertical",
    };
    return (SP_JSX.jsxs("div", { style: { marginTop: 16, maxWidth: 760 }, children: [SP_JSX.jsx(SectionTitle, { children: t("eq.presets") }), SP_JSX.jsx(Hint, { children: t("eq.hint") }), SP_JSX.jsxs(DFL.Focusable, { "flow-children": "column", style: { marginTop: 10 }, children: [presets.map((p) => {
                        const active = current === p.key;
                        const isBusy = busy === p.key;
                        return (SP_JSX.jsxs(DFL.Focusable, { onClick: () => apply(p.key), onActivate: () => apply(p.key), style: {
                                display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", marginBottom: 8,
                                borderRadius: 11, cursor: "pointer",
                                background: active ? "rgba(76,154,255,0.13)" : "rgba(255,255,255,0.045)",
                                border: `1px solid ${active ? "rgba(76,154,255,0.4)" : COLORS.border}`,
                                opacity: isBusy ? 0.5 : 1,
                            }, children: [SP_JSX.jsx("div", { style: {
                                        width: 16, height: 16, borderRadius: 8, flexShrink: 0,
                                        border: `2px solid ${active ? COLORS.accent : "rgba(255,255,255,0.25)"}`,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                    }, children: active && SP_JSX.jsx("div", { style: { width: 8, height: 8, borderRadius: 4, background: COLORS.accent } }) }), SP_JSX.jsxs("div", { style: { flex: 1 }, children: [SP_JSX.jsxs("div", { style: { fontSize: 14.5, color: COLORS.text }, children: [p.label, isBusy ? " …" : ""] }), SP_JSX.jsx("div", { style: { fontSize: 11.5, color: COLORS.dim, marginTop: 3 }, children: p.desc })] }), p.bands > 0 && SP_JSX.jsx(Pill, { children: t("eq.bands", { n: p.bands }) })] }, p.key));
                    }), current === "custom" && (SP_JSX.jsxs(Card, { active: true, children: [SP_JSX.jsxs("div", { style: { flex: 1 }, children: [SP_JSX.jsx("div", { style: { fontSize: 14, color: COLORS.text }, children: t("eq.custom") }), SP_JSX.jsx("div", { style: { fontSize: 11.5, color: COLORS.dim, marginTop: 3 }, children: t("eq.customActive") })] }), SP_JSX.jsx(Pill, { tone: "accent", children: t("eq.active") })] }))] }), SP_JSX.jsx(SectionTitle, { children: t("eq.import") }), SP_JSX.jsx(Hint, { children: t("eq.importHint") }), SP_JSX.jsxs(DFL.Focusable, { "flow-children": "row", style: { display: "flex", gap: 10, marginTop: 8 }, children: [SP_JSX.jsx(DFL.Focusable, { onClick: () => setShowImport(!showImport), onActivate: () => setShowImport(!showImport), style: { padding: "8px 16px", borderRadius: 18, background: "rgba(255,255,255,0.08)", color: COLORS.text, fontSize: 13, cursor: "pointer" }, children: showImport ? t("eq.collapse") : t("eq.paste") }), state.eq?.installed && (SP_JSX.jsx(DFL.Focusable, { onClick: async () => {
                            try {
                                await api.removeEq();
                                toaster.toast({ title: t("eq.removeEq"), body: "" });
                                setTimeout(refresh, 1500);
                            }
                            catch (e) {
                                toaster.toast({ title: t("toast.failed"), body: errMsg(e) });
                            }
                        }, onActivate: async () => {
                            try {
                                await api.removeEq();
                                setTimeout(refresh, 1500);
                            }
                            catch { /* ignore */ }
                        }, style: { padding: "8px 16px", borderRadius: 18, background: "rgba(236,65,65,0.14)", color: COLORS.accentWarm, fontSize: 13, cursor: "pointer" }, children: t("eq.removeEq") }))] }), showImport && (SP_JSX.jsxs("div", { style: { marginTop: 10 }, children: [SP_JSX.jsx("textarea", { value: importText, onChange: (e) => setImportText(e.target.value), placeholder: "Preamp: -6.8 dB\nFilter 1: ON PK Fc 21 Hz Gain 6.7 dB Q 1.100\nFilter 2: ON LSC Fc 85 Hz Gain 6.9 dB Q 3.000", style: box }), SP_JSX.jsx(DFL.Focusable, { onClick: doImport, onActivate: doImport, style: {
                            display: "inline-block", marginTop: 8, padding: "9px 20px", borderRadius: 9,
                            background: COLORS.accent, color: "#fff", fontSize: 13.5, cursor: "pointer",
                            opacity: busy === "import" ? 0.5 : 1,
                        }, children: busy === "import" ? t("eq.importing") : t("eq.applyImport") })] })), SP_JSX.jsxs(Hint, { children: [t("eq.configPath"), " ", SP_JSX.jsx("span", { style: { color: COLORS.sub }, children: state.eq?.path || "~/.config/pipewire/pipewire.conf.d/60-bt-speaker-eq.conf" })] })] }));
}
// ---------------------------------------------------------------------------
function DiagTab() {
    const [data, setData] = SP_REACT.useState(null);
    const [log, setLog] = SP_REACT.useState(null);
    const [report, setReport] = SP_REACT.useState("");
    const [loading, setLoading] = SP_REACT.useState(false);
    const load = async () => {
        setLoading(true);
        try {
            setData(await api.diagnose());
        }
        catch (e) {
            toaster.toast({ title: t("toast.failed"), body: errMsg(e) });
        }
        finally {
            setLoading(false);
        }
    };
    const loadLog = async () => {
        try {
            setLog(await api.getLog(200));
        }
        catch (e) {
            toaster.toast({ title: t("toast.failed"), body: errMsg(e) });
        }
    };
    SP_REACT.useEffect(() => { load(); }, []);
    const box = {
        marginTop: 10, padding: 12, borderRadius: 9, background: "rgba(0,0,0,0.35)",
        fontSize: 11.5, color: COLORS.sub, fontFamily: "monospace", whiteSpace: "pre-wrap",
        maxHeight: 340, overflowY: "auto", lineHeight: 1.55, border: `1px solid ${COLORS.border}`,
    };
    return (SP_JSX.jsxs("div", { style: { marginTop: 16 }, children: [SP_JSX.jsxs(DFL.Focusable, { "flow-children": "row", style: { display: "flex", gap: 10 }, children: [SP_JSX.jsx(DFL.Focusable, { onClick: load, onActivate: load, style: { padding: "8px 16px", borderRadius: 18, background: "rgba(255,255,255,0.08)", color: COLORS.text, fontSize: 13, cursor: "pointer" }, children: loading ? t("common.reading") : t("common.retry") }), SP_JSX.jsx(DFL.Focusable, { onClick: loadLog, onActivate: loadLog, style: { padding: "8px 16px", borderRadius: 18, background: "rgba(255,255,255,0.08)", color: COLORS.text, fontSize: 13, cursor: "pointer" }, children: t("diag.viewLog") }), SP_JSX.jsx(DFL.Focusable, { onClick: async () => {
                            try {
                                const r = await api.report();
                                setReport(r.text);
                                try {
                                    await navigator.clipboard.writeText(r.text);
                                    toaster.toast({ title: t("diag.copied"), body: t("diag.copiedBody") });
                                }
                                catch {
                                    toaster.toast({ title: t("diag.generated"), body: t("diag.generatedBody") });
                                }
                            }
                            catch (e) {
                                toaster.toast({ title: t("toast.failed"), body: errMsg(e) });
                            }
                        }, onActivate: async () => {
                            try {
                                const r = await api.report();
                                setReport(r.text);
                            }
                            catch { /* ignore */ }
                        }, style: { padding: "8px 16px", borderRadius: 18, background: "rgba(76,154,255,0.18)", color: COLORS.accent, fontSize: 13, cursor: "pointer" }, children: t("diag.copy") })] }), report && (SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsx(SectionTitle, { children: t("diag.report") }), SP_JSX.jsx("div", { style: box, children: report })] })), data && (SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsx(SectionTitle, { children: t("diag.checks") }), SP_JSX.jsx(DFL.Focusable, { "flow-children": "column", style: { marginTop: 8 }, children: (data.checks || []).map((c, i) => (SP_JSX.jsxs("div", { style: {
                                display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", marginBottom: 6,
                                borderRadius: 8, fontSize: 13,
                                background: c.ok ? "rgba(76,195,138,0.07)" : "rgba(236,65,65,0.10)",
                                border: `1px solid ${c.ok ? "rgba(76,195,138,0.2)" : "rgba(236,65,65,0.3)"}`,
                            }, children: [SP_JSX.jsx("span", { style: { color: c.ok ? COLORS.ok : COLORS.accentWarm, flexShrink: 0 }, children: c.ok ? "✓" : "✕" }), SP_JSX.jsx("span", { style: { flex: 1, color: COLORS.text }, children: t(c.key) }), c.detail && SP_JSX.jsx("span", { style: { fontSize: 11, color: COLORS.dim }, children: c.detail })] }, i))) }), SP_JSX.jsx(SectionTitle, { children: t("diag.modules") }), SP_JSX.jsx("div", { style: { fontSize: 13, color: COLORS.sub, lineHeight: 1.9 }, children: Object.entries(data.modules || {}).map(([k, v]) => (SP_JSX.jsxs("div", { children: [v ? "✅" : "❌", " ", k, ".py"] }, k))) }), SP_JSX.jsx(SectionTitle, { children: t("diag.tools") }), SP_JSX.jsxs("div", { style: { fontSize: 13, color: COLORS.sub, lineHeight: 1.9 }, children: [Object.entries(data.tools || {}).map(([k, v]) => (SP_JSX.jsxs("div", { children: [v ? "✅" : "❌", " ", k] }, k))), SP_JSX.jsxs("div", { children: [data.agent ? "✅" : "❌", " ", t("diag.agent")] })] }), SP_JSX.jsx(SectionTitle, { children: t("diag.adapterRaw") }), SP_JSX.jsx("div", { style: box, children: data.adapter_raw || t("common.empty") }), SP_JSX.jsx(SectionTitle, { children: t("diag.wpStatus") }), SP_JSX.jsx("div", { style: box, children: data.wp_status || t("common.empty") })] })), log && (SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsx(SectionTitle, { right: SP_JSX.jsx("span", { style: { fontSize: 11, color: COLORS.dim }, children: log.path }), children: t("diag.pluginLog") }), SP_JSX.jsx("div", { style: box, children: log.text || t("common.empty") })] }))] }));
}

/**
 * 调用 Steam 内部的 UI 合成层级 hook —— 但**必须能在旧版 loader 上安全降级**。
 *
 * 为什么必须用这个？
 * ----------------
 * 息屏遮罩如果只靠 `position: fixed` + 高 z-index，**盖不住 Steam 的
 * 顶栏和 QAM 面板** —— 它们在自己的合成层里，层级比插件的 DOM 更高。
 * `createPortal` 到 document.body 也没用，因为问题不在 DOM 层级，
 * 而在 Steam 的 **compositing layer**（合成层）。
 *
 * Steam 内部有一个 composition state 机制：
 *   AddMinimumCompositionStateRequest / ChangeMinimumCompositionStateRequest
 *   / RemoveMinimumCompositionStateRequest
 * 调用它可以把内容提升到指定合成层（Overlay / Opaque 等）。
 *
 * ⚠️⚠️ 血泪教训（v2.8.2）
 * ----------------------
 * v2.8.0 里本文件是这样写的：
 *
 *     const resolvedHook = findVar(isUICompositionHook) ?? findModuleExport(...);
 *
 * 这行在**模块顶层**执行。而 `findVar` 是 `@decky/ui` **5.x** 才有的 API，
 * 旧版 loader 提供的 `DFL` 全局对象里根本没有这个函数 —— 于是插件一加载就：
 *
 *     TypeError: DFL.findVar is not a function
 *
 * 整个插件包直接挂掉，连 QAM 面板都打不开。
 *
 * 教训：
 *   1. **不要**在模块顶层调用任何来自宿主（loader / Steam）的可选 API
 *   2. 每次访问可选 API 都必须先 `typeof === "function"` 判断
 *   3. 找不到就必须**静默降级**，绝不能让插件加载失败
 *
 * 所以现在所有解析都是**惰性**的、包在 try/catch 里的、逐级降级的。
 * 找不到 hook 时遮罩依然工作（只是盖不住顶栏），功能不受影响。
 */

/** Steam 的合成层级。数值越大越靠上。 */
var UIComposition;
(function (UIComposition) {
    UIComposition[UIComposition["Hidden"] = 0] = "Hidden";
    UIComposition[UIComposition["Notification"] = 1] = "Notification";
    UIComposition[UIComposition["Overlay"] = 2] = "Overlay";
    UIComposition[UIComposition["Opaque"] = 3] = "Opaque";
    UIComposition[UIComposition["OverlayKeyboard"] = 4] = "OverlayKeyboard";
    UIComposition[UIComposition["OverlayQAM"] = 5] = "OverlayQAM";
    UIComposition[UIComposition["OverlayKeyboard1"] = 6] = "OverlayKeyboard1";
})(UIComposition || (UIComposition = {}));
/**
 * 靠特征识别 composition hook。
 *
 * 不能按名字找 —— 打包后函数名会被压缩。这里按**源码特征**匹配：
 * 函数体里同时出现三个 CompositionStateRequest 调用，且不含
 * `m_mapCompositionStateRequests`（那是另一个相似函数）。
 */
const isUICompositionHook = (candidate) => {
    if (typeof candidate !== "function")
        return false;
    try {
        const source = candidate.toString();
        return (source.includes("AddMinimumCompositionStateRequest") &&
            source.includes("ChangeMinimumCompositionStateRequest") &&
            source.includes("RemoveMinimumCompositionStateRequest") &&
            !source.includes("m_mapCompositionStateRequests"));
    }
    catch {
        return false;
    }
};
/**
 * 安全地取 `@decky/ui` 上的一个可选函数。
 *
 * `DeckyUI` 是 rollup 用 external-globals 映射到全局 `DFL` 的对象。
 * 旧版 loader 里这个对象存在（面板组件都在用），但**可能缺少新 API**，
 * 所以这里逐个 `typeof` 判断，绝不直接调用。
 */
function optionalFn(name) {
    try {
        const mod = DFL;
        if (!mod)
            return null;
        const fn = mod[name];
        return typeof fn === "function" ? fn : null;
    }
    catch {
        return null;
    }
}
/** 已解析结果缓存：`undefined` = 还没找过，`null` = 找过但没有。 */
let _resolved = undefined;
/**
 * 惰性解析 composition hook。
 *
 * 降级链（每一步都可能不存在，全部安全）：
 *   1. `findVar`          —— @decky/ui 5.x，最准
 *   2. `findModuleExport` —— 老版本 loader 也有
 *   3. `findModuleChild`  —— 更老（已废弃但仍可用）
 *   4. 都没有 → null，调用方静默降级
 */
function resolveHook() {
    if (_resolved !== undefined)
        return _resolved;
    const probes = [
        () => {
            const fn = optionalFn("findVar");
            return fn ? fn(isUICompositionHook) : undefined;
        },
        () => {
            const fn = optionalFn("findModuleExport");
            return fn ? fn(isUICompositionHook) : undefined;
        },
        () => {
            const fn = optionalFn("findModuleChild");
            return fn ? fn(isUICompositionHook) : undefined;
        },
    ];
    for (const probe of probes) {
        try {
            const found = probe();
            if (isUICompositionHook(found)) {
                _resolved = found;
                return found;
            }
        }
        catch {
            // 这个探测途径不可用（函数不存在 / 内部报错），继续下一个
            continue;
        }
    }
    _resolved = null;
    return null;
}
let warned = false;
/**
 * 把当前组件提升到指定合成层。
 *
 * ⚠️ 内部已做完整保护：hook 不存在、调用抛错，都只会**静默降级**，
 * 绝不会让插件加载失败。这是 v2.8.0 崩溃事故的修复点。
 */
function useUIComposition(composition) {
    const hook = resolveHook();
    if (!isUICompositionHook(hook)) {
        if (!warned) {
            warned = true;
            // 只警告一次，不刷屏。用 console.warn 而不是 error ——
            // 这是「旧版 loader 的正常降级」，不是错误。
            console.warn("[bt-speaker] Steam UI composition hook 不可用（loader 版本较旧？），" +
                "息屏遮罩将无法盖住顶栏，但息屏功能本身正常。");
        }
        return;
    }
    try {
        hook(composition, "bt-speaker");
    }
    catch (e) {
        if (!warned) {
            warned = true;
            console.warn("[bt-speaker] 调用 UI composition 失败，已降级", e);
        }
    }
}

/** SetCatchAllGamepadInput 的返回值形态不固定，统一成「释放函数」。 */
function buildReleaseHandle(handle) {
    if (typeof handle === "function")
        return handle;
    const h = handle;
    if (h && typeof h.Unregister === "function")
        return () => h.Unregister();
    if (h && typeof h.unregister === "function")
        return () => h.unregister();
    return null;
}
/** 唤醒时的回调（由 index.tsx 注入，用于调后端恢复背光）。 */
let _onWake = null;
function setWakeHandler(fn) {
    _onWake = fn;
}
function wake() {
    try {
        _onWake?.();
    }
    catch {
        /* ignore */
    }
}
function DimOverlay() {
    const [visible, setVisible] = SP_REACT.useState(false);
    const ref = SP_REACT.useRef(null);
    const releaseRef = SP_REACT.useRef(null);
    const visibleRef = SP_REACT.useRef(false);
    visibleRef.current = visible;
    // 订阅共享状态
    SP_REACT.useEffect(() => {
        return subscribeDim((v) => setVisible(v));
    }, []);
    // 提升到 Steam 的 Overlay 合成层（拿不到就静默降级）
    useUIComposition(UIComposition.Overlay);
    // 聚焦遮罩，让键盘事件能落到这里
    SP_REACT.useEffect(() => {
        if (!visible)
            return;
        try {
            ref.current?.focus();
        }
        catch {
            /* ignore */
        }
    }, [visible]);
    // DOM 事件（键盘 / 鼠标 / 触摸）
    SP_REACT.useEffect(() => {
        if (!visible)
            return;
        const onAny = () => wake();
        window.addEventListener("keydown", onAny, true);
        window.addEventListener("pointerdown", onAny, true);
        window.addEventListener("touchstart", onAny, true);
        window.addEventListener("wheel", onAny, true);
        return () => {
            window.removeEventListener("keydown", onAny, true);
            window.removeEventListener("pointerdown", onAny, true);
            window.removeEventListener("touchstart", onAny, true);
            window.removeEventListener("wheel", onAny, true);
        };
    }, [visible]);
    // 手柄事件（Steam 不走 DOM，必须走 NavigationManager）
    SP_REACT.useEffect(() => {
        if (!visible)
            return;
        let release = null;
        try {
            const navManager = window?.SteamUIStore?.NavigationManager;
            if (navManager && typeof navManager.SetCatchAllGamepadInput === "function") {
                release = buildReleaseHandle(navManager.SetCatchAllGamepadInput(() => wake()));
            }
        }
        catch {
            /* 拿不到就只靠 DOM 事件兜着 */
        }
        releaseRef.current = release;
        return () => {
            releaseRef.current = null;
            try {
                release?.();
            }
            catch {
                /* ignore */
            }
        };
    }, [visible]);
    if (!visible)
        return null;
    return (SP_JSX.jsx("div", { ref: ref, tabIndex: 0, onPointerDown: wake, onKeyDown: wake, onClick: wake, onTouchStart: wake, style: {
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "#000",
            // z-index 是第二道保险；真正起作用的是 UIComposition + 全局组件挂载点
            zIndex: 2147483647,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.18)",
            fontSize: 13,
            cursor: "pointer",
            outline: "none",
            transform: "none",
            willChange: "auto",
            // 防止被祖先的 pointer-events / transform 影响
            pointerEvents: "auto",
            isolation: "isolate",
        }, children: SP_JSX.jsx("span", { style: { opacity: 0.001, userSelect: "none" }, children: "\u00B7" }) }));
}

const OVERLAY_KEY = "bt-speaker-dim-overlay";
var index = definePlugin(() => {
    try {
        routerHook.removeRoute(ROUTE);
    }
    catch { /* ignore */ }
    routerHook.addRoute(ROUTE, BtSpeakerPage);
    // 息屏遮罩挂成**全局组件**，而不是塞在 QAM 面板里。
    //
    // 为什么？QAM 面板的 DOM 被 Steam 的容器包着，容器还带 `transform`，
    // 会让 `position: fixed` 的包含块退化成那个容器 —— 结果就是
    // 「遮罩盖不住顶栏和 QAM 面板」。挂到全局 React 树里才不受祖先布局影响。
    // 参考：steam3d/MagicBlackDecky 的 routerHook.addGlobalComponent 用法。
    try {
        routerHook.removeGlobalComponent(OVERLAY_KEY);
    }
    catch { /* ignore */ }
    try {
        routerHook.addGlobalComponent(OVERLAY_KEY, () => SP_JSX.jsx(DimOverlay, {}));
    }
    catch { /* older loader may not expose this API; run without overlay */ }
    // 遮罩被任何输入唤醒时：通知后端恢复背光 + 释放休眠抑制锁。
    setWakeHandler(() => {
        setDimmed(false);
        api.undimScreen().catch(() => { });
    });
    return {
        // 名称跟随 Steam 界面语言：英文环境显示 "Bluetooth Speaker"，中文显示「蓝牙音箱」
        name: t("plugin.name"),
        icon: SP_JSX.jsx(FaBluetoothB, {}),
        content: SP_JSX.jsx(Speaker, {}),
        onDismount() {
            try {
                routerHook.removeRoute(ROUTE);
            }
            catch { /* ignore */ }
            try {
                routerHook.removeGlobalComponent(OVERLAY_KEY);
            }
            catch { /* ignore */ }
            setWakeHandler(null);
            stopPolling();
        },
    };
});

export { index as default };
//# sourceMappingURL=index.js.map
