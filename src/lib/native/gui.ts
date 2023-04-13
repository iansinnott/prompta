import * as shell from "@tauri-apps/api/shell";

export const openExternal = async (url: string) => {
  try {
    await shell.open(url);
  } catch (err) {
    console.debug("Failed to open external URL. Likely in a normal browser.", err);
    window.open(url, "_blank");
  }
};
