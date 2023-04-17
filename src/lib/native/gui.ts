import { invoke } from "@tauri-apps/api";
import * as shell from "@tauri-apps/api/shell";
import { appWindow } from "@tauri-apps/api/window";

export const openExternal = async (url: string) => {
  try {
    await shell.open(url);
  } catch (err) {
    console.debug("Failed to open external URL. Likely in a normal browser.", err);
    window.open(url, "_blank");
  }
};

export const AppWindow = {
  minimize: () => appWindow.minimize(),
  toggleMaximize: () => appWindow.toggleMaximize(),
  close: () => appWindow.close(),
};

export const toggleDevTools = () => invoke("toggle_devtools");
