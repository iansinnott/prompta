import { Preferences, type Thread } from "$lib/db";
import { writable } from "svelte/store";

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
