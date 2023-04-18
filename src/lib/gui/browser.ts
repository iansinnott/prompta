const noop = async () => {};

export const openExternal = async (url: string) => {
  window.open(url, "_blank");
};

export const AppWindow = {
  minimize: noop,
  toggleMaximize: noop,
  close: noop,
};

export const toggleDevTools = noop;

export async function saveAs(filename: string, data: string) {
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function alert(message: string) {
  await window.alert(message);
}
