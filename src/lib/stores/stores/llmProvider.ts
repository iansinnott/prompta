import { LLMProvider } from "$lib/db";
import { get, writable } from "svelte/store";
import { invalidatable } from "../storeUtils";
import { dev } from "$app/environment";
import { OpenAI } from "openai";
import { toast } from "$lib/toast";

const defaultProviders: LLMProvider[] = [
  {
    id: "prompta",
    name: "Prompta AI",
    baseUrl: dev ? "http://localhost:5173/api/v1/" : "https://chat.prompta.dev/",
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
    set,
    update,
    subscribe,
    invalidate,

    addProvider: (provider: LLMProvider) => {
      update((state) => {
        state.providers.push(provider);
        return state;
      });
    },

    removeProvider: (id: string) => {
      update((state) => {
        state.providers = state.providers.filter((p) => p.id !== id);
        return state;
      });
      LLMProvider.delete({ where: { id } }).catch((err) => {
        console.error(err);
      });
    },

    createProvider: (provider: Partial<LLMProvider>) => {
      LLMProvider.create(provider).catch((err) => {
        console.error(err);
      });
    },

    byId: (id: string) => {
      return get(store).providers.find((p) => p.id === id);
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

      const providers = get(llmProviders).providers.filter((x) => x.enabled);

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
