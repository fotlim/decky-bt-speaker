const manifest = {"name":"蓝牙音箱"};
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
    scanDevices: (timeout = 20) => call("scan_devices", timeout),
    stopScan: () => call("stop_scan"),
    pairDeviceFull: (mac) => call("pair_device_full", mac),
    forgetDevice: (mac) => call("forget_device", mac),
    repairDevice: (mac) => call("repair_device", mac),
    setAlias: (alias) => call("set_alias", alias),
    deviceAction: (mac, action) => call("device_action", mac, action),
    setVolume: (v) => call("set_volume", v),
    setMute: (m) => call("set_mute", m),
    setSourceVolume: (nodeId, v) => call("set_source_volume", nodeId, v),
    setSourceMute: (nodeId, m) => call("set_source_mute", nodeId, m),
    boostVolume: (gain = 1.5) => call("boost_volume", gain),
    setAutoGain: (on) => call("set_auto_gain", on),
    setFocusMode: (mode) => call("set_focus_mode", mode),
    getAutoswitch: () => call("get_autoswitch"),
    setAutoswitch: (on) => call("set_autoswitch", on),
    setSilenceTimeout: (sec) => call("set_silence_timeout", sec),
    setVolumeBaseline: (v) => call("set_volume_baseline", v),
    resetVolumeBaseline: () => call("reset_volume_baseline"),
    setEqPreset: (preset) => call("set_eq_preset", preset),
    removeEq: () => call("remove_eq"),
    importAutoeq: (text) => call("import_autoeq", text),
    setLatencyProfile: (profile) => call("set_latency_profile", profile),
    setMultiOutput: (on) => call("set_multi_output", on),
    listOutputs: () => call("list_outputs"),
    setSetting: (key, value) => call("set_setting", key, value),
    applyTuning: () => call("apply_tuning"),
    removeTuning: () => call("remove_tuning"),
    diagnose: () => call("diagnose"),
    report: () => call("report"),
    getLog: (tail = 200) => call("get_log", tail),
};

/**
 * 状态单例：QAM 面板和全屏页共用一份轮询，
 * 避免两个界面同时开着时反复起子进程（后端每次 status 要跑几条系统命令）。
 */
let _state = null;
let _error = null;
let _loading = true;
let _subs = new Set();
let _timer = null;
let _inflight = null;
function emit() { _subs.forEach((f) => f()); }
async function refresh(force = false) {
    if (_inflight && !force)
        return _inflight;
    _inflight = (async () => {
        try {
            const r = await api.status();
            _state = r;
            _error = r.ok ? null : (r.error || "未知错误");
        }
        catch (e) {
            _error = e?.message || String(e);
        }
        finally {
            _loading = false;
            _inflight = null;
            emit();
        }
    })();
    return _inflight;
}
function startPolling(intervalMs = 4000) {
    if (_timer)
        return;
    refresh(true);
    _timer = setInterval(() => { refresh(); }, intervalMs);
}
function stopPolling() {
    if (_timer) {
        clearInterval(_timer);
        _timer = null;
    }
}
function useSpeaker() {
    const [, force] = SP_REACT.useState(0);
    SP_REACT.useEffect(() => {
        const f = () => force((n) => n + 1);
        _subs.add(f);
        startPolling();
        return () => {
            _subs.delete(f);
            // 注意：不在这里停轮询——QAM 收起时轮询继续，状态才不会「过期」
        };
    }, []);
    return { state: _state, error: _error, loading: _loading, refresh: () => { refresh(true); } };
}

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

function Speaker() {
    const { state, error } = useSpeaker();
    const [busy, setBusy] = SP_REACT.useState(false);
    const [vol, setVol] = SP_REACT.useState(null);
    // 拖动后 1.2s 内用自己的值，之后交还给后端轮询（避免轮询把滑块拽回去）
    const backendVol = state ? Math.round(state.volume.volume * 100) : 0;
    SP_REACT.useEffect(() => {
        if (vol === null)
            return;
        const t = setTimeout(() => setVol(null), 1200);
        return () => clearTimeout(t);
    }, [vol]);
    const ad = state?.adapter;
    const connected = state?.connected || [];
    const showVol = vol === null ? backendVol : vol;
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
            toaster.toast({ title: "操作失败", body: e?.message || String(e) });
        }
        finally {
            setBusy(false);
        }
    };
    const toggleDiscoverable = async (on) => {
        await act(() => api.setDiscoverable(on), on ? "已开启可被发现" : "已关闭可被发现");
    };
    const changeVolume = (v) => {
        setVol(v);
        api.setVolume(v / 100).catch(() => { });
    };
    const toggleMute = () => {
        if (!state)
            return;
        act(() => api.setMute(!state.volume.muted), state.volume.muted ? "已取消静音" : "已静音");
    };
    return (SP_JSX.jsxs(DFL.PanelSection, { children: [SP_JSX.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "2px 2px 8px" }, children: [SP_JSX.jsx("div", { style: {
                            width: 38, height: 38, borderRadius: 19, display: "flex", alignItems: "center", justifyContent: "center",
                            background: ad?.discoverable ? "rgba(76,154,255,0.18)" : "rgba(255,255,255,0.06)",
                            color: ad?.discoverable ? COLORS.accent : COLORS.dim, flexShrink: 0,
                        }, children: SP_JSX.jsx(FaBluetooth, { size: 17 }) }), SP_JSX.jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [SP_JSX.jsx("div", { style: { fontSize: 14, fontWeight: 600, color: COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: ad ? ad.alias : "蓝牙音箱" }), SP_JSX.jsxs("div", { style: { display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }, children: [ad?.powered ? SP_JSX.jsx(Pill, { tone: "ok", children: "\u84DD\u7259\u5DF2\u5F00" }) : SP_JSX.jsx(Pill, { tone: "warn", children: "\u84DD\u7259\u5DF2\u5173" }), ad?.discoverable ? SP_JSX.jsx(Pill, { tone: "accent", children: "\u53EF\u88AB\u53D1\u73B0" }) : SP_JSX.jsx(Pill, { children: "\u4E0D\u53EF\u89C1" }), connected.length > 0 && SP_JSX.jsxs(Pill, { tone: "ok", children: [connected.length, " \u53F0\u5DF2\u8FDE\u63A5"] })] })] })] }), error && SP_JSX.jsx(ErrorText, { text: error }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ToggleField, { label: "\u5141\u8BB8\u8BBE\u5907\u53D1\u73B0\u5E76\u8FDE\u63A5", description: ad?.discoverable ? "手机 / 电脑的蓝牙列表里能看到这台 Deck" : "打开后其它设备才能搜到", checked: !!ad?.discoverable, disabled: busy || !ad?.powered, onChange: toggleDiscoverable }) }), ad && !ad.powered && (SP_JSX.jsxs(SP_JSX.Fragment, { children: [state?.rfkill?.found && (state.rfkill.soft || state.rfkill.hard) && (SP_JSX.jsx("div", { style: {
                            margin: "6px 0", padding: "9px 11px", borderRadius: 8, fontSize: 11.5, lineHeight: 1.6,
                            background: "rgba(236,65,65,0.10)", border: "1px solid rgba(236,65,65,0.28)",
                            color: "#ffb3b3",
                        }, children: state.rfkill.hard
                            ? "蓝牙被硬件开关阻挡（Hard blocked），软件解不了，请重启 Deck。"
                            : "蓝牙被射频开关阻挡了（Soft blocked），这是打不开蓝牙最常见的原因。" })), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", onClick: () => act(() => api.setPower(true), "蓝牙已打开"), children: "\u6253\u5F00\u84DD\u7259" }) }), state?.rfkill?.soft && !state.rfkill.hard && (SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", onClick: () => act(() => api.unblockRfkill(), "已尝试解除阻挡"), children: "\u89E3\u9664\u5C04\u9891\u963B\u6321\uFF08\u9700\u8981 sudo\uFF09" }) }))] })), connected.length > 0 && (SP_JSX.jsx("div", { style: { margin: "6px 0 2px" }, children: connected.map((d) => (SP_JSX.jsxs("div", { style: {
                        display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", marginBottom: 6,
                        borderRadius: 9, background: "rgba(76,195,138,0.10)", border: "1px solid rgba(76,195,138,0.25)",
                    }, children: [SP_JSX.jsx("div", { style: { color: COLORS.ok, flexShrink: 0 }, children: (d.icon || "").includes("phone") ? SP_JSX.jsx(FaMobileAlt, { size: 15 }) : SP_JSX.jsx(FaLaptop, { size: 15 }) }), SP_JSX.jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [SP_JSX.jsx("div", { style: { fontSize: 13, color: COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: d.name }), SP_JSX.jsx("div", { style: { fontSize: 11, color: COLORS.dim, marginTop: 1 }, children: "\u6B63\u5728\u64AD\u653E" })] }), SP_JSX.jsx(DFL.Focusable, { onClick: () => act(() => api.deviceAction(d.mac, "disconnect"), "已断开 " + d.name), onActivate: () => act(() => api.deviceAction(d.mac, "disconnect"), "已断开 " + d.name), style: { fontSize: 11.5, color: COLORS.sub, padding: "4px 9px", borderRadius: 7, background: "rgba(255,255,255,0.07)", cursor: "pointer", flexShrink: 0 }, children: "\u65AD\u5F00" })] }, d.mac))) })), state?.live && (SP_JSX.jsxs("div", { style: {
                    margin: "8px 0 2px", padding: "10px 12px", borderRadius: 10,
                    background: "rgba(76,154,255,0.10)", border: "1px solid rgba(76,154,255,0.28)",
                }, children: [SP_JSX.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }, children: [SP_JSX.jsx("span", { style: {
                                    width: 7, height: 7, borderRadius: 4, background: COLORS.ok, flexShrink: 0,
                                    opacity: state.track?.status === "playing" ? 1 : 0.4,
                                } }), SP_JSX.jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [SP_JSX.jsx("div", { style: { fontSize: 12.5, color: COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: state.track?.title || `正在播放：${state.live.name}` }), state.track?.artist && (SP_JSX.jsxs("div", { style: { fontSize: 11, color: COLORS.sub, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: [state.track.artist, state.track.album ? ` · ${state.track.album}` : ""] }))] }), SP_JSX.jsx(Pill, { tone: "accent", children: state.track?.status_label || "外部音源" })] }), state.track && state.track.duration_ms > 0 && (SP_JSX.jsxs("div", { style: { fontSize: 10.5, color: COLORS.dim, marginBottom: 4 }, children: [state.track.position, " / ", state.track.duration] })), SP_JSX.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [SP_JSX.jsx(DFL.Focusable, { onClick: () => act(() => api.setSourceMute(state.live.id, !state.live.muted), state.live.muted ? "已取消静音" : "已静音外部音源"), onActivate: () => act(() => api.setSourceMute(state.live.id, !state.live.muted)), style: { cursor: "pointer", color: COLORS.sub, flexShrink: 0 }, children: state.live.muted ? SP_JSX.jsx(FaVolumeMute, { size: 12 }) : SP_JSX.jsx(FaVolumeUp, { size: 12 }) }), SP_JSX.jsx("div", { style: { flex: 1, minWidth: 0 }, children: SP_JSX.jsx(DFL.SliderField, { value: Math.round((state.live.volume || 0) * 100), min: 0, max: 150, step: 1, showValue: false, onChange: (v) => { api.setSourceVolume(state.live.id, v / 100).catch(() => { }); } }) })] })] })), SP_JSX.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 4, width: "100%" }, children: [SP_JSX.jsx(DFL.Focusable, { onClick: toggleMute, onActivate: toggleMute, style: { cursor: "pointer", color: COLORS.sub, flexShrink: 0 }, children: state?.volume.muted ? SP_JSX.jsx(FaVolumeMute, { size: 13 }) : SP_JSX.jsx(FaVolumeUp, { size: 13 }) }), SP_JSX.jsx("div", { style: { flex: 1, minWidth: 0 }, children: SP_JSX.jsx(DFL.SliderField, { value: showVol, min: 0, max: 150, step: 5, showValue: false, onChange: changeVolume }) })] }), SP_JSX.jsxs("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 10.5, color: COLORS.dim, marginTop: -2 }, children: [SP_JSX.jsx("span", { children: "0%" }), SP_JSX.jsxs("span", { style: { color: showVol > 100 ? COLORS.accentWarm : COLORS.dim }, children: [showVol, "%", showVol > 100 ? "（增益·可能破音）" : ""] }), SP_JSX.jsx("span", { children: "150%" })] }), showVol < 120 && (SP_JSX.jsxs(DFL.Focusable, { onClick: () => act(() => api.boostVolume(1.3), "已增益到 130%"), onActivate: () => act(() => api.boostVolume(1.3), "已增益到 130%"), style: {
                    marginTop: 8, padding: "9px 12px", borderRadius: 9, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    background: "rgba(76,154,255,0.12)", border: "1px solid rgba(76,154,255,0.28)",
                    fontSize: 12.5, color: COLORS.accent,
                }, children: [SP_JSX.jsx(FaVolumeUp, { size: 11 }), " \u58F0\u97F3\u592A\u5C0F\uFF1F\u589E\u5F3A\u5230 130%"] })), connected.length === 0 && ad?.discoverable && (SP_JSX.jsxs("div", { style: { fontSize: 11.5, color: COLORS.dim, margin: "4px 4px 0", lineHeight: 1.6 }, children: ["\u5728\u624B\u673A\u7684\u300C\u84DD\u7259\u300D\u91CC\u627E ", SP_JSX.jsx("b", { style: { color: COLORS.sub }, children: ad.alias }), "\uFF0C\u914D\u5BF9\u540E\u76F4\u63A5\u653E\u6B4C\u5373\u53EF\uFF5E"] })), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", onClick: () => DFL.Navigation.Navigate(ROUTE), children: SP_JSX.jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }, children: [SP_JSX.jsx(FaCog, { size: 12 }), " \u8BBE\u5907\u7BA1\u7406 / \u8BBE\u7F6E"] }) }) })] }));
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
            toaster.toast({ title: "操作失败", body: e?.message || String(e) });
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
            }, children: [SP_JSX.jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }, children: [SP_JSX.jsxs("div", { children: [SP_JSX.jsx("div", { style: { fontSize: 26, fontWeight: 700, color: COLORS.text }, children: "\u84DD\u7259\u97F3\u7BB1" }), SP_JSX.jsx("div", { style: { fontSize: 13, color: COLORS.sub, marginTop: 3 }, children: ad ? `${ad.alias} · ${ad.address || "未知地址"}` : "正在读取蓝牙适配器…" })] }), SP_JSX.jsxs("div", { style: { display: "flex", gap: 8 }, children: [ad?.powered ? SP_JSX.jsx(Pill, { tone: "ok", children: "\u84DD\u7259\u5DF2\u5F00" }) : SP_JSX.jsx(Pill, { tone: "warn", children: "\u84DD\u7259\u5DF2\u5173" }), ad?.discoverable ? SP_JSX.jsx(Pill, { tone: "accent", children: "\u53EF\u88AB\u53D1\u73B0" }) : SP_JSX.jsx(Pill, { children: "\u4E0D\u53EF\u89C1" }), ad?.a2dp_sink ? SP_JSX.jsx(Pill, { tone: "ok", children: "A2DP Sink" }) : SP_JSX.jsx(Pill, { tone: "warn", children: "\u65E0 Sink \u89D2\u8272" })] })] }), error && SP_JSX.jsx(ErrorText, { text: error }), SP_JSX.jsx(DFL.Focusable, { "flow-children": "row", style: { display: "flex", gap: 10, margin: "14px 0 4px" }, children: [
                        ["devices", "已配对设备"],
                        ["settings", "设置"],
                        ["eq", "均衡器"],
                        ["diag", "诊断"],
                    ].map(([k, label]) => (SP_JSX.jsx(DFL.Focusable, { onActivate: () => setTab(k), onClick: () => setTab(k), style: {
                            padding: "7px 16px", borderRadius: 18, cursor: "pointer", fontSize: 13.5,
                            background: tab === k ? COLORS.accent : "rgba(255,255,255,0.06)",
                            color: tab === k ? "#fff" : COLORS.sub,
                        }, children: label }, k))) }), !state ? SP_JSX.jsx(Loading, {}) : (SP_JSX.jsxs(SP_JSX.Fragment, { children: [tab === "devices" && (SP_JSX.jsx(DevicesTab, { paired: paired, connectedMacs: connectedMacs, busyMac: busyMac, onAction: act, discoverable: !!ad?.discoverable, alias: ad?.alias || "" })), tab === "settings" && SP_JSX.jsx(SettingsTab, { state: state, refresh: refresh }), tab === "eq" && SP_JSX.jsx(EqTab, { state: state, refresh: refresh }), tab === "diag" && SP_JSX.jsx(DiagTab, {})] }))] }) }));
}
// ---------------------------------------------------------------------------
function DevicesTab({ paired, connectedMacs, busyMac, onAction, discoverable, alias, }) {
    if (!paired.length) {
        return (SP_JSX.jsxs("div", { style: { marginTop: 16 }, children: [SP_JSX.jsx(ScanPanel, { alias: alias, discoverable: discoverable, onPaired: () => onAction("", "connect", "") }), SP_JSX.jsx(Hint, { children: "\u8FD8\u6CA1\u6709\u914D\u5BF9\u8FC7\u4EFB\u4F55\u8BBE\u5907\u3002\u7528\u4E0A\u9762\u7684\u300C\u641C\u7D22\u9644\u8FD1\u8BBE\u5907\u300D\u627E\u5230\u624B\u673A\u540E\u70B9\u300C\u914D\u5BF9\u300D\u5373\u53EF\uFF0C \u4E0D\u7528\u9000\u51FA\u63D2\u4EF6\u53BB\u7CFB\u7EDF\u84DD\u7259\u8BBE\u7F6E\u3002" })] }));
    }
    return (SP_JSX.jsxs("div", { style: { marginTop: 16 }, children: [SP_JSX.jsx(ScanPanel, { alias: alias, discoverable: discoverable, onPaired: () => onAction("", "connect", "") }), SP_JSX.jsxs(SectionTitle, { children: ["\u5DF2\u914D\u5BF9\uFF08", paired.length, "\uFF09"] }), SP_JSX.jsx(DFL.Focusable, { "flow-children": "column", children: paired.map((d) => {
                    const connected = connectedMacs.has(d.mac);
                    const busy = busyMac === d.mac;
                    return (SP_JSX.jsxs("div", { style: {
                            display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", marginBottom: 8,
                            borderRadius: 11, background: "rgba(255,255,255,0.045)", border: `1px solid ${COLORS.border}`,
                        }, children: [SP_JSX.jsx(Avatar, { connected: connected }), SP_JSX.jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [SP_JSX.jsx("div", { style: { fontSize: 15, color: COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: d.name }), SP_JSX.jsx("div", { style: { fontSize: 12, color: COLORS.dim, marginTop: 2 }, children: d.mac })] }), connected ? SP_JSX.jsx(Pill, { tone: "ok", children: "\u5DF2\u8FDE\u63A5" }) : SP_JSX.jsx(Pill, { children: "\u672A\u8FDE\u63A5" }), SP_JSX.jsx(DFL.Focusable, { onClick: () => onAction(d.mac, connected ? "disconnect" : "connect", connected ? "已断开" : "正在连接…"), onActivate: () => onAction(d.mac, connected ? "disconnect" : "connect", connected ? "已断开" : "正在连接…"), style: {
                                    padding: "7px 16px", borderRadius: 18, fontSize: 13, cursor: busy ? "default" : "pointer",
                                    background: connected ? "rgba(255,255,255,0.08)" : COLORS.accent,
                                    color: connected ? COLORS.sub : "#fff", opacity: busy ? 0.5 : 1,
                                }, children: busy ? "…" : connected ? "断开" : "连接" }), SP_JSX.jsx(DFL.Focusable, { onClick: () => onAction(d.mac, "repair", "正在修复配对…"), onActivate: () => onAction(d.mac, "repair", "正在修复配对…"), style: {
                                    padding: "7px 14px", borderRadius: 18, fontSize: 13, cursor: "pointer",
                                    background: "rgba(76,154,255,0.16)", color: COLORS.accent,
                                }, children: "\u4FEE\u590D\u914D\u5BF9" }), SP_JSX.jsx(DFL.Focusable, { onClick: () => onAction(d.mac, "remove", "已移除配对"), onActivate: () => onAction(d.mac, "remove", "已移除配对"), style: {
                                    padding: "7px 14px", borderRadius: 18, fontSize: 13, cursor: "pointer",
                                    background: "rgba(236,65,65,0.14)", color: COLORS.accentWarm,
                                }, children: "\u79FB\u9664" })] }, d.mac));
                }) }), SP_JSX.jsxs(Hint, { children: ["\u8FDE\u63A5\u6210\u529F\u540E\u5728\u624B\u673A\u4E0A\u64AD\u653E\u97F3\u4E50\uFF0C\u58F0\u97F3\u5C31\u4F1A\u4ECE Deck \u7684\u5587\u53ED\u51FA\u6765\u3002\u540C\u4E00\u65F6\u95F4\u53EA\u80FD\u6709\u4E00\u4E2A\u6E90\u5728\u653E\uFF08\u84DD\u7259 A2DP \u7684\u9650\u5236\uFF09\u3002", SP_JSX.jsx("br", {}), SP_JSX.jsx("b", { style: { color: COLORS.sub }, children: "\u914D\u5BF9\u7801 / \u901A\u884C\u5BC6\u94A5\u4E0D\u6B63\u786E\uFF1F" }), "\u70B9\u300C\u4FEE\u590D\u914D\u5BF9\u300D\u2014\u2014 \u5B83\u4F1A\u6E05\u9664 Deck \u7AEF\u4FDD\u5B58\u7684\u65E7\u7ED1\u5B9A\u5BC6\u94A5\u518D\u91CD\u65B0\u914D\u5BF9\u3002\u5982\u679C\u4ECD\u5931\u8D25\uFF0C\u8BF7\u5728\u624B\u673A\u7AEF\u4E5F\u300C\u5FD8\u8BB0\u300D\u8FD9\u4E2A\u8BBE\u5907\u540E\u91CD\u65B0\u641C\u7D22\u3002"] })] }));
}
// ---------------------------------------------------------------------------
// 扫描面板：在插件内完成「搜索 → 配对」，不用跳系统蓝牙设置
// ---------------------------------------------------------------------------
function ScanPanel({ alias, discoverable, onPaired }) {
    const [scanning, setScanning] = SP_REACT.useState(false);
    const [devices, setDevices] = SP_REACT.useState([]);
    const [scanned, setScanned] = SP_REACT.useState(false);
    const [busyMac, setBusyMac] = SP_REACT.useState(null);
    const scan = async () => {
        if (scanning)
            return;
        setScanning(true);
        setScanned(false);
        try {
            const r = await api.scanDevices(20);
            setDevices(r.devices || []);
            setScanned(true);
            if (!r.devices || !r.devices.length) {
                toaster.toast({
                    title: "没搜到设备",
                    body: "确认手机蓝牙已打开、并且在可被发现状态",
                });
            }
        }
        catch (e) {
            toaster.toast({ title: "搜索失败", body: e?.message || String(e) });
        }
        finally {
            setScanning(false);
        }
    };
    const pair = async (mac, name) => {
        if (busyMac)
            return;
        setBusyMac(mac);
        try {
            await api.pairDeviceFull(mac);
            toaster.toast({ title: `已配对 ${name}`, body: "" });
            setDevices((prev) => prev.filter((d) => d.mac !== mac));
            onPaired();
        }
        catch (e) {
            toaster.toast({ title: "配对失败", body: e?.message || String(e) });
        }
        finally {
            setBusyMac(null);
        }
    };
    return (SP_JSX.jsxs("div", { style: { marginBottom: 8 }, children: [SP_JSX.jsx(SectionTitle, { children: "\u641C\u7D22\u9644\u8FD1\u8BBE\u5907" }), SP_JSX.jsx(Hint, { children: discoverable
                    ? "扫描 20 秒，找到设备后点「配对」即可，不用去系统蓝牙设置。"
                    : "建议先在 QAM 里打开「允许设备发现并连接」，否则对方可能搜不到这台 Deck。" }), SP_JSX.jsx(DFL.Focusable, { onClick: scan, onActivate: scan, style: {
                    display: "inline-flex", alignItems: "center", gap: 8, marginTop: 8,
                    padding: "9px 18px", borderRadius: 18, cursor: scanning ? "default" : "pointer",
                    background: scanning ? "rgba(255,255,255,0.06)" : COLORS.accent,
                    color: scanning ? COLORS.sub : "#fff", fontSize: 13.5,
                }, children: scanning ? "正在搜索…（约 20 秒）" : "搜索附近设备" }), devices.length > 0 && (SP_JSX.jsx(DFL.Focusable, { "flow-children": "column", style: { marginTop: 12 }, children: devices.map((d) => {
                    const busy = busyMac === d.mac;
                    const isPhone = (d.icon || "").includes("phone");
                    const isComputer = (d.icon || "").includes("computer");
                    return (SP_JSX.jsxs("div", { style: {
                            display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", marginBottom: 8,
                            borderRadius: 11, background: "rgba(255,255,255,0.045)", border: `1px solid ${COLORS.border}`,
                        }, children: [SP_JSX.jsx("div", { style: {
                                    width: 40, height: 40, borderRadius: 20, flexShrink: 0,
                                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                                    background: "rgba(255,255,255,0.06)", border: `1px solid ${COLORS.border}`,
                                }, children: isPhone ? "📱" : isComputer ? "💻" : "🔊" }), SP_JSX.jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [SP_JSX.jsx("div", { style: { fontSize: 15, color: COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: d.name }), SP_JSX.jsx("div", { style: { fontSize: 12, color: COLORS.dim, marginTop: 2 }, children: d.mac })] }), SP_JSX.jsx(DFL.Focusable, { onClick: () => pair(d.mac, d.name), onActivate: () => pair(d.mac, d.name), style: {
                                    padding: "7px 18px", borderRadius: 18, fontSize: 13, flexShrink: 0,
                                    cursor: busy ? "default" : "pointer",
                                    background: busy ? "rgba(255,255,255,0.08)" : COLORS.accent,
                                    color: busy ? COLORS.sub : "#fff",
                                }, children: busy ? "配对中…" : "配对" })] }, d.mac));
                }) })), scanned && devices.length === 0 && (SP_JSX.jsx(Hint, { children: "\u6CA1\u641C\u5230\u672A\u914D\u5BF9\u7684\u8BBE\u5907\u3002\u53EF\u80FD\u662F\uFF1A\u624B\u673A\u5DF2\u7ECF\u914D\u8FC7\u8FD9\u53F0 Deck\uFF08\u53BB\u4E0B\u9762\u300C\u5DF2\u914D\u5BF9\u300D\u91CC\u770B\uFF09\u3001 \u6216\u624B\u673A\u84DD\u7259\u6CA1\u6253\u5F00\u3001\u6216\u5BF9\u65B9\u4E0D\u53EF\u88AB\u53D1\u73B0\u3002" }))] }));
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
            toaster.toast({ title: "保存失败", body: e?.message || String(e) });
        }
    };
    const changeFocus = async (mode) => {
        try {
            const r = await api.setFocusMode(mode);
            toaster.toast({
                title: "焦点模式已切换",
                body: r.applied && r.applied.length ? r.applied.join("、") : "",
            });
            refresh();
        }
        catch (e) {
            toaster.toast({ title: "切换失败", body: e?.message || String(e) });
        }
    };
    const setSilence = async (sec) => {
        try {
            await api.setSilenceTimeout(sec);
            refresh();
        }
        catch (e) {
            toaster.toast({ title: "设置失败", body: e?.message || String(e) });
        }
    };
    const applyAlias = async () => {
        const v = alias.trim();
        if (!v || busy)
            return;
        setBusy(true);
        try {
            await api.setAlias(v);
            toaster.toast({ title: "设备名已改为 " + v, body: "" });
        }
        catch (e) {
            toaster.toast({ title: "改名失败", body: e?.message || String(e) });
        }
        finally {
            setBusy(false);
        }
    };
    return (SP_JSX.jsxs("div", { style: { marginTop: 16, maxWidth: 720 }, children: [SP_JSX.jsx(SectionTitle, { children: "\u8BBE\u5907\u540D" }), SP_JSX.jsx(Hint, { children: "\u522B\u4EBA\u84DD\u7259\u5217\u8868\u91CC\u770B\u5230\u7684\u540D\u5B57\u3002\u5EFA\u8BAE\u6539\u6210\u4E00\u4E2A\u597D\u8BA4\u7684\u540D\u5B57\u3002" }), SP_JSX.jsxs("div", { style: { display: "flex", gap: 10, marginTop: 8 }, children: [SP_JSX.jsx("input", { value: alias, onChange: (e) => setAlias(e.target.value), maxLength: 40, placeholder: "Steam Deck", style: {
                            flex: 1, padding: "10px 12px", borderRadius: 9, fontSize: 14,
                            background: "rgba(255,255,255,0.06)", border: `1px solid ${COLORS.border}`,
                            color: COLORS.text, outline: "none",
                        } }), SP_JSX.jsx(DFL.Focusable, { onClick: applyAlias, onActivate: applyAlias, style: {
                            padding: "10px 20px", borderRadius: 9, fontSize: 14, cursor: "pointer",
                            background: COLORS.accent, color: "#fff", opacity: busy ? 0.6 : 1,
                        }, children: busy ? "保存中…" : "保存" })] }), SP_JSX.jsx(SectionTitle, { children: "\u97F3\u9891\u8C03\u4F18" }), SP_JSX.jsx(ToggleRow, { label: "\u542F\u7528\u300C\u97F3\u7BB1\u4F18\u5316\u300D\u914D\u7F6E", desc: "\u5199\u5165\u7528\u6237\u7EA7 WirePlumber \u914D\u7F6E\uFF1A\u53EA\u4FDD\u7559 A2DP \u89D2\u8272\u3001\u624B\u673A\u63A8\u6D41\u76F4\u51FA\u3001\u907F\u514D\u6389\u6210\u901A\u8BDD\u5355\u58F0\u9053\u3002\u6539\u5B8C\u4F1A\u81EA\u52A8\u91CD\u542F WirePlumber\u3002", checked: !!state.tuning?.installed, onChange: async (v) => {
                    try {
                        if (v) {
                            await api.applyTuning();
                            toaster.toast({ title: "已启用音箱优化", body: "WirePlumber 已重启" });
                        }
                        else {
                            await api.removeTuning();
                            toaster.toast({ title: "已恢复系统默认", body: "WirePlumber 已重启" });
                        }
                        refresh();
                    }
                    catch (e) {
                        toaster.toast({ title: "操作失败", body: e?.message || String(e) });
                    }
                } }), SP_JSX.jsxs(Hint, { children: ["\u914D\u7F6E\u6587\u4EF6\uFF1A", SP_JSX.jsx("span", { style: { color: COLORS.sub }, children: state.tuning?.path || "~/.config/wireplumber/wireplumber.conf.d/50-bt-speaker.conf" }), SP_JSX.jsx("br", {}), "\u8FDE\u4E0A\u4E86\u5374\u6CA1\u58F0\u97F3\u3001\u6216\u8005\u58F0\u97F3\u53D8\u6210\u5355\u58F0\u9053\u53D1\u95F7\u65F6\uFF0C\u6253\u5F00\u5B83\u518D\u91CD\u8FDE\u4E00\u6B21\u901A\u5E38\u5C31\u597D\u4E86\u3002"] }), SP_JSX.jsx(SectionTitle, { children: "\u914D\u5BF9" }), SP_JSX.jsx(Hint, { children: "\u914D\u5BF9 agent \u8D1F\u8D23\u5E94\u7B54\u624B\u673A\u7684\u914D\u5BF9\u8BF7\u6C42\u3002\u5982\u679C\u624B\u673A\u5F39\u4E86\u914D\u5BF9\u7801\u4F46 Deck \u6CA1\u53CD\u5E94\uFF0C \u8BF4\u660E agent \u6CA1\u5DE5\u4F5C\uFF0C\u70B9\u4E0B\u9762\u7684\u6309\u94AE\u91CD\u542F\u5B83\u518D\u8BD5\u3002" }), SP_JSX.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, marginTop: 8 }, children: [SP_JSX.jsx("div", { style: {
                            width: 8, height: 8, borderRadius: 4, flexShrink: 0,
                            background: state.agent_registered ? COLORS.ok : state.agent ? "#e0a800" : COLORS.accentWarm,
                        } }), SP_JSX.jsx("div", { style: { flex: 1, fontSize: 13, color: COLORS.text }, children: state.agent_registered
                            ? "配对 agent 已就绪"
                            : state.agent
                                ? "配对 agent 运行中，但未确认注册"
                                : "配对 agent 未运行" }), SP_JSX.jsx(DFL.Focusable, { onClick: async () => {
                            try {
                                const r = await api.restartAgent();
                                toaster.toast({
                                    title: r.registered ? "配对 agent 已重启并就绪" : "已重启，但未确认注册",
                                    body: r.registered ? "" : "配对时可能需要手动确认",
                                });
                                setTimeout(refresh, 800);
                            }
                            catch (e) {
                                toaster.toast({ title: "重启失败", body: e?.message || String(e) });
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
                        }, children: "\u91CD\u542F agent" })] }), SP_JSX.jsx(SectionTitle, { children: "\u97F3\u9891\u7126\u70B9" }), SP_JSX.jsx(Hint, { children: "\u51B3\u5B9A\u300C\u624B\u673A\u63A8\u6D41\u300D\u548C\u300CDeck \u6E38\u620F\u58F0\u97F3\u300D\u600E\u4E48\u5171\u5B58\u3002\u4E0D\u4F1A\u6539\u5199\u4F60\u7684\u7CFB\u7EDF\u9ED8\u8BA4\u8F93\u51FA\u3002" }), SP_JSX.jsx(DFL.Focusable, { "flow-children": "column", style: { marginTop: 8 }, children: [
                    ["coexist", "与游戏共存", "两者都出声，互不抢占（推荐）"],
                    ["receiver_first", "接收端优先", "优先保证手机推流音质，关闭自动切通话模式"],
                    ["manual", "手动", "插件不插手，完全自己用系统音量面板调"],
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
                }) }), SP_JSX.jsx(SectionTitle, { children: "\u7701\u7535" }), SP_JSX.jsx(Hint, { children: "\u624B\u673A\u653E\u5B8C\u6B4C\u5E38\u5FD8\u4E86\u65AD\u5F00\uFF0CA2DP \u94FE\u8DEF\u4F1A\u4E00\u76F4\u5360\u7740\u84DD\u7259\u5C04\u9891\u3002\u8FD9\u91CC\u53EF\u4EE5\u81EA\u52A8\u6536\u5C3E\u3002" }), SP_JSX.jsxs("div", { style: { marginTop: 8 }, children: [SP_JSX.jsxs("div", { style: { fontSize: 13.5, color: COLORS.text, marginBottom: 6 }, children: ["\u9759\u97F3\u591A\u4E45\u540E\u81EA\u52A8\u65AD\u5F00", state.silence?.enabled && state.silence.was_active && state.silence.remaining !== null
                                ? `（还有 ${state.silence.remaining} 秒）`
                                : ""] }), SP_JSX.jsx(DFL.SliderField, { value: s.silence_disconnect ?? 0, min: 0, max: 600, step: 30, showValue: false, onChange: (v) => { setSilence(v); } }), SP_JSX.jsxs("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 11.5, color: COLORS.dim }, children: [SP_JSX.jsx("span", { children: "\u5173\u95ED" }), SP_JSX.jsx("span", { children: "5 \u5206\u949F" }), SP_JSX.jsx("span", { children: "10 \u5206\u949F" })] })] }), SP_JSX.jsx(SectionTitle, { children: "\u97F3\u91CF\u5F52\u4E00\u5316" }), SP_JSX.jsxs(Hint, { children: ["\u624B\u673A\u5207\u6B4C\u65F6\u97F3\u91CF\u5FFD\u5927\u5FFD\u5C0F\u5F88\u5E38\u89C1\u3002\u8FD9\u91CC\u8BB0\u5F55\u4E00\u4E2A\u57FA\u7EBF\uFF0C\u8DF3\u53D8\u8D85\u8FC7 25% \u4F1A\u63D0\u793A\u3002 \u5F53\u524D\u57FA\u7EBF\uFF1A", state.normalize?.baseline != null ? Math.round(state.normalize.baseline * 100) + "%" : "未设置", state.normalize?.jumps ? ` · 已检测到 ${state.normalize.jumps} 次跳变` : ""] }), SP_JSX.jsxs(DFL.Focusable, { "flow-children": "row", style: { display: "flex", gap: 10, marginTop: 8 }, children: [SP_JSX.jsx(DFL.Focusable, { onClick: async () => {
                            try {
                                await api.setVolumeBaseline(state.live?.volume ?? state.volume.volume);
                                toaster.toast({ title: "已把当前音量设为基线", body: "" });
                                refresh();
                            }
                            catch (e) {
                                toaster.toast({ title: "设置失败", body: e?.message || String(e) });
                            }
                        }, onActivate: async () => {
                            try {
                                await api.setVolumeBaseline(state.live?.volume ?? state.volume.volume);
                                refresh();
                            }
                            catch { /* ignore */ }
                        }, style: { padding: "8px 16px", borderRadius: 18, background: "rgba(255,255,255,0.08)", color: COLORS.text, fontSize: 13, cursor: "pointer" }, children: "\u4EE5\u5F53\u524D\u97F3\u91CF\u4E3A\u51C6" }), SP_JSX.jsx(DFL.Focusable, { onClick: async () => {
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
                        }, style: { padding: "8px 16px", borderRadius: 18, background: "rgba(255,255,255,0.08)", color: COLORS.sub, fontSize: 13, cursor: "pointer" }, children: "\u91CD\u7F6E" })] }), SP_JSX.jsx(SectionTitle, { children: "\u5EF6\u8FDF\u6863\u4F4D" }), SP_JSX.jsx(Hint, { children: "\u84DD\u7259 A2DP \u7684\u5EF6\u8FDF\u53D6\u51B3\u4E8E\u7F16\u7801\u5668\u4E0E\u7F13\u51B2\u3002\u8FD9\u91CC\u662F\u300C\u7701\u7535 / \u4F4E\u5EF6\u8FDF / \u6297\u5361\u987F\u300D\u7684\u53D6\u820D\u3002" }), SP_JSX.jsx(DFL.Focusable, { "flow-children": "row", style: { display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }, children: (state.output?.latency_profiles || []).map((p) => {
                    const active = (s.latency_profile || "balanced") === p.key;
                    return (SP_JSX.jsxs(DFL.Focusable, { onClick: async () => {
                            try {
                                await api.setLatencyProfile(p.key);
                                toaster.toast({ title: `延迟档位：${p.label}`, body: "WirePlumber 已重启" });
                                setTimeout(refresh, 1200);
                            }
                            catch (e) {
                                toaster.toast({ title: "切换失败", body: e?.message || String(e) });
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
                        }, children: [SP_JSX.jsx("div", { style: { fontSize: 13.5, color: COLORS.text }, children: p.label }), SP_JSX.jsxs("div", { style: { fontSize: 11, color: COLORS.accent, marginTop: 2 }, children: ["\u7EA6 ", p.latency_ms, "ms"] }), SP_JSX.jsx("div", { style: { fontSize: 11, color: COLORS.dim, marginTop: 3, lineHeight: 1.4 }, children: p.desc })] }, p.key));
                }) }), SP_JSX.jsx(SectionTitle, { children: "\u591A\u8F93\u51FA\u540C\u6B65" }), SP_JSX.jsx(ToggleRow, { label: "\u521B\u5EFA\u4E00\u4E2A\u300CDeck \u591A\u8F93\u51FA\u300D\u8BBE\u5907", desc: "\u58F0\u97F3\u540C\u65F6\u9001\u5230\u5185\u7F6E\u5587\u53ED + \u84DD\u7259\u8033\u673A + \u6709\u7EBF\u8033\u673A\u3002\u5F00\u542F\u540E\u5728\u7CFB\u7EDF\u97F3\u91CF\u91CC\u628A\u8F93\u51FA\u5207\u5230\u300CDeck \u591A\u8F93\u51FA\uFF08\u540C\u6B65\uFF09\u300D\u3002", checked: !!s.multi_output, onChange: async (v) => {
                    try {
                        await api.setMultiOutput(v);
                        toaster.toast({ title: v ? "已开启多输出同步" : "已关闭多输出同步", body: "PipeWire 已重启" });
                        setTimeout(refresh, 1500);
                    }
                    catch (e) {
                        toaster.toast({ title: "操作失败", body: e?.message || String(e) });
                    }
                } }), SP_JSX.jsxs(Hint, { children: ["\u5F53\u524D\u8F93\u51FA\u8BBE\u5907\uFF1A", (state.output?.sinks || []).map((k) => k.name).join(" · ") || "读取中…", SP_JSX.jsx("br", {}), "\u26A0\uFE0F \u53CD\u65B9\u5411\u505A\u4E0D\u5230\uFF1A\u53D7 AVDTP \u534F\u8BAE\u9650\u5236\uFF08v1.3 \u00A75.3\uFF09\uFF0C\u540C\u4E00\u9002\u914D\u5668\u540C\u4E00\u65F6\u523B\u53EA\u80FD\u6709\u4E00\u4E2A\u84DD\u7259 A2DP \u6E90\u8BBE\u5907\u8FDE\u8FDB\u6765\u3002"] }), SP_JSX.jsx(SectionTitle, { children: "\u7F16\u7801\u5668" }), SP_JSX.jsxs("div", { style: { fontSize: 13, color: COLORS.sub, lineHeight: 1.9 }, children: [SP_JSX.jsxs("div", { children: ["\u5F53\u524D\u7F16\u7801\uFF1A", state.codec?.codec || "未连接"] }), SP_JSX.jsxs("div", { children: ["Profile\uFF1A", state.codec?.profile || "—"] }), SP_JSX.jsxs("div", { children: ["\u65B9\u5411\uFF1A", state.codec?.role || "—"] })] }), SP_JSX.jsx(SectionTitle, { children: "\u884C\u4E3A" }), SP_JSX.jsx(ToggleRow, { label: "\u63D2\u4EF6\u52A0\u8F7D\u65F6\u81EA\u52A8\u8FDB\u5165\u53EF\u88AB\u53D1\u73B0", desc: "\u6253\u5F00 Decky \u540E\u81EA\u52A8\u5F00\u597D\u84DD\u7259\uFF0C\u7701\u5F97\u6BCF\u6B21\u624B\u52A8\u70B9", checked: !!s.auto_start, onChange: (v) => save("auto_start", v, v ? "已开启自动启动" : "已关闭自动启动") }), SP_JSX.jsx(ToggleRow, { label: "\u4FDD\u6301\u53EF\u88AB\u53D1\u73B0", desc: "BlueZ \u9ED8\u8BA4 180 \u79D2\u540E\u81EA\u52A8\u9690\u85CF\uFF0C\u8FD9\u91CC\u6BCF\u5206\u949F\u590D\u67E5\u4E00\u6B21", checked: !!s.keep_alive, onChange: (v) => save("keep_alive", v, v ? "已开启保活" : "已关闭保活") }), SP_JSX.jsx(ToggleRow, { label: "\u7761\u7720\u5524\u9192\u540E\u81EA\u52A8\u6062\u590D", desc: state.power?.watching
                    ? `已监听（${state.power.backend}）：唤醒后自动恢复可发现并重连上次的设备`
                    : "监听 logind 的睡眠信号，唤醒后自动恢复蓝牙状态（合盖再开盖不会失联）", checked: !!s.resume_restore, onChange: (v) => save("resume_restore", v, v ? "已开启唤醒恢复" : "已关闭唤醒恢复") }), state.power?.watching && (SP_JSX.jsxs(Hint, { children: ["\u5DF2\u6355\u83B7 ", state.power.events, " \u6B21\u7761\u7720/\u5524\u9192\u4E8B\u4EF6", state.power.last ? `，最近一次：${state.power.last[0] === "sleep" ? "睡眠" : "唤醒"}` : "", s.last_device ? ` · 上次设备 ${s.last_device}` : ""] })), SP_JSX.jsx(SectionTitle, { children: "\u7CFB\u7EDF\u4FE1\u606F" }), SP_JSX.jsxs("div", { style: { fontSize: 13, color: COLORS.sub, lineHeight: 1.9 }, children: [SP_JSX.jsxs("div", { children: ["PipeWire\uFF1A", state.versions?.pipewire || "未知"] }), SP_JSX.jsxs("div", { children: ["WirePlumber\uFF1A", state.versions?.wireplumber || "未知"] }), SP_JSX.jsxs("div", { children: ["BlueZ\uFF1A", state.versions?.bluez || "未知"] }), SP_JSX.jsxs("div", { children: ["\u9ED8\u8BA4\u8F93\u51FA\uFF1A", state.sink || "未知"] })] })] }));
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
            toaster.toast({ title: "均衡器已切换", body: "PipeWire 已重启，可能有一两秒静音" });
            setTimeout(refresh, 1500);
        }
        catch (e) {
            toaster.toast({ title: "切换失败", body: e?.message || String(e) });
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
                title: `已导入 ${r.bands} 段 EQ`,
                body: r.skipped ? `跳过 ${r.skipped} 行无法识别` : "PipeWire 已重启",
            });
            setShowImport(false);
            setImportText("");
            setTimeout(refresh, 1500);
        }
        catch (e) {
            toaster.toast({ title: "导入失败", body: e?.message || String(e) });
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
    return (SP_JSX.jsxs("div", { style: { marginTop: 16, maxWidth: 760 }, children: [SP_JSX.jsx(SectionTitle, { children: "\u9884\u8BBE" }), SP_JSX.jsx(Hint, { children: "\u7528 PipeWire \u5185\u7F6E\u7684 param_eq\uFF08\u4E0D\u4F9D\u8D56\u4EFB\u4F55\u5916\u90E8\u63D2\u4EF6\uFF09\u3002\u5207\u6362\u4F1A\u91CD\u542F PipeWire\uFF0C\u53EF\u80FD\u6709\u4E00\u4E24\u79D2\u9759\u97F3\u3002" }), SP_JSX.jsxs(DFL.Focusable, { "flow-children": "column", style: { marginTop: 10 }, children: [presets.map((p) => {
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
                                    }, children: active && SP_JSX.jsx("div", { style: { width: 8, height: 8, borderRadius: 4, background: COLORS.accent } }) }), SP_JSX.jsxs("div", { style: { flex: 1 }, children: [SP_JSX.jsxs("div", { style: { fontSize: 14.5, color: COLORS.text }, children: [p.label, isBusy ? "（应用中…）" : ""] }), SP_JSX.jsx("div", { style: { fontSize: 11.5, color: COLORS.dim, marginTop: 3 }, children: p.desc })] }), p.bands > 0 && SP_JSX.jsxs(Pill, { children: [p.bands, " \u6BB5"] })] }, p.key));
                    }), current === "custom" && (SP_JSX.jsxs(Card, { active: true, children: [SP_JSX.jsxs("div", { style: { flex: 1 }, children: [SP_JSX.jsx("div", { style: { fontSize: 14, color: COLORS.text }, children: "\u81EA\u5B9A\u4E49\uFF08AutoEQ \u5BFC\u5165\uFF09" }), SP_JSX.jsx("div", { style: { fontSize: 11.5, color: COLORS.dim, marginTop: 3 }, children: "\u5F53\u524D\u6B63\u5728\u4F7F\u7528\u5BFC\u5165\u7684\u66F2\u7EBF" })] }), SP_JSX.jsx(Pill, { tone: "accent", children: "\u751F\u6548\u4E2D" })] }))] }), SP_JSX.jsx(SectionTitle, { children: "\u5BFC\u5165 AutoEQ / Squiglink \u66F2\u7EBF" }), SP_JSX.jsxs(Hint, { children: ["\u4ECE ", SP_JSX.jsx("span", { style: { color: COLORS.sub }, children: "AutoEq" }), " \u6216 ", SP_JSX.jsx("span", { style: { color: COLORS.sub }, children: "squig.link" }), " \u590D\u5236 ParametricEQ.txt \u7684\u5185\u5BB9\u7C98\u8FDB\u6765\u3002\u683C\u5F0F\u5F62\u5982 `Filter 1: ON PK Fc 21 Hz Gain 6.7 dB Q 1.100`\u3002"] }), SP_JSX.jsxs(DFL.Focusable, { "flow-children": "row", style: { display: "flex", gap: 10, marginTop: 8 }, children: [SP_JSX.jsx(DFL.Focusable, { onClick: () => setShowImport(!showImport), onActivate: () => setShowImport(!showImport), style: { padding: "8px 16px", borderRadius: 18, background: "rgba(255,255,255,0.08)", color: COLORS.text, fontSize: 13, cursor: "pointer" }, children: showImport ? "收起" : "粘贴曲线…" }), state.eq?.installed && (SP_JSX.jsx(DFL.Focusable, { onClick: async () => {
                            try {
                                await api.removeEq();
                                toaster.toast({ title: "已移除均衡器", body: "PipeWire 已重启" });
                                setTimeout(refresh, 1500);
                            }
                            catch (e) {
                                toaster.toast({ title: "移除失败", body: e?.message || String(e) });
                            }
                        }, onActivate: async () => {
                            try {
                                await api.removeEq();
                                setTimeout(refresh, 1500);
                            }
                            catch { /* ignore */ }
                        }, style: { padding: "8px 16px", borderRadius: 18, background: "rgba(236,65,65,0.14)", color: COLORS.accentWarm, fontSize: 13, cursor: "pointer" }, children: "\u5B8C\u5168\u79FB\u9664 EQ" }))] }), showImport && (SP_JSX.jsxs("div", { style: { marginTop: 10 }, children: [SP_JSX.jsx("textarea", { value: importText, onChange: (e) => setImportText(e.target.value), placeholder: "Preamp: -6.8 dB\nFilter 1: ON PK Fc 21 Hz Gain 6.7 dB Q 1.100\nFilter 2: ON LSC Fc 85 Hz Gain 6.9 dB Q 3.000", style: box }), SP_JSX.jsx(DFL.Focusable, { onClick: doImport, onActivate: doImport, style: {
                            display: "inline-block", marginTop: 8, padding: "9px 20px", borderRadius: 9,
                            background: COLORS.accent, color: "#fff", fontSize: 13.5, cursor: "pointer",
                            opacity: busy === "import" ? 0.5 : 1,
                        }, children: busy === "import" ? "导入中…" : "导入并应用" })] })), SP_JSX.jsxs(Hint, { children: ["\u914D\u7F6E\u6587\u4EF6\uFF1A", SP_JSX.jsx("span", { style: { color: COLORS.sub }, children: state.eq?.path || "~/.config/pipewire/pipewire.conf.d/60-bt-speaker-eq.conf" })] })] }));
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
            toaster.toast({ title: "诊断失败", body: e?.message || String(e) });
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
            toaster.toast({ title: "读取日志失败", body: e?.message || String(e) });
        }
    };
    SP_REACT.useEffect(() => { load(); }, []);
    const box = {
        marginTop: 10, padding: 12, borderRadius: 9, background: "rgba(0,0,0,0.35)",
        fontSize: 11.5, color: COLORS.sub, fontFamily: "monospace", whiteSpace: "pre-wrap",
        maxHeight: 340, overflowY: "auto", lineHeight: 1.55, border: `1px solid ${COLORS.border}`,
    };
    return (SP_JSX.jsxs("div", { style: { marginTop: 16 }, children: [SP_JSX.jsxs(DFL.Focusable, { "flow-children": "row", style: { display: "flex", gap: 10 }, children: [SP_JSX.jsx(DFL.Focusable, { onClick: load, onActivate: load, style: { padding: "8px 16px", borderRadius: 18, background: "rgba(255,255,255,0.08)", color: COLORS.text, fontSize: 13, cursor: "pointer" }, children: loading ? "读取中…" : "重新读取" }), SP_JSX.jsx(DFL.Focusable, { onClick: loadLog, onActivate: loadLog, style: { padding: "8px 16px", borderRadius: 18, background: "rgba(255,255,255,0.08)", color: COLORS.text, fontSize: 13, cursor: "pointer" }, children: "\u67E5\u770B\u65E5\u5FD7" }), SP_JSX.jsx(DFL.Focusable, { onClick: async () => {
                            try {
                                const r = await api.report();
                                setReport(r.text);
                                try {
                                    await navigator.clipboard.writeText(r.text);
                                    toaster.toast({ title: "诊断报告已复制", body: "直接粘贴给作者即可" });
                                }
                                catch {
                                    toaster.toast({ title: "报告已生成", body: "下面可手动选中复制" });
                                }
                            }
                            catch (e) {
                                toaster.toast({ title: "生成失败", body: e?.message || String(e) });
                            }
                        }, onActivate: async () => {
                            try {
                                const r = await api.report();
                                setReport(r.text);
                            }
                            catch { /* ignore */ }
                        }, style: { padding: "8px 16px", borderRadius: 18, background: "rgba(76,154,255,0.18)", color: COLORS.accent, fontSize: 13, cursor: "pointer" }, children: "\u590D\u5236\u8BCA\u65AD\u62A5\u544A" })] }), report && (SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsx(SectionTitle, { children: "\u5B8C\u6574\u62A5\u544A" }), SP_JSX.jsx("div", { style: box, children: report })] })), data && (SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsx(SectionTitle, { children: "\u81EA\u68C0" }), SP_JSX.jsx(DFL.Focusable, { "flow-children": "column", style: { marginTop: 8 }, children: (data.checks || []).map((c, i) => (SP_JSX.jsxs("div", { style: {
                                display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", marginBottom: 6,
                                borderRadius: 8, fontSize: 13,
                                background: c.ok ? "rgba(76,195,138,0.07)" : "rgba(236,65,65,0.10)",
                                border: `1px solid ${c.ok ? "rgba(76,195,138,0.2)" : "rgba(236,65,65,0.3)"}`,
                            }, children: [SP_JSX.jsx("span", { style: { color: c.ok ? COLORS.ok : COLORS.accentWarm, flexShrink: 0 }, children: c.ok ? "✓" : "✕" }), SP_JSX.jsx("span", { style: { flex: 1, color: COLORS.text }, children: c.name }), c.detail && SP_JSX.jsx("span", { style: { fontSize: 11, color: COLORS.dim }, children: c.detail })] }, i))) }), SP_JSX.jsx(SectionTitle, { children: "\u540E\u7AEF\u6A21\u5757" }), SP_JSX.jsx("div", { style: { fontSize: 13, color: COLORS.sub, lineHeight: 1.9 }, children: Object.entries(data.modules || {}).map(([k, v]) => (SP_JSX.jsxs("div", { children: [v ? "✅" : "❌", " ", k, ".py"] }, k))) }), SP_JSX.jsx(SectionTitle, { children: "\u547D\u4EE4\u53EF\u7528\u6027" }), SP_JSX.jsxs("div", { style: { fontSize: 13, color: COLORS.sub, lineHeight: 1.9 }, children: [Object.entries(data.tools || {}).map(([k, v]) => (SP_JSX.jsxs("div", { children: [v ? "✅" : "❌", " ", k] }, k))), SP_JSX.jsxs("div", { children: [data.agent ? "✅" : "❌", " \u914D\u5BF9 agent"] })] }), SP_JSX.jsx(SectionTitle, { children: "\u9002\u914D\u5668\u539F\u59CB\u4FE1\u606F" }), SP_JSX.jsx("div", { style: box, children: data.adapter_raw || "（空）" }), SP_JSX.jsx(SectionTitle, { children: "\u97F3\u9891\u72B6\u6001" }), SP_JSX.jsx("div", { style: box, children: data.wp_status || "（空）" })] })), log && (SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsx(SectionTitle, { right: SP_JSX.jsx("span", { style: { fontSize: 11, color: COLORS.dim }, children: log.path }), children: "\u63D2\u4EF6\u65E5\u5FD7" }), SP_JSX.jsx("div", { style: box, children: log.text || "（空）" })] }))] }));
}

var index = definePlugin(() => {
    try {
        routerHook.removeRoute(ROUTE);
    }
    catch { /* ignore */ }
    routerHook.addRoute(ROUTE, BtSpeakerPage);
    return {
        name: "蓝牙音箱",
        icon: SP_JSX.jsx(FaBluetoothB, {}),
        content: SP_JSX.jsx(Speaker, {}),
        onDismount() {
            try {
                routerHook.removeRoute(ROUTE);
            }
            catch { /* ignore */ }
            stopPolling();
        },
    };
});

export { index as default };
//# sourceMappingURL=index.js.map
