import type { Configuration } from "openai";
import {
  derived,
  readable,
  writable,
  type Readable,
  type Writable,
  type Subscriber,
  get,
} from "svelte/store";
import type { SQLite3, DB } from "@vlcn.io/crsqlite-wasm";
import { ChatMessage, Preferences, Thread } from "$lib/db";
import { nanoid } from "nanoid";
import { simulateLLMStreamResponse } from "$lib/llm/utils";

export const showSettings = writable(false);

export const openAiConfig = (() => {
  type OpenAiAppConfig = Partial<Configuration> & { model: string; replicationHost: string };
  const { subscribe, set, update } = writable<OpenAiAppConfig>({
    model: "gpt-3.5-turbo",
    apiKey: "",
    replicationHost: "",
  });

  const persistentSet = (x: OpenAiAppConfig) => {
    Preferences.set("openai-config", x);
    set(x);
  };

  const persistentUpdate = (fn: (config: OpenAiAppConfig) => OpenAiAppConfig) => {
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

const NEWTHREAD = "newthread";
export const sqlite = writable<SQLite3 | null>(null);
export const db = writable<DB | null>(null);
const newThread: Thread = {
  id: NEWTHREAD,
  title: "New Chat",
  createdAt: new Date(),
};

export const isNewThread = (t: { id: Thread["id"] }) => {
  return t.id === NEWTHREAD;
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

/**
 * Create a readable store that can be manually invalidated, forcing the setter
 * function to be called again. I would have thought this would be built-in, maybe I missed it.
 */
const invalidatable = <T>(defaultValue: T, cb: (set: (x: T) => void) => void) => {
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
      cb(_set);
    },
  };
};

export const threadList = invalidatable<Thread[]>([], (set) => {
  Thread.findMany().then(set);
});

(window as any).threadList = threadList;

export const currentChatThread = (() => {
  const invalidationToken = writable(Date.now());
  let lastThreadId: string | undefined = undefined;

  const pendingMessage = writable<ChatMessage | null>(null);

  const { subscribe } = derived<
    [typeof currentThread, typeof pendingMessage, typeof invalidationToken],
    { messages: ChatMessage[]; status: "loading" | "idle" }
  >([currentThread, pendingMessage, invalidationToken], ([t, pending, _], set) => {
    if (isNewThread(t)) {
      set({ status: "idle", messages: [] });
      return;
    }

    // Start loading on change thread
    if (t.id !== lastThreadId) {
      set({ status: "loading", messages: [] });
    }

    lastThreadId = t.id;

    ChatMessage.findMany({ threadId: t.id })
      .then((xs) => {
        if (pending) {
          console.debug("Pending message", pending);
          set({ messages: [...xs, pending], status: "loading" });
        } else {
          set({ messages: xs, status: "idle" });
        }
      })
      .catch((err) => {
        set({ messages: [], status: "idle" });
        throw err;
      });
  });

  const invalidate = () => {
    invalidationToken.set(Date.now());
  };

  const promptGpt = async ({ threadId }: { threadId: string }) => {
    pendingMessage.set({
      id: nanoid(),
      role: "assistant",
      createdAt: new Date(),
      content: "",
      threadId,
    });

    const context = await ChatMessage.findMany({ threadId });
    console.log("%ccontext", "color:salmon;font-size:13px;", context);
    await simulateLLMStreamResponse(
      (msg) => {
        pendingMessage.update((x) => {
          if (!x) {
            console.warn("should never happen", x);
            return x;
          }

          return { ...x, content: x.content + msg.data };
        });
      },
      10,
      200
    );

    // Store a reference to the pending message
    const x = get(pendingMessage);

    if (!x) throw new Error("No pending message found when one was expected.");

    // Store it fully in the db
    await ChatMessage.create(x);

    // Clear the pending message. Do this afterwards because it invalidates the chat message list
    pendingMessage.set(null);
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
        threadList.invalidate();
      }

      await ChatMessage.create(msg);

      // @todo remove? We shouldn't need this manual validation since pending message will invalidate for u
      // invalidate();

      promptGpt({ threadId: msg.threadId });
    },
  };
})();
