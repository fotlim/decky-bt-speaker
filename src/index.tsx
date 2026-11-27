import { definePlugin, routerHook } from "@decky/api";
import { FaBluetoothB } from "react-icons/fa";
import { Speaker } from "./views/Speaker";
import { BtSpeakerPage } from "./views/BtSpeakerPage";
import { ROUTE } from "./route";
import { stopPolling } from "./store";
import { t } from "./i18n";

export default definePlugin(() => {
  try { routerHook.removeRoute(ROUTE); } catch { /* ignore */ }
  routerHook.addRoute(ROUTE, BtSpeakerPage);

  return {
    // 名称跟随 Steam 界面语言：英文环境显示 "Bluetooth Speaker"，中文显示「蓝牙音箱」
    name: t("plugin.name"),
    icon: <FaBluetoothB />,
    content: <Speaker />,
    onDismount() {
      try { routerHook.removeRoute(ROUTE); } catch { /* ignore */ }
      stopPolling();
    },
  };
});
