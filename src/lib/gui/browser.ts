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

export async function confirm(message: string) {
  return await window.confirm(message);
}

export async function chooseAndOpenTextFile() {
  let inputElement: HTMLInputElement;

  return new Promise<{ name: string; data: string } | undefined>((resolve, reject) => {
    inputElement = document.createElement("input");
    inputElement.type = "file";
    inputElement.accept = ".json";
    inputElement.style.display = "none";
    inputElement.id = "filePicker";

    document.body.appendChild(inputElement);

    inputElement.addEventListener("change", (event) => {
      // @ts-ignore Poor typing on input events?
      const file: File = event.target.files[0];
      const reader = new FileReader();

      reader.onload = () => {
        // Resolve the promise with the file's contents as a UTF-8 encoded string
        resolve({
          name: file.name,
          data: reader.result as string,
        });

        // Reset the input element value to allow selecting the same file again
        // @ts-ignore
        event.target.value = null;
      };

      reader.onerror = () => {
        // Reject the promise with the error
        reject(reader.error);

        // Reset the input element value to allow selecting the same file again
        // @ts-ignore
        event.target.value = null;
      };

      // Read the file as a UTF-8 encoded string
      reader.readAsText(file, "UTF-8");
    });

    inputElement.click();
  }).finally(() => {
    if (inputElement) document.body.removeChild(inputElement);
  });
}
