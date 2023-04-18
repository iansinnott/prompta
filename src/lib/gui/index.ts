import * as Tauri from "./native";
import * as Browser from "./browser";

interface SystemSpecificApi {
  openExternal: (url: string) => Promise<void>;
  AppWindow: {
    minimize: () => Promise<void>;
    toggleMaximize: () => Promise<void>;
    close: () => Promise<void>;
  };
  toggleDevTools: () => Promise<void>;
  saveAs: (filename: string, data: string) => Promise<void>;
}

interface SystemApi extends SystemSpecificApi {
  isTauri: boolean;
  isBrowser: boolean;
}

export const getSystem = (): SystemApi => {
  // @ts-ignore
  if (window.__TAURI_IPC__) {
    return {
      ...Tauri,
      isTauri: true,
      isBrowser: false,
    };
  } else {
    return {
      ...Browser,
      isTauri: false,
      isBrowser: true,
    };
  }
};
