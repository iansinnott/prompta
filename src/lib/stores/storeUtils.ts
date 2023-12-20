import { Preferences, type Thread } from "$lib/db";
import { writable, type Subscriber, readable } from "svelte/store";

export const PENDING_THREAD_TITLE = "New Chat";

export const hasThreadTitle = (t: Thread) => {
  return t.title !== PENDING_THREAD_TITLE;
};

export const persistentStore = <T extends Record<string, any>>(prefix: string, defaultValue: T) => {
  const { subscribe, set, update } = writable<T>(defaultValue);

  const persistentSet = (x: T) => {
    const entries = Object.entries(x).map(([k, v]) => [`${prefix}/${k}`, v] as [string, any]);
    Preferences.setEntries(entries);
    set(x);
  };

  const persistentUpdate = (fn: (x: T) => T) => {
    update((x) => {
      const v = fn(x);
      persistentSet(v);
      return v;
    });
  };

  const init = async () => {
    const entries = await Preferences.getEntries({
      where: { like: `${prefix}/%` },
    });

    // If we call set with empty entries, we remove all values from the store
    if (entries.length) {
      set(
        Object.fromEntries(
          entries.map(([k, v]) => {
            const key = k.replace(`${prefix}/`, "");
            return [key, v];
          })
        ) as T
      );
    }
  };

  return {
    subscribe,
    set: persistentSet,
    update: persistentUpdate,
    init,
  };
};

export type InvalidateOptions = {
  onInvalidated?: () => void;

  /**
   * Optional name for debugging purposes. Should not affect runtime behavior.
   */
  name?: string;
};

/**
 * Create a readable store that can be manually invalidated, forcing the setter
 * function to be called again. I would have thought this would be built-in, maybe I missed it.
 */
export const invalidatable = <T>(
  defaultValue: T,
  cb: (set: (x: T) => void) => void,
  options: InvalidateOptions = {}
) => {
  // Keep a reference to the setter function. This way, to invalidate we just
  // call the callback with the setter. I.e. 'invalidate' just calls the callback on demand
  let _set: Subscriber<T>;

  const innerStore = readable<T>(defaultValue, (set) => {
    _set = set;
    cb(_set);
  });

  return {
    subscribe: innerStore.subscribe,
    invalidate: () => {
      if (!_set) {
        console.warn(
          `WARN: Tried to invalidate store %c${
            options.name || "<unnamed>"
          }%c before it was subscribed. This is a %cno-op`,
          "color:pink;",
          "color:unset;",
          "color:red;"
        );
        return;
      }
      cb(_set);
      options.onInvalidated?.();
    },
  };
};
