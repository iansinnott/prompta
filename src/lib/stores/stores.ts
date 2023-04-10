import type { Configuration } from "openai";
import { writable } from "svelte/store";
import type { SQLite3, DB } from "@vlcn.io/crsqlite-wasm";

export const openAiConfig = writable<Partial<Configuration>>({
  apiKey: "",
});

export const sqlite = writable<SQLite3 | null>(null);
export const db = writable<DB | null>(null);

interface Thread {
  id: string;
  title: string;
}
const newThread: Thread = {
  id: "new-thread",
  title: "New Chat",
};

const createThreadStore = () => {
  const { subscribe, set, update } = writable<Thread>(newThread);

  return {
    subscribe,
    set,
    update,
    reset() {
      set(newThread);
    },
  };
};

export const thread = createThreadStore();

export const threadMenu = writable({
  open: false,
});
