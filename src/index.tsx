import { definePlugin, routerHook } from "@decky/api";
import { FaBluetoothB } from "react-icons/fa";
import { Speaker } from "./views/Speaker";
import { BtSpeakerPage } from "./views/BtSpeakerPage";
import { DimOverlay, setWakeHandler } from "./views/DimOverlay";
import { ROUTE } from "./theme";
import { stopPolling } from "./store";
import { setDimmed } from "./dimState";
import { injectGlobalStyle, removeGlobalStyle } from "./styles";
import { api } from "./backend";
import { t } from "./i18n";

const OVERLAY_KEY = "bt-speaker-dim-overlay";

export default definePlugin(() => {
  // 全局样式（呼吸动画 + 深色滚动条）。幂等，重复加载不会堆叠。
  injectGlobalStyle();

  try { routerHook.removeRoute(ROUTE); } catch { /* ignore */ }
  routerHook.addRoute(ROUTE, BtSpeakerPage);

  // 息屏遮罩挂成**全局组件**，而不是塞在 QAM 面板里。
  //
  // 为什么？QAM 面板的 DOM 被 Steam 的容器包着，容器还带 `transform`，
  // 会让 `position: fixed` 的包含块退化成那个容器 —— 结果就是
  // 「遮罩盖不住顶栏和 QAM 面板」。挂到全局 React 树里才不受祖先布局影响。
  // 参考：steam3d/MagicBlackDecky 的 routerHook.addGlobalComponent 用法。
  try {
    routerHook.removeGlobalComponent(OVERLAY_KEY);
  } catch { /* ignore */ }
  try {
    routerHook.addGlobalComponent(OVERLAY_KEY, () => <DimOverlay />);
  } catch { /* older loader may not expose this API; run without overlay */ }

  // 遮罩被任何输入唤醒时：通知后端恢复背光 + 释放休眠抑制锁。
  setWakeHandler(() => {
    setDimmed(false);
    api.undimScreen().catch(() => { /* ignore */ });
  });

  return {
    // 名称跟随 Steam 界面语言：英文环境显示 "Bluetooth Speaker"，中文显示「蓝牙音箱」
    name: t("plugin.name"),
    icon: <FaBluetoothB />,
    content: <Speaker />,
    onDismount() {
      try { routerHook.removeRoute(ROUTE); } catch { /* ignore */ }
      try { routerHook.removeGlobalComponent(OVERLAY_KEY); } catch { /* ignore */ }
      removeGlobalStyle();
      setWakeHandler(null);
      stopPolling();
    },
  };
});
