import { writable } from "svelte/store";

export interface ToastProps {
  type: "info" | "success" | "error";
  title: string;
  message?: string;
  autocloseTimeout?: number;
}

class Toast {
  static of = (props: ToastProps) => {
    return new Toast(props, toastStore);
  };

  props: ToastProps;
  timeout: any;
  startedAt: number;
  store: typeof toastStore;
  autocloseTimeout: number;

  constructor(props: ToastProps, store: typeof toastStore) {
    this.store = store;
    this.props = props;
    this.autocloseTimeout = props.autocloseTimeout || 5000;
    this.timeout = setTimeout(() => {
      this.remove();
    }, this.autocloseTimeout);
    this.startedAt = Date.now();
  }

  pause() {
    if (this.timeout) clearTimeout(this.timeout);
  }

  resume() {
    this.timeout = setTimeout(() => {
      this.remove();
    }, this.autocloseTimeout - (Date.now() - this.startedAt));
  }

  remove() {
    if (this.timeout) clearTimeout(this.timeout);
    this.store.update((store) => {
      const newToasts = store.toasts.filter((toast) => toast !== this);
      return {
        ...store,
        toasts: newToasts,
      };
    });
  }
}

export const toastStore = writable({
  toasts: [] as Toast[],
});

const timeouts: Record<string, any> = {};

export const toast = (props: ToastProps) => {
  toastStore.update((store) => {
    const newToast = Toast.of(props);
    const newToasts = [...store.toasts, newToast];
    return {
      ...store,
      toasts: newToasts,
    };
  });
};
