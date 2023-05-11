import type {
  Configuration,
  CreateChatCompletionRequest,
  CreateChatCompletionResponse,
} from "openai";
import { derived, readable, writable, type Subscriber, get } from "svelte/store";
import type { SQLite3, DB } from "@vlcn.io/crsqlite-wasm";
import { ChatMessage, DatabaseMeta, Preferences, Thread } from "$lib/db";
import { nanoid } from "nanoid";
import { initOpenAi } from "$lib/llm/openai";
import { fetchEventSource, type EventSourceMessage } from "@microsoft/fetch-event-source";
import { wdbRtc } from "@vlcn.io/sync-p2p";
import { getSystem } from "$lib/gui";
import { dev } from "$app/environment";

export const showSettings = writable(false);

const PENDING_THREAD_TITLE = "New Chat";

const hasThreadTitle = (t: Thread) => {
  return t.title !== PENDING_THREAD_TITLE;
};

const persistentStore = <T extends Record<string, any>>(prefix: string, defaultValue: T) => {
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

export const openAiConfig = (() => {
  type OpenAiAppConfig = Partial<Configuration> & {
    replicationHost: string;
    siteId: string;
    lastSyncChain: string;
  };

  const defaultConfig: OpenAiAppConfig = {
    apiKey: "",
    replicationHost: "",
    siteId: "",
    lastSyncChain: "",
  };

  const { subscribe, set, update } = writable<OpenAiAppConfig>(defaultConfig);

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
    init: async () => {
      const config = await Preferences.get("openai-config");
      const siteId = await DatabaseMeta.getSiteId();
      if (!config) {
        console.debug("No config found. Likely first time running the app. Using default config.");
      }

      // if query param is set, use that sync chain
      let c = config || defaultConfig;
      const urlParams = new URLSearchParams(location.search);
      const syncChain = urlParams.get("syncChain") || c.lastSyncChain;
      set({ ...c, siteId, lastSyncChain: syncChain });
    },
  };
})();

interface GPTProfile {
  name: string;
  model: string;
  systemMessage: string;
}

export const DEFAULT_SYSTEM_MESSAGE = `
You are a helpful assistant. Respond to user messages as accurately as possible. Do not repeat the prompt.
Be concise, unless the user asks for more detail.
Assume the user has a technical background and understands software programming, although they may ask about any topic.
When producing code, insert the language identifier after opening fences.
    `.trim();

export const activeProfileName = writable("default");
export const profilesStore = persistentStore<{ [key: string]: GPTProfile }>("profile", {
  default: {
    name: "default",
    model: "gpt-3.5-turbo",
    systemMessage: DEFAULT_SYSTEM_MESSAGE,
  },
});

/**
 * A store for _RUNTIME_ dev stuff. For build-time, use the `dev` variable.
 */
export const devStore = persistentStore<{ showDebug: boolean }>("dev", {
  showDebug: dev,
});

// @todo Persist
export const gptProfileStore = (() => {
  const activeProfileStore = derived([profilesStore, activeProfileName], ([profiles, name]) => {
    return profiles[name];
  });

  return {
    subscribe: activeProfileStore.subscribe,
    set: (profile: GPTProfile) => {
      profilesStore.update((x) => {
        return { ...x, [profile.name]: profile };
      });
    },
    selectProfile: (name: string) => {
      activeProfileName.set(name);
    },
  };
})();

export const getOpenAi = () => {
  const conf = get(openAiConfig);
  const apiKey = conf.apiKey as string;

  if (!apiKey) {
    throw new Error("No API key");
  }

  return initOpenAi({ apiKey });
};

export const generateThreadTitle = async ({ threadId }: { threadId: string }) => {
  const openAi = getOpenAi();
  const context = await ChatMessage.findThreadContext({ threadId });
  const messageContext = context.map((x) => ({ content: x.content, role: x.role }));

  const prompt: CreateChatCompletionRequest = {
    model: "gpt-3.5-turbo", // @note Using the cheaper and faster model for title generation
    temperature: 0.2, // Playing around with this value the lower value seems to be more accurate?
    messages: [
      ...messageContext,
      {
        content: `
Summarize the chat into a short, concise title using 9 words or less on a single line.
Do not include any of the chat instructions or prompts in the summary.
Do not prefix with "title" or "example" etc
Do not provide a word count or add quotation marks.
          `.trim(),
        role: "user",
      },
    ],
  };

  // Generate a thread title
  const res = await openAi.createChatCompletion(prompt);

  let newTitle = res.data.choices[0].message?.content || "Untitled";

  // trim surrounding quotes, if found
  if (newTitle.startsWith('"') && newTitle.endsWith('"')) {
    newTitle = newTitle.slice(1, -1);
  }

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
export const newThread: Thread = {
  id: NEWTHREAD,
  title: PENDING_THREAD_TITLE,
  archived: false,
  createdAt: new Date(),
};

export const isNewThread = (t: { id: Thread["id"] }) => {
  return t.id === NEWTHREAD;
};

const createThreadStore = () => {
  const innerStore = writable<Thread>(newThread);
  const { subscribe, set, update } = innerStore;

  const persistentSet = (x: Thread) => {
    Preferences.set("current-thread-id", x.id);
    set(x);
  };

  const reset = () => persistentSet(newThread);

  return {
    subscribe,
    set: persistentSet,
    update,
    reset,

    /**
     * Mark the current thread as archived
     */
    archive: async () => {
      const thread = get(innerStore);
      if (isNewThread(thread)) {
        return;
      }

      await Thread.update({
        where: { id: thread.id },
        data: { archived: true },
      });

      reset();
      threadList.invalidate();
    },

    unarchive: async () => {
      const thread = get(innerStore);
      if (isNewThread(thread)) {
        return;
      }

      await Thread.update({
        where: { id: thread.id },
        data: { archived: false },
      });

      update((x) => {
        return { ...x, archived: false };
      });
      threadList.invalidate();
    },

    init: async () => {
      const threadId = await Preferences.get("current-thread-id");
      if (threadId) {
        const thread = await Thread.findUnique({ where: { id: threadId } });
        if (thread) {
          console.debug("hydrate thread", thread);
          set(thread);
        } else {
          console.warn("Could not find thread:", threadId);
        }
      }
    },
  };
};

export const currentThread = createThreadStore();

export const threadMenu = writable({
  open: false,
});

type InvalidateOptions = {
  onInvalidated?: () => void;
};

/**
 * Create a readable store that can be manually invalidated, forcing the setter
 * function to be called again. I would have thought this would be built-in, maybe I missed it.
 */
const invalidatable = <T>(
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
      cb(_set);
      options.onInvalidated?.();
    },
  };
};

export const archivedThreadList = invalidatable<Thread[]>([], (set) => {
  Thread.findMany({
    where: { archived: true },
    orderBy: { createdAt: "DESC" },
  }).then((xs) => {
    set(xs);
  });
});

export const threadList = invalidatable<Thread[]>(
  [],
  (set) => {
    Thread.findMany({
      where: { archived: false },
      orderBy: { createdAt: "DESC" },
    }).then((xs) => {
      set(xs);
    });
  },
  {
    onInvalidated: archivedThreadList.invalidate,
  }
);

const pendingMessageStore = writable<ChatMessage | null>(null);

export const inProgressMessageId = derived(pendingMessageStore, (x) => x?.id);

/**
 * Handle inbound server sent events, sent by OpenAI's API. This is how we get
 * the live-typing feel from the bot.
 */
const handleSSE = (ev: EventSourceMessage) => {
  const message = ev.data;

  if (message === "[DONE]") {
    return; // Stream finished
  }

  try {
    const parsed: CreateChatCompletionResponse = JSON.parse(message);
    // @ts-expect-error types are wrong for streamed responses
    const content = parsed.choices[0].delta.content;
    if (!content) {
      console.log("Contentless message", parsed.id, parsed.object);
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
};

export const currentChatThread = (() => {
  const invalidationToken = writable(Date.now());
  let lastThreadId: string | undefined = undefined;
  let messageCache: any;

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

    // If messages are cached and there's a pending chat, then we're in the
    // middle of completion. do not re-fetch messages yet. Refetching can cause
    // duplicate key errors if fetched while there's a pending message, since
    // they get put into the same array.
    if (messageCache && pending) {
      set({ messages: [...messageCache, pending], status: "loading" });
      return;
    }

    ChatMessage.findMany({
      where: { threadId: t.id },
      orderBy: { createdAt: "ASC" },
    })
      .then((xs) => {
        messageCache = xs;
        if (pending) {
          set({ messages: [...xs, pending], status: "loading" });
        } else {
          messageCache = null;
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

    if (get(pendingMessageStore)) {
      throw new Error("Already a message in progres");
    }

    const profile = get(gptProfileStore);

    if (!profile) {
      throw new Error("No GPT profile found. activeProfile=" + get(activeProfileName));
    }

    pendingMessageStore.set({
      id: nanoid(),
      role: "assistant",
      model: profile.model,
      createdAt: new Date(),
      content: "",
      threadId,
    });

    const context = await ChatMessage.findThreadContext({ threadId });

    let messageContext = context.map((x) => ({ content: x.content, role: x.role }));

    if (profile.systemMessage) {
      messageContext = [
        {
          content: profile.systemMessage,
          role: "system",
        },
        ...messageContext,
      ];
    }

    const prompt: CreateChatCompletionRequest = {
      messages: messageContext,
      model: profile.model,
      // max_tokens: 100, // just for testing
      stream: true,
    };

    console.log("%cprompt", "color:salmon;font-size:13px;", prompt);

    abortController = new AbortController();

    await fetchEventSource("https://api.openai.com/v1/chat/completions", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${conf.apiKey}`,
      },
      method: "POST",
      body: JSON.stringify(prompt),
      signal: abortController.signal,
      onerror(err) {
        console.error("Error in stream", err);
        throw err;
      },
      onmessage: handleSSE,

      // Very important. If the stream closes and reopens when the window is
      // hidden (default behavior), then the chat completion with ChatGPT will
      // get _RESTARTED_. So not only do you need to wait for a new completion,
      // from the beginning, you're also getting overcharged since part of the
      // explanation is likely to be the same. Also, on our end, it leads to
      // mangled markdown since the message completion doesn't know that
      // anything is amiss, even though the event stream starts firing off from
      // the beginning.
      openWhenHidden: true,
    });

    const botMessage = get(pendingMessageStore);

    if (!botMessage) throw new Error("No pending message found when one was expected.");

    // Store it fully in the db
    await ChatMessage.create({
      ...botMessage,
      cancelled: abortController.signal.aborted,
    });

    // Clear the pending message. Do this afterwards because it invalidates the chat message list
    pendingMessageStore.set(null);

    if (!hasThreadTitle(get(currentThread))) {
      console.log("Generating thread title...");
      await generateThreadTitle({ threadId: botMessage.threadId });
    }
  };

  let abortController: AbortController;

  return {
    subscribe,
    invalidate,

    softDeleteThread: async () => {
      if (
        !(await getSystem().confirm(
          "This thread and all messages will be moved to the trash. This is reversible. Continue?"
        ))
      ) {
        return;
      }

      const threadId = get(currentThread).id;
      await ChatMessage.softDelete({
        where: {
          threadId,
        },
      });
      await Thread.softDelete({
        where: {
          id: threadId,
        },
      });
    },

    deleteMessages: async () => {
      if (
        !(await getSystem().confirm("Are you sure you want to delete all messages in this thread?"))
      ) {
        return;
      }

      await ChatMessage.delete({
        where: {
          threadId: get(currentThread).id,
        },
      });
    },

    regenerateResponse: async () => {
      const lastMessage = get(currentChatThread).messages.at(-1);

      if (!lastMessage) {
        throw new Error("No last message found. Empty thread?");
      }

      if (lastMessage.role !== "assistant") {
        throw new Error("Last message was not from the assistant");
      }

      await ChatMessage.delete({
        where: {
          id: lastMessage.id,
        },
      });

      promptGpt({ threadId: lastMessage.threadId }).catch((err) => {
        console.error("[gpt]", err);
        invalidate();
      });
    },

    cancel: async () => {
      abortController.abort();
    },

    sendCommand: async (cmd: { command: string; args: string[]; threadId: string }) => {
      if (isNewThread({ id: cmd.threadId as string })) {
        getSystem().alert("Cannot send command without a thread");
      }

      await ChatMessage.create({
        threadId: cmd.threadId,
        role: cmd.command,
        content: cmd.args.join(" "),
      });
    },

    sendMessage: async (...args: Parameters<typeof ChatMessage.create>) => {
      const [msg] = args;

      if (isNewThread({ id: msg.threadId as string })) {
        const newThread = await Thread.create({ title: PENDING_THREAD_TITLE });
        msg.threadId = newThread.id;
        currentThread.set(newThread);
        threadList.invalidate();
      }

      await ChatMessage.create(msg);

      promptGpt({ threadId: msg.threadId as string }).catch((err) => {
        console.error("[gpt]", err);
      });
    },
  };
})();

type RTC = Awaited<ReturnType<typeof wdbRtc>>;

export const syncStore = (() => {
  const store = writable<{
    pending: string[];
    established: string[];
    showSyncModal: boolean;
    connection: string;
  }>({
    pending: [],
    established: [],
    showSyncModal: false,
    connection: "",
  });

  const { subscribe, update, set } = store;

  let rtc: RTC | null = null;

  const onConnectionChanged = (pending, established) => {
    console.log("rtc.onConnectionsChanged", { pending, established });
    syncStore.update((x) => ({ ...x, pending, established }));
  };

  const dispose = () => {
    // lastSyncChain is used for reconnecting. We only want to clear it if the
    // user disconnected. However, i think this function is called during
    // cleanup regardless of whether or not the user stored a sync code.
    if (!rtc) {
      openAiConfig.update((x) => ({ ...x, lastSyncChain: "" }));
    }

    console.log("RTC disconnect");
    update((x) => ({ ...x, connection: "" }));
    rtc?.offConnectionsChanged(onConnectionChanged);
    rtc?.dispose();
    rtc = null;
  };

  return {
    subscribe,
    update,
    set,
    disconnect: dispose, // An alias...

    /**
     * Disconnect from the current chain and dispose of the rtc instance. Should
     * only be called if there is no intent to use RTC anymore this session, i.g.
     * when the browser is about to close
     */
    dispose,

    init: async () => {
      const _db = get(db);
      if (!_db) {
        throw new Error("No db found");
      }

      rtc = await wdbRtc(_db);
      rtc.onConnectionsChanged(onConnectionChanged);
    },

    async connectTo(s: string, remainingRetries = 3) {
      if (rtc) {
        rtc.connectTo(s);
        openAiConfig.update((x) => ({ ...x, lastSyncChain: s }));
        update((x) => ({ ...x, connection: s }));
      } else {
        console.warn(`RTC not initialized. Initializing and trying again...`);
        return this.init().then(() => this.connectTo(s, remainingRetries - 1));
      }
    },
  };
})();

Thread.onTableChange(() => {
  console.debug("%cthread table changed", "color:salmon;");
  threadList.invalidate();
});

ChatMessage.onTableChange(() => {
  console.debug("%cmessage table changed", "color:salmon;");
  currentChatThread.invalidate();
});
