import * as Tauri from "./gui";
import * as Browser from "./browser";

interface ISystemApi {
  openExternal: (url: string) => Promise<void>;
  AppWindow: {
    minimize: () => Promise<void>;
    toggleMaximize: () => Promise<void>;
    close: () => Promise<void>;
  };
  toggleDevTools: () => Promise<void>;
  saveAs: (filename: string, data: string) => Promise<void>;
}

export const getApi = (): ISystemApi => {
  // @ts-ignore
  if (window.__TAURI_IPC__) {
    return Tauri;
  } else {
    return Browser;
  }
};
