import { DatabaseMeta, LLMProvider } from "$lib/db";
import { get, writable } from "svelte/store";
import { invalidatable } from "../storeUtils";
import { dev } from "$app/environment";
import { OpenAI, type ClientOptions } from "openai";
import { toast } from "$lib/toast";
import { gptProfileStore } from "./llmProfile";

const defaultProviders: LLMProvider[] = [
  {
    id: "prompta",
    name: "Prompta",
    baseUrl: "https://api.prompta.dev/v1/",
    apiKey: "",
    enabled: true,
    createdAt: new Date(0),
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1/",
    apiKey: "",
    enabled: true,
    createdAt: new Date(0),
  },
];

type OpenAiAppConfig = Partial<ClientOptions> & {
  siteId: string;
  lastSyncChain: string;
};

/**
 * This is the legacy store for openai data. I'm still using it in order to
 * preserve backwards compat. Existing users, including myself, shouldn't have to
 * reconfigure when this major update ships.
 *
 * @deprecated
 * Use llmProviders instead. This is only here for backwards compatibility.
 */
export const openAiConfig = (() => {
  const defaultConfig: OpenAiAppConfig = {
    apiKey: "",
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
    },
  };
})();

export const isDefaultProvider = ({ id }: { id: string }) => {
  return defaultProviders.some((p) => p.id === id);
};

export const llmProviders = (() => {
  const store = writable<{ providers: LLMProvider[] }>({ providers: defaultProviders });
  const { set, update, subscribe } = store;

  const invalidate = () => {
    LLMProvider.findMany({
      orderBy: { createdAt: "ASC" },
    })
      .then((providers) => {
        update((state) => {
          return {
            ...state,
            providers: [...state.providers, ...providers],
          };
        });
      })
      .catch((err) => {
        console.error(err);
      });
  };

  return {
    // Not tiggered above because it must wait for database to be initialized
    init: async () => invalidate(),
    set,
    update,
    subscribe,
    invalidate,

    addNewProvider: () => {
      const provider = {
        id: "new",
        name: "New Provider",
        baseUrl: "",
        apiKey: "",
        enabled: false,
        createdAt: new Date(),
      };
      update((state) => {
        state.providers.push(provider);
        return state;
      });
    },

    removeProvider: async (id: string) => {
      update((state) => {
        state.providers = state.providers.filter((p) => p.id !== id);
        return state;
      });
      await LLMProvider.delete({ where: { id } }).catch((err) => {
        console.error(err);
      });
      await chatModels.refresh();
    },

    createProvider: (provider: Partial<LLMProvider>) => {
      return LLMProvider.create(provider).catch((err) => {
        console.error(err);
      });
    },

    byId: (id: string) => {
      return get(store).providers.find((p) => p.id === id);
    },

    getOpenAi: () => {
      return get(store).providers.find((p) => p.id === "openai")!;
    },

    updateProvider: (id: string, provider: Partial<LLMProvider>) => {
      if (isDefaultProvider({ id })) {
        update((state) => {
          const index = state.providers.findIndex((p) => p.id === id);

          if (index !== -1) {
            state.providers[index] = { ...state.providers[index], ...provider };
          } else {
            console.error(`Provider with id ${id} not found`);
          }

          // Keep the other openai store in sync for now
          if (id === "openai") {
            openAiConfig.update((x) => ({ ...x, apiKey: provider.apiKey }));
          }

          return state;
        });
      } else {
        LLMProvider.update({
          where: { id },
          data: provider,
        }).catch((err) => {
          console.error(err);
        });
      }
    },
  };
})();

type ModelWithProvider = OpenAI.Model & { provider: { id: string } };

type LLMModelFiniteState = "init" | "loading" | "loaded" | "error";

interface ErrorWithDetails {
  message: string;
  details?: any;
  error: Error | null;
}

export const chatModels = (() => {
  let loadingState: LLMModelFiniteState = "init";
  let models: ModelWithProvider[] = [];
  let error: ErrorWithDetails | null = null;
  const lsKey = "chatModels";

  try {
    const s = localStorage.getItem(lsKey);
    if (s) {
      const x = JSON.parse(s);
      if (Array.isArray(x)) {
        models = x;
      }
      loadingState = "loaded";
    }
  } catch (e) {
    loadingState = "error";
    error = {
      message: "Error loading models from local storage",
      error: e,
    };
  }

  const store = writable<{
    loadingState: LLMModelFiniteState;
    models: ModelWithProvider[];
    error: ErrorWithDetails | null;
  }>({
    loadingState,
    models,
    error,
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

      const providers = get(llmProviders)
        .providers.filter((x) => x.enabled)
        .filter((x) => {
          if (x.id === "openai" && !x.apiKey) {
            console.debug("OpenAI filter out of providers because no API key. Implicitly disabled");
            return false;
          }

          return true;
        });

      update((x) => ({ ...x, loadingState: "loading", error: null }));

      try {
        // Fetch models for all active providers
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
                console.error("Error fetching models", err);
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

        update((x) => ({ ...x, models: _chatModels, loadingState: "loaded", error: null }));

        // Handle the edge case where the user removes the provider of a model they were using
        const currentProfile = get(gptProfileStore);
        if (!_chatModels.some((x) => x.id === currentProfile.model)) {
          toast({
            title: "Model not found",
            message: `The model you were using (${currentProfile.model}) was not found. Defaulting to the next available model (${_chatModels[0].id}).`,
            type: "info",
          });
          console.warn(
            `Model not found: ${currentProfile.model}. Defaulting to ${_chatModels[0].id}`
          );
          gptProfileStore.set({ ...currentProfile, model: _chatModels[0].id });
        }

        localStorage.setItem(lsKey, JSON.stringify(_chatModels));
      } catch (e) {
        console.error("Error fetching models", e);
        toast({
          title: "Error fetching models",
          message: e.message,
          type: "error",
        });
        update((x) => ({ ...x, loadingState: "error", error: { message: e.message, error: e } }));
      }
    },
  };
})();
