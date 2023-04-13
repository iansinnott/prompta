import type {
  ChatCompletionRequestMessage,
  ChatCompletionResponseMessage,
  Configuration,
  CreateChatCompletionRequest,
  CreateChatCompletionResponse,
} from "openai";
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
import { initOpenAi } from "$lib/llm/openai";
import { fetchEventSource } from "@microsoft/fetch-event-source";

export const showSettings = writable(false);

const PENDING_THREAD_TITLE = "New Thread";

const hasThreadTitle = (t: Thread) => {
  return t.title !== PENDING_THREAD_TITLE;
};

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

export const generateThreadTitle = async ({ threadId }: { threadId: string }) => {
  const conf = get(openAiConfig);
  const apiKey = conf.apiKey as string;
  const openAi = initOpenAi({ apiKey });
  const context = await ChatMessage.findMany({ threadId });
  const messageContext = context.map((x) => ({ content: x.content, role: x.role }));

  // Generate a thread title
  const res = await openAi.createChatCompletion({
    model: "gpt-3.5-turbo", // @note Using the cheaper and faster model for title generation
    temperature: 0.2, // Playing around with this value the lower value seems to be more accurate?
    messages: [
      ...messageContext,
      {
        content: `
Summarize the chat into a short title using 9 words or less on a single line.
Do not include any of the chat instructions or prompts in the summary.
Do not prefix with "title" or "example" etc
Do not provide a word count or add quotation marks.
          `.trim(),
        role: "user",
      },
    ],
  });

  let newTitle = res.data.choices[0].message?.content || "Untitled";

  // Trim trailing period, if found
  if (newTitle.endsWith(".")) {
    newTitle = newTitle.slice(0, -1);
  }

  await Thread.update({
    where: { id: threadId },
    data: { title: newTitle },
  });

  currentThread.update((x) => {
    return { ...x, title: newTitle };
  });
  threadList.invalidate();
};

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

  const pendingMessageStore = writable<ChatMessage | null>(null);

  const { subscribe } = derived<
    [typeof currentThread, typeof pendingMessageStore, typeof invalidationToken],
    { messages: ChatMessage[]; status: "loading" | "idle" }
  >([currentThread, pendingMessageStore, invalidationToken], ([t, pending, _], set) => {
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
    const conf = get(openAiConfig);
    const apiKey = conf.apiKey as string;

    if (!apiKey) {
      throw new Error("No API key");
    }

    const openAi = initOpenAi({ apiKey });

    if (get(pendingMessageStore)) {
      throw new Error("Already a message in progres");
    }

    pendingMessageStore.set({
      id: nanoid(),
      role: "assistant",
      model: conf.model,
      createdAt: new Date(),
      content: "",
      threadId,
    });

    const context = await ChatMessage.findMany({ threadId });

    const messageContext = context.map((x) => ({ content: x.content, role: x.role }));
    const prompt: CreateChatCompletionRequest = {
      messages: messageContext,
      model: conf.model,
      // max_tokens: 100, // just for testing
      stream: true,
    };

    console.log("%cprompt", "color:salmon;font-size:13px;", prompt);

    await fetchEventSource("https://api.openai.com/v1/chat/completions", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      method: "POST",
      body: JSON.stringify(prompt),
      onerror(err) {
        console.error("Error in stream", err);
        throw err;
      },
      onmessage(ev) {
        const message = ev.data;

        if (message === "[DONE]") {
          return; // Stream finished
        }

        try {
          const parsed: CreateChatCompletionResponse = JSON.parse(message);
          // @ts-expect-error types are wrong for streamed responses
          const content = parsed.choices[0].delta.content;
          if (!content) {
            console.log("Contentless message", parsed);
            return;
          }

          pendingMessageStore.update((x) => {
            if (!x) {
              console.warn("should never happen", x);
              return x;
            }

            return { ...x, content: x.content + content };
          });
        } catch (error) {
          console.error("Could not JSON parse stream message", message, error);
        }
      },
    });

    const botMessage = get(pendingMessageStore);

    if (!botMessage) throw new Error("No pending message found when one was expected.");

    // Store it fully in the db
    await ChatMessage.create(botMessage);

    // Clear the pending message. Do this afterwards because it invalidates the chat message list
    pendingMessageStore.set(null);

    if (!hasThreadTitle(get(currentThread))) {
      console.log("Generating thread title...");
      await generateThreadTitle({ threadId: botMessage.threadId });
    }
  };

  return {
    subscribe,
    invalidate,
    deleteMessages: async () => {
      // the await is for tuari
      if (!(await window.confirm("Are you sure you want to delete all messages in this thread?"))) {
        return;
      }

      await ChatMessage.delete({
        where: {
          threadId: get(currentThread).id,
        },
      });

      invalidate();
    },
    sendMessage: async (...args: Parameters<typeof ChatMessage.create>) => {
      const [msg] = args;

      if (isNewThread({ id: msg.threadId })) {
        const newThread = await Thread.create({ title: PENDING_THREAD_TITLE });
        msg.threadId = newThread.id;
        currentThread.set(newThread);
        threadList.invalidate();
      }

      await ChatMessage.create(msg);

      // @todo remove? We shouldn't need this manual validation since pending message will invalidate for u
      // invalidate();

      promptGpt({ threadId: msg.threadId }).catch((err) => {
        console.error("[gpt]", err);
        invalidate();
      });
    },
  };
})();
