import type { DBAsync } from "@vlcn.io/xplat-api";
import { OpenAI, type ClientOptions } from "openai";
import { derived, readable, writable, type Subscriber, get } from "svelte/store";
import type { SQLite3, DB } from "@vlcn.io/crsqlite-wasm";
import {
  ChatMessage,
  DatabaseMeta,
  Fragment,
  Preferences,
  Thread,
  type FragmentSearchResult,
  getCurrentSchema,
  LLMProvider,
} from "$lib/db";
import { nanoid } from "nanoid";
import { initOpenAi } from "$lib/llm/openai";
import { fetchEventSource, type EventSourceMessage } from "@microsoft/fetch-event-source";
import { getSystem } from "$lib/gui";
import { dev } from "$app/environment";
import { emit } from "$lib/capture";
import { debounce } from "$lib/utils";
import { toast } from "$lib/toast";
import { createSyncer, getDefaultEndpoint, type Syncer } from "$lib/sync/vlcn";
import { PENDING_THREAD_TITLE, hasThreadTitle, persistentStore } from "../storeUtils";
import { llmProviders } from "./llmProvider";

export const showSettings = writable(false);
export const showInitScreen = writable(false);

type OpenAiAppConfig = Partial<ClientOptions> & {
  replicationHost: string;
  siteId: string;
  lastSyncChain: string;
};

export const openAiConfig = (() => {
  const defaultConfig: OpenAiAppConfig = {
    apiKey: "",
    baseURL: "https://api.openai.com/v1/",

    // NOTE: since these are not infact OpenAI options some separation might be less prone to confusion.
    replicationHost: "",
    siteId: "",
    lastSyncChain: "",
  };

  const { subscribe, set, update } = writable<OpenAiAppConfig>(defaultConfig);

  const localStorageSet = (x: OpenAiAppConfig) => {
    const s = JSON.stringify(x);
    localStorage.setItem("openai-config", s);
    set(x);
  };

  const localStorageUpdate = (fn: (config: OpenAiAppConfig) => OpenAiAppConfig) => {
    update((x) => {
      const v = fn(x);
      const s = JSON.stringify(v);
      localStorage.setItem("openai-config", s);
      return v;
    });
  };

  return {
    subscribe,
    set: localStorageSet,
    update: localStorageUpdate,
    init: async () => {
      const s = localStorage.getItem("openai-config");
      let config: OpenAiAppConfig;
      if (!s) {
        console.debug("No config found. Likely first time running the app. Using default config.");
        config = defaultConfig;
      } else {
        config = JSON.parse(s) as OpenAiAppConfig;
      }

      const siteId = await DatabaseMeta.getSiteId();
      set({ ...config, siteId });

      // NOTE: this is a stopgap, since moving to the "providers" system this
      // whole things should be refactored. However, we do want backwards compat
      // for existing users.
      if (config.apiKey) {
        llmProviders.updateProvider("openai", { apiKey: config.apiKey });
      }

      // TODO: do we need this here?
      llmProviders.invalidate();
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
  const { model: modelId } = get(gptProfileStore);
  const model = get(chatModels).models.find((x) => x.id === modelId);

  if (!model) {
    throw new Error("No model found for: " + modelId);
  }

  const provider = llmProviders.byId(model.provider.id);

  if (!provider) {
    throw new Error("No provider found for: " + model.provider.id);
  }

  const { apiKey, baseUrl } = provider;

  if (!apiKey && provider.id === "openai") {
    throw new Error("No API key for OpenAI");
  }

  if (!baseUrl) {
    throw new Error("No API URL");
  }

  return initOpenAi({ apiKey, baseURL: baseUrl });
};

export const verifyOpenAiApiKey = async (apiKey: string) => {
  const conf = get(openAiConfig);
  const baseURL = conf.baseURL as string;

  // Skip verification if the base url is not the standard openai base url
  // because we aren't sure custom URL supports it. The base URL is assumed to
  // suppor the OpenAI API, but the models endpoint may be overlooked in favor
  // of merely supporting chat-related endpoints.
  if (baseURL && baseURL !== "https://api.openai.com/v1/") {
    return true;
  }

  // Ping the models endpoint to verify the api key
  try {
    await fetch("https://api.openai.com/v1/models", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    }).then((x) => (x.ok ? x.json() : Promise.reject(x)));
    return true;
  } catch (err) {
    console.error("Could not verify api key. Likely invalid", err);
    return false;
  }
};

export const generateThreadTitle = async ({ threadId }: { threadId: string }) => {
  const openAi = getOpenAi();
  const context = await ChatMessage.findThreadContext({ threadId });
  const messageContext = context.map((x) => ({ content: x.content, role: x.role }));
  const modelName = get(gptProfileStore).model;

  if (!modelName) {
    toast({
      type: "error",
      title: "No model selected",
      message: "Please select a model via the dropdown",
    });
    return;
  }

  const prompt: OpenAI.Chat.CompletionCreateParamsNonStreaming = {
    model: modelName,
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
  const res = await openAi.chat.completions.create(prompt);

  let newTitle = res.choices[0].message?.content || "Untitled";

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

interface ThreadFilterStore {
  limit: number;
  offset: number;
  searchQuery: string;
  archived?: boolean;
}
interface ThreadListStore {
  error: Error | null;
  threads: FragmentSearchResult[];
}
/**
 * The thread list store includes the list of threads as well as a searchQuery to filter the list
 */
const createThreadListStore = () => {
  const filterStore = writable<ThreadFilterStore>({
    limit: 500,
    offset: 0,
    searchQuery: "",
    archived: false,
  });

  const invalidateStore = writable<number>(0);

  const invalidate = () => invalidateStore.update((x) => x + 1);

  const deffaultValue = {
    error: null,
    threads: [],
  };

  let initial = true;

  const innerStore = derived<[typeof filterStore, any], ThreadListStore>(
    [filterStore, invalidateStore],
    ([filters, _], set) => {
      // Is there no more idiomatic way to make sure an async derived store has a default value?
      if (initial) {
        initial = false;
        set(deffaultValue);
      }

      const query = filters.searchQuery.toLowerCase();
      Fragment.fullTextSearch(query, {
        archived: filters.archived,
        limit: filters.limit,
        offset: filters.offset,
      })
        .then((xs) => {
          set({ error: null, threads: xs });
        })
        .catch((err) => {
          set({ error: err, threads: [] });
        });
    }
  );

  const filter = (f: Partial<ThreadFilterStore>) => filterStore.update((x) => ({ ...x, ...f }));

  const setQuery = debounce((query: string) => {
    filter({ searchQuery: query });
  }, 64);

  return {
    filter,
    setQuery,
    subscribe: innerStore.subscribe,
    invalidate,
  };
};

export const threadList = createThreadListStore();

const pendingMessageStore = writable<ChatMessage | null>(null);

/**
 * Initially created for debugging.
 */
export const insertPendingMessage = ({ threadId = "", content = "", model = "" } = {}) => {
  if (!threadId) {
    throw new Error("No thread id provided");
  }

  if (!model) {
    throw new Error("No model provided");
  }

  pendingMessageStore.set({
    id: nanoid(),
    role: "assistant",
    model,
    createdAt: new Date(),
    content,
    threadId,
  });
};

export const inProgressMessageId = derived(pendingMessageStore, (x) => x?.id);

/**
 * Handle inbound server sent events, sent by OpenAI's API. This is how we get
 * the live-typing feel from the bot.
 */
const handleSSE = (ev: EventSourceMessage) => {
  const message = ev.data;

  console.debug("[SSE]", message);

  if (message === "[DONE]") {
    return; // Stream finished
  }

  try {
    const parsed: OpenAI.Chat.ChatCompletionChunk = JSON.parse(message);
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

export const currentlyEditingMessage = (() => {
  const store = writable<{
    id: string;
    content: string;
  } | null>(null);

  const { subscribe, set, update } = store;

  return {
    subscribe,
    set,
    update,

    /**
     * Commit pendindg changes to the message. This will update the message in the database.
     */
    commitUpdate: async () => {
      const item = get(store);

      if (!item) {
        console.warn("No item found. Cannot commit update");
        return;
      }

      await currentChatThread.updateMessage(item.id, {
        content: item.content,
      });
      set(null);
      toast({ type: "success", title: "Message updated" });
    },
  };
})();

export const messageText = writable("");

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
    if (get(pendingMessageStore)) {
      throw new Error("Already a message in progres");
    }

    const { model: modelId, systemMessage } = get(gptProfileStore);
    if (!modelId) {
      throw new Error("No model. activeProfile=" + get(activeProfileName));
    }

    const model = get(chatModels).models.find((x) => x.id === modelId);
    if (!model) {
      throw new Error("No model found for: " + modelId);
    }

    const provider = llmProviders.byId(model.provider.id);
    if (!provider) {
      throw new Error("No provider found for: " + model.provider.id);
    }

    insertPendingMessage({ threadId, model: modelId });

    const context = await ChatMessage.findThreadContext({ threadId });

    emit("chat message", { depth: context.length });

    let messageContext = context.map((x) => ({ content: x.content, role: x.role }));

    if (systemMessage.trim()) {
      messageContext = [
        {
          content: systemMessage,
          role: "system",
        },
        ...messageContext,
      ];
    }

    const prompt: OpenAI.Chat.CompletionCreateParamsStreaming = {
      messages: messageContext,
      model: modelId,
      // max_tokens: 100, // just for testing
      stream: true,
    };

    console.log("%cprompt", "color:salmon;font-size:13px;", prompt);

    abortController = new AbortController();

    // NOTE the lack of leading slash. Important for the URL to be relative to the base URL including its path
    const endpoint = new URL("chat/completions", provider.baseUrl);

    // @todo This could use the sdk now that the new version supports streaming
    await fetchEventSource(endpoint.href, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`, // This could be empty, but we assume that in such a case the server will ignore this header
      },
      method: "POST",
      body: JSON.stringify(prompt),
      signal: abortController.signal,
      onerror(err) {
        console.error("Error in stream", err);
        toast({
          type: "error",
          title: "Error in stream",
          message: err.message,
        });
        pendingMessageStore.set(null);
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
      try {
      } catch (error) {
        if (error instanceof OpenAI.APIError) {
          console.error({
            status: error.status,
            message: error.message,
            code: error.code,
            type: error.type,
          });
          toast({
            type: "error",
            title: "Error generating thread title",
            message: error.message,
          });
        } else {
          console.error(error);
          toast({
            type: "error",
            title: "Unknown error generating thread title",
            message: (error as any).message,
          });
        }
      }
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

    updateMessage: async (id: string, msg: Partial<Omit<ChatMessage, "id">>) => {
      return ChatMessage.update({
        where: { id },
        data: msg,
      });
    },

    softDeleteMessage: async ({ id }: { id: string }) => {
      await ChatMessage.softDelete({
        where: { id, threadId: get(currentThread).id },
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
      const messages = get(currentChatThread).messages;
      const lastMessage = messages.at(-1);

      if (!lastMessage) {
        throw new Error("No last message found. Empty thread?");
      }

      // Only delete the message if it's from the bot. When it's from the user
      // it usually means that there was an error in completion.
      if (lastMessage.role === "assistant") {
        await ChatMessage.delete({
          where: {
            id: lastMessage.id,
          },
        });
      }

      promptGpt({ threadId: lastMessage.threadId }).catch((err) => {
        console.error("[regenerateResponse]", err);
        toast({
          type: "error",
          title: "Error regenerating response",
          message: err.message,
        });
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

      messageText.set("");
    },

    sendMessage: async (...args: Parameters<typeof ChatMessage.create>) => {
      const [msg] = args;

      if (isNewThread({ id: msg.threadId as string })) {
        const newThread = await Thread.create({ title: PENDING_THREAD_TITLE });
        msg.threadId = newThread.id;
        currentThread.set(newThread);
        threadList.invalidate();
      }

      const newMessage = await ChatMessage.create(msg);
      const backupText = get(messageText);
      messageText.set("");

      promptGpt({ threadId: msg.threadId as string }).catch((err) => {
        console.error("[sendMessage]", err);
        toast({
          type: "error",
          title: "Error sending message",
          message: err.message,
        });
        messageText.set(backupText); // Restore backup text
        return ChatMessage.delete({ where: { id: newMessage.id } }); // Delete the message
      });
    },
  };
})();

export const syncStore = (() => {
  const store = writable<{
    pending: string[];
    established: string[];
    showSyncModal: boolean;
    connection: string;
    status: "idle" | "connecting" | "syncing" | "error";
    error: null | {
      message: string;
      detail?: string;
      _error?: Error;
    };
  }>({
    pending: [],
    established: [],
    showSyncModal: false,
    connection: "",
    status: "idle",
    error: null,
  });

  const serverConfig = persistentStore<{ endpoint: string }>("server-config", {
    endpoint: getDefaultEndpoint(),
  });

  const { subscribe, update, set } = store;

  let syncAdapter: Syncer | null = null;

  const disconnect = () => {
    openAiConfig.update((x) => ({ ...x, lastSyncChain: "" }));

    console.log("Sync disconnect");
    update((x) => ({ ...x, connection: "", status: "idle", error: null }));
    syncAdapter?.destroy();
    syncAdapter = null;
  };

  const pushChanges = async (arg?: Parameters<Syncer["pushChanges"]>[number]) => {
    if (!get(store).connection) {
      console.log("No connection enabled. Ignoring sync.");
      return;
    }

    if (!syncAdapter) {
      throw new Error("No syncer initialized. Called too early?");
    }

    return syncAdapter.pushChanges(arg);
  };

  const pullChanges = async (arg?: Parameters<Syncer["pullChanges"]>[number]) => {
    if (!get(store).connection) {
      console.log("No connection enabled. Ignoring sync.");
      return;
    }

    if (!syncAdapter || !get(store).connection) {
      throw new Error("No syncer initialized. Called too early?");
    }

    return syncAdapter.pullChanges(arg);
  };

  const healthcheck = async () => {
    const endpoint = get(serverConfig).endpoint;
    const u = new URL("/health", endpoint);
    const res = await fetch(u).then((x) => (x.ok ? x.json() : Promise.reject(x)));

    if (res.status === "ok" && res.n === 47) {
      return {
        ok: true,
      };
    } else {
      return {
        ok: false,
        detail: "Server responded but did not pass healthcheck",
      };
    }
  };

  const sync = async (arg?: Parameters<Syncer["pullChanges"]>[number]) => {
    let pulled = 0;
    let pushed = 0;

    try {
      const { ok: healthy, detail } = await healthcheck();
      if (!healthy) {
        console.error("Server is not healthy", detail);
        update((x) => ({
          ...x,
          status: "error",
          error: {
            message: "Server is not healthy",
            detail:
              "Healthcheck failed. Check the endpoint and make sure that servier is up and running.",
          },
        }));
      } else {
        pulled = (await pullChanges(arg)) || 0;
        pushed = (await pushChanges(arg)) || 0;
      }
    } catch (error) {
      update((x) => ({ ...x, status: "error", error }));
    }

    return { pulled, pushed };
  };

  const registerSchema = async (schemaName: string, content: string) => {
    const endpoint = get(serverConfig).endpoint;
    const u = new URL("/schema", endpoint);
    const res = await fetch(u, {
      method: "POST",
      body: JSON.stringify({ schemaName, content }),
      headers: {
        "Content-Type": "application/json",
      },
    }).then((x) => x.json());

    return res;
  };

  return {
    subscribe,
    update,
    set,

    /**
     * Disconnect from the current chain and dispose of the sync instance.
     */
    disconnect, // An alias...

    pullChanges,
    pushChanges,
    /**
     * Sync with the server. This is a two-way sync. Pull first, then push.
     */
    sync,
    healthcheck,

    resetSyncState: async () => {
      await syncAdapter?.resetSyncState();
    },

    serverConfig,

    async connectTo(s: string, { retries = 3, timeout = 600, autoSync = false } = {}) {
      const _db: DBAsync | null = get(db);
      if (!_db) {
        throw new Error("No db found");
      }

      update((x) => ({ ...x, status: "connecting", error: null }));

      // Make sure endpoint is up to date
      await serverConfig.init();

      console.log("ConnectTo", s, "retries", retries, "timeout", timeout, "autoSync", autoSync);
      const healthy = await healthcheck();
      if (!healthy && get(store).connection) {
        update((x) => ({
          ...x,
          error: { message: "Could not connect", detail: "Healthcheck failed" },
          status: "error",
        }));
        return;
      }

      // await _db.execO(`SELECT key, value FROM crsql_master WHERE key in ('schema_name', 'schema_version')`)
      const { schema_name } = await DatabaseMeta.getSchemaMeta();
      const { content } = await getCurrentSchema();

      const result = await registerSchema(schema_name, content);

      if (result.status === "error") {
        update((x) => ({ ...x, error: { message: result.error.message } }));
        return;
      }

      console.debug("register schema ::", schema_name, result);

      const syncEndpoint = new URL("/changes", get(serverConfig).endpoint).href;
      syncAdapter = await createSyncer({
        db: _db,
        endpoint: syncEndpoint,
        room: s,
        notify: toast,
      });

      if (syncAdapter) {
        openAiConfig.update((x) => ({ ...x, lastSyncChain: s }));
        localStorage.setItem("lastSyncChain", s);
        update((x) => ({ ...x, connection: s, error: null }));
        if (autoSync) {
          update((x) => ({ ...x, status: "syncing" }));
          await sync({ suppressNotification: false });
          update((x) => ({ ...x, status: "idle" }));
        } else {
          update((x) => ({ ...x, status: "idle" }));
        }
      } else if (retries > 0) {
        console.warn(`Sync service not initialized. Initializing and trying again...`);
        return new Promise((resolve) => setTimeout(resolve, timeout)).then(() =>
          this.connectTo(s, {
            retries: retries - 1,
            timeout,
            autoSync,
          })
        );
      } else {
        throw new Error("Could not initialize sync service");
      }
    },
  };
})();

LLMProvider.onTableChange(() => {
  console.debug("%cprovider table changed", "color:salmon;");
  llmProviders.invalidate();
});

Thread.onTableChange(() => {
  console.debug("%cthread table changed", "color:salmon;");
  threadList.invalidate();
});

ChatMessage.onTableChange(() => {
  console.debug("%cmessage table changed", "color:salmon;");
  currentChatThread.invalidate();
});

type ModelWithProvider = OpenAI.Model & { provider: { id: string } };

export const chatModels = (() => {
  const store = writable<{ loading: boolean; models: ModelWithProvider[] }>({
    loading: false,
    models: [],
  });
  const { subscribe, set, update } = store;

  return {
    subscribe,
    set,
    update,

    refresh: async () => {
      const models = get(store).models;
      if (models.length) {
        console.debug("Already have models, but refetching for latest");
      }

      const providers = get(llmProviders).providers.filter((x) => x.enabled);

      update((x) => ({ ...x, loading: true }));

      try {
        // Fetch models for all active providers
        // TODO: we need a mapping of model to provider so that we can easily access the base URL and API key
        const xss = await Promise.all(
          providers.map((provider) => {
            const openai = new OpenAI({
              apiKey: provider.apiKey,
              baseURL: provider.baseUrl,
              dangerouslyAllowBrowser: true,
            });
            return openai.models
              .list()
              .then((x) => {
                return (
                  provider.id === "openai" ? x.data.filter((x) => x.id.startsWith("gpt")) : x.data
                ).map((x) => ({ ...x, provider: { id: provider.id } }));
              })
              .catch((err) => {
                toast({
                  title: "Error fetching models for: " + provider.name,
                  message: err.message,
                  type: "error",
                });
                return [] as ModelWithProvider[];
              });
          })
        );

        const _chatModels = xss.flat();

        _chatModels.sort((a, b) => a.id.localeCompare(b.id));

        update((x) => ({ ...x, models: _chatModels }));
      } catch (error) {
        console.error("Error fetching models", error);
        toast({
          title: "Error fetching models",
          message: error.message,
          type: "error",
        });
      } finally {
        update((x) => ({ ...x, loading: false }));
      }
    },
  };
})();
