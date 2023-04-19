import * as Tauri from "./native";
import * as Browser from "./browser";

interface SystemSpecificApi {
  alert: (message: string) => Promise<void>;
  confirm: (message: string) => Promise<boolean>;
  openExternal: (url: string) => Promise<void>;
  AppWindow: {
    minimize: () => Promise<void>;
    toggleMaximize: () => Promise<void>;
    close: () => Promise<void>;
  };
  toggleDevTools: () => Promise<void>;
  saveAs: (filename: string, data: string) => Promise<void>;

  /**
   * Open a dialog for the user to choose a file, then read that file.
   * Undefined means cancelled, not error.
   * Reading a file path and then reading the file contents are combined into
   * one step because the tauri and browser APIs differ. Browser APIs do not give
   * you an absolute path, and tauri APIs require an absolute path since they
   * don't give you an abstrace file handle.
   */
  chooseAndOpenTextFile: () => Promise<{ name: string; data: string } | undefined>;
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
