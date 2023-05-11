/**
 * Misc utils
 */

export function groupBy<T, K extends string | number>(xs: T[], f: (x: T) => K) {
  const result = {} as { [k in K]: T[] };
  xs.forEach((x) => {
    const k = f(x);
    if (result[k]) result[k].push(x);
    else result[k] = [x];
  });
  return result;
}

export function chunk<T>(xs: T[], size: number): T[][] {
  const result: T[][] = [];

  for (let i = 0; i < xs.length; i += size) {
    result.push(xs.slice(i, i + size));
  }

  return result;
}

export function debounce<T extends (...args: any) => any>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => ReturnType<T> | void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return function debounced_fn(...args: Parameters<T>) {
    clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      // @ts-expect-error
      fn.apply(this, args);
    }, wait);
  };
}

export interface ThrottleOptions {
  leading?: boolean;
  trailing?: boolean;
}

export function throttle<T extends (...args: any) => any>(
  fn: T,
  wait: number,
  options: ThrottleOptions = {}
): (...args: Parameters<T>) => ReturnType<T> | void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: Parameters<T> | undefined;

  return function throttled_fn(...args: Parameters<T>) {
    const invoke = () => {
      if (lastArgs) {
        // @ts-expect-error
        fn.apply(this, lastArgs);
        lastArgs = undefined;
      }
    };

    if (options.leading && !timeoutId) {
      invoke();
    }

    lastArgs = args;

    if (!timeoutId) {
      timeoutId = setTimeout(() => {
        if (options.trailing) {
          invoke();
        }
        timeoutId = undefined;
      }, wait);
    }
  };
}

export const dirname = (s: string) => s.split("/").slice(0, -1).join("/");

export const basename = (s: string) => s.split("/").at(-1);

export function toSnakeCase(str: string): string {
  return str.replace(/\.?([A-Z]+)/g, (x, y) => "_" + y.toLowerCase()).replace(/^_/, "");
}
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
}

export function mapKeys<T extends Record<string, any>, K extends string>(
  obj: T,
  f: (k: keyof T) => K
): Record<K, T[keyof T]> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [f(k as keyof T), v])) as any;
}

export const isMobile = () => {
  const x = /Mobi|iOS|Android/i.test(navigator.userAgent);
  return x;
};

export const sha1sum = async (s: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(s);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
};
