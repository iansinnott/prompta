import type { Configuration } from "openai";
import { derived, readable, writable } from "svelte/store";
import type { SQLite3, DB } from "@vlcn.io/crsqlite-wasm";
import { ChatMessage, Thread } from "$lib/db";

export const openAiConfig = writable<Partial<Configuration>>({
  apiKey: "",
});

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

  return {
    subscribe,
    set,
    update,
    reset: () => set(newThread),
  };
};

export const thread = createThreadStore();

export const threadMenu = writable({
  open: false,
});

export const threadList = readable<Thread[]>([], (set) => {
  Thread.findMany().then(set);
});

export const currentChatThread = (() => {
  const validationToken = writable(Date.now());
  const { subscribe } = derived<
    [typeof thread, typeof validationToken],
    {
      messages: ChatMessage[];
    }
  >([thread, validationToken], ([t, _], set) => {
    if (isNewThread(t)) {
      set({ messages: [] });
      return;
    }

    ChatMessage.findMany({ threadId: t.id }).then((xs) => set({ messages: xs }));
  });

  const invalidate = () => {
    validationToken.set(Date.now());
  };

  return {
    subscribe,
    invalidate,
    sendMessage: async (...args: Parameters<typeof ChatMessage.create>) => {
      const [msg] = args;
      if (isNewThread({ id: msg.threadId })) {
        const newThread = await Thread.create({ title: msg.content.trim().slice(0, 80) });
        msg.threadId = newThread.id;
        thread.set(newThread);
      }
      const x = await ChatMessage.create(msg);
      invalidate();
      return x;
    },
  };
})();
