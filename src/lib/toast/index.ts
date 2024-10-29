import { toast as _toast } from "svelte-sonner";

export interface ToastProps {
  type: "info" | "success" | "error";
  title: string;
  message?: string;
  autocloseTimeout?: number;
}

export const toast = (props: ToastProps) => {
  if (props.autocloseTimeout) {
    console.warn("autocloseTimeout is not supported");
  }

  _toast[props.type](props.title, {
    description: props.message,
  });
};
