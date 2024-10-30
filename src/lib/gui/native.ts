import { basename } from "$lib/utils";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import * as shell from "@tauri-apps/plugin-shell";
import * as dialog from "@tauri-apps/plugin-dialog";
import * as fs from "@tauri-apps/plugin-fs";

export const openExternal = async (url: string) => {
  try {
    await shell.open(url);
  } catch (err) {
    console.debug("Failed to open external URL. Likely in a normal browser.", err);
    window.open(url, "_blank");
  }
};

export const AppWindow = {
  minimize: () => getCurrentWebviewWindow().minimize(),
  toggleMaximize: () => getCurrentWebviewWindow().toggleMaximize(),
  close: () => getCurrentWebviewWindow().close(),
};

export const toggleDevTools = async () => {
  await invoke("toggle_devtools");
};

export async function saveAs(filename: string, data: string) {
  const savePath = await dialog.save({ title: "Save as", defaultPath: filename });
  if (!savePath) return;
  return fs.writeFile(savePath, new TextEncoder().encode(data));
}

export async function chooseAndOpenTextFile() {
  const file = await dialog.open({
    multiple: false,
    directory: false,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });

  if (!file) return;

  let filePath: string;
  if (Array.isArray(file)) {
    filePath = file[0];
  } else {
    filePath = file;
  }

  const data = await fs.readTextFile(filePath);

  return {
    name: basename(filePath) as string,
    data,
  };
}

export async function alert(message: string) {
  await dialog.message(message);
}

export async function confirm(message: string) {
  return dialog.confirm(message, { kind: "warning" });
}

export async function chooseAndOpenImageFile() {
  const file = await dialog.open({
    multiple: false,
    directory: false,
    filters: [
      {
        name: "Images",
        // Include all common image formats including SVG
        extensions: ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "tiff"],
      },
    ],
  });

  if (!file) return;

  const filePath = Array.isArray(file) ? file[0] : file;
  const data = await fs.readFile(filePath);

  return {
    name: basename(filePath) as string,
    data,
  };
}
