import type { Configuration } from "openai";
import { derived, readable, writable } from "svelte/store";
import type { SQLite3, DB } from "@vlcn.io/crsqlite-wasm";
import { ChatMessage, Preferences, Thread } from "$lib/db";

export const openAiConfig = (() => {
  const { subscribe, set, update } = writable<Partial<Configuration>>({});

  const persistentSet = (x: Configuration) => {
    Preferences.set("openai-config", x);
    set(x);
  };

  const persistentUpdate = (fn: (config: Configuration) => Configuration) => {
    update((x) => {
      const v = fn(x);
      Preferences.set("openai-config", v);
      return v;
    });
  };

  return {
    subscribe,
    set: persistentSet,
    update: persistentUpdate,
  };
})();

export const sqlite = writable<SQLite3 | null>(null);
export const db = writable<DB | null>(null);
const newThread: Thread = {
  id: 0,
  title: "New Chat",
  createdAt: new Date(),
};

export const isNewThread = (t: { id: Thread["id"] }) => {
  return t.id === 0;
};

const createThreadStore = () => {
  const { subscribe, set, update } = writable<Thread>(newThread);

  const persistentSet = (x: Thread) => {
    Preferences.set("current-thread-id", x.id);
    set(x);
  };

  return {
    subscribe,
    set: persistentSet,
    update,
    reset: () => persistentSet(newThread),
  };
};

export const currentThread = createThreadStore();

export const threadMenu = writable({
  open: false,
});

export const threadList = readable<Thread[]>([], (set) => {
  Thread.findMany().then(set);
});

export const currentChatThread = (() => {
  const invalidationToken = writable(Date.now());
  const { subscribe } = derived<
    [typeof currentThread, typeof invalidationToken],
    { messages: ChatMessage[]; status: "loading" | "idle" }
  >([currentThread, invalidationToken], ([t, _], set) => {
    if (isNewThread(t)) {
      set({ messages: [], status: "idle" });
      return;
    }

    // This is the default value, and the value while a thread is loading
    set({ status: "loading", messages: [] });

    ChatMessage.findMany({ threadId: t.id }).then((xs) => set({ messages: xs, status: "idle" }));
  });

  const invalidate = () => {
    invalidationToken.set(Date.now());
  };

  return {
    subscribe,
    invalidate,
    sendMessage: async (...args: Parameters<typeof ChatMessage.create>) => {
      const [msg] = args;
      if (isNewThread({ id: msg.threadId })) {
        const newThread = await Thread.create({ title: msg.content.trim().slice(0, 80) });
        msg.threadId = newThread.id;
        currentThread.set(newThread);
      }
      const x = await ChatMessage.create(msg);
      invalidate();
      return x;
    },
  };
})();
