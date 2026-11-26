import { definePlugin, routerHook } from "@decky/api";
import { FaBluetoothB } from "react-icons/fa";
import { Speaker } from "./views/Speaker";
import { BtSpeakerPage } from "./views/BtSpeakerPage";
import { ROUTE } from "./route";
import { stopPolling } from "./store";

export default definePlugin(() => {
  try { routerHook.removeRoute(ROUTE); } catch { /* ignore */ }
  routerHook.addRoute(ROUTE, BtSpeakerPage);

  return {
    name: "蓝牙音箱",
    icon: <FaBluetoothB />,
    content: <Speaker />,
    onDismount() {
      try { routerHook.removeRoute(ROUTE); } catch { /* ignore */ }
      stopPolling();
    },
  };
});
