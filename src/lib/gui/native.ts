import * as tauri from "@tauri-apps/api";
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

export const toggleDevTools = async () => {
  await tauri.invoke("toggle_devtools");
};

export async function saveAs(filename: string, data: string) {
  const savePath = await tauri.dialog.save({ title: "Save as", defaultPath: filename });
  if (!savePath) return;
  return tauri.fs.writeFile(savePath, data);
}

export async function alert(message: string) {
  await tauri.dialog.message(message);
}
