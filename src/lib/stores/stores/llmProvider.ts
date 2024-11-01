import { DatabaseMeta, LLMProvider, type MinimalLLMClient } from "$lib/db";
import { get, writable } from "svelte/store";
import type { ClientOptions, OpenAI } from "openai";
import { toast } from "$lib/toast";
import { gptProfileStore } from "./llmProfile";
import { showSettings } from ".";
import IconOpenAi from "$lib/components/IconOpenAI.svelte";
import IconBrain from "$lib/components/IconBrain.svelte";
import IconAnthropic from "$lib/components/IconAnthropic.svelte";

import { defaultProviders, getProviderClient } from "$lib/llm/openai";

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
  const initialProviders = defaultProviders.map((x) => {
    // Get both enabled state and API key from localStorage
    const storedApiKey = localStorage.getItem(`llm-provider-${x.id}-apiKey`);
    const isEnabled = localStorage.getItem(`llm-provider-${x.id}-enabled`) !== "false";

    return {
      ...x,
      enabled: isEnabled,
      // Use stored API key if it exists, otherwise keep default empty string
      apiKey: storedApiKey || x.apiKey,
    };
  });

  const store = writable<{ providers: LLMProvider[] }>({ providers: initialProviders });
  const { set, update, subscribe } = store;

  const invalidate = async () => {
    await LLMProvider.findMany({
      orderBy: { createdAt: "ASC" },
    })
      .then((providers) => {
        update((state) => {
          return {
            ...state,
            // NOTE: When updating state we don't want to add database providers
            // multiple times to the same array. Probably should not separate
            // out the default providers from the database providers as i did.
            // Adds complexity like this where we need to merge them rather than
            // just using one source of truth.
            providers: [...state.providers.filter(isDefaultProvider), ...providers],
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
        console.error("delete llm provider", err);
      });
      await chatModels.refresh();
    },

    createProvider: async (provider: Partial<LLMProvider>) => {
      const result = await LLMProvider.create(provider).catch((err) => {
        console.error(err);
      });
      await llmProviders.removeProvider("new");
      return result;
    },

    byId: (id: string) => {
      const provider = get(store).providers.find((p) => p.id === id);
      return provider;
    },

    getOpenAi: () => {
      return get(store).providers.find((p) => p.id === "openai")!;
    },

    getAnthropic: () => {
      return get(store).providers.find((p) => p.id === "anthropic")!;
    },

    /**
     * Returns a list of special providers that are not in the database. These
     * are actually just buttons that are used to aid discoverability.
     */
    getSpecialProviders: () => {
      const models = get(chatModels).models;
      const providers = [
        ...(models.length
          ? []
          : [
              {
                value: "prompta",
                label: "Enable Prompta",
                icon: { component: IconBrain },
                provider: llmProviders.byId("prompta")!,
                isFavorite: false,
              },
            ]),
        ...(llmProviders.getOpenAi().apiKey || !llmProviders.getOpenAi().enabled
          ? []
          : [
              {
                value: "openai",
                label: "OpenAI (gpt-4o, o1, ...)",
                icon: { component: IconOpenAi },
                provider: llmProviders.getOpenAi(),
                isFavorite: false,
              },
            ]),
        ...(!llmProviders.byId("anthropic")?.apiKey || !llmProviders.byId("anthropic")?.enabled
          ? [
              {
                value: "anthropic",
                label: "Anthropic (opus, sonnet, ...)",
                icon: { component: IconAnthropic },
                provider: llmProviders.byId("anthropic")!,
              },
            ]
          : []),
      ];

      return providers;
    },

    updateProvider: async (id: string, provider: Partial<LLMProvider>) => {
      if (isDefaultProvider({ id })) {
        update((state) => {
          const index = state.providers.findIndex((p) => p.id === id);

          if (index !== -1) {
            const nextVal = { ...state.providers[index], ...provider };
            state.providers[index] = nextVal;

            // Store both enabled state and API key
            localStorage.setItem(`llm-provider-${id}-enabled`, nextVal.enabled ? "true" : "false");
            if (provider.apiKey !== undefined) {
              // Only update if apiKey is in the update
              localStorage.setItem(`llm-provider-${id}-apiKey`, provider.apiKey);
            }
          } else {
            console.error(`Provider with id ${id} not found`);
          }

          // Keep the legacy store in sync
          if (id === "openai" && provider.apiKey !== undefined) {
            openAiConfig.update((x) => ({ ...x, apiKey: provider.apiKey }));
          }

          return state;
        });
      } else {
        console.log("Updating provider", id, provider);
        await LLMProvider.update({
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

      // Make sure providers are up to date
      await llmProviders.invalidate();

      const providers = get(llmProviders)
        .providers.filter((x) => x.enabled)
        .filter((x) => {
          // These providers are present without being added, so we don't fetch for them unless they have an API key
          if ((x.id === "openai" || x.id === "anthropic") && !x.apiKey) {
            console.debug(
              `${x.name} filtered out of providers because no API key. Implicitly disabled`
            );
            return false;
          }

          return true;
        });

      console.debug(
        "refreshing providers",
        providers.map((x) => x.name)
      );

      update((x) => ({ ...x, loadingState: "loading", error: null }));

      try {
        // Fetch models for all active providers
        const xss = await Promise.all(
          providers.map((provider) => {
            const client = getProviderClient(provider);

            return client.models
              .list()
              .then((x) => {
                // OpenAI has a lot of non-LLM models that we don't want to show since the system doesn't support them
                return (
                  provider.id === "openai"
                    ? x.data.filter(
                        (x) =>
                          !["dall-e", "babbage", "whisper", "tts", "embedding"].some((y) =>
                            x.id.includes(y)
                          )
                      )
                    : x.data
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

        update((x) => ({
          ...x,
          models: _chatModels as ModelWithProvider[],
          loadingState: "loaded",
          error: null,
        }));

        // Handle the edge case where the user removes the provider of a model they were using
        const currentProfile = get(gptProfileStore);
        if (!_chatModels.some((x) => x.id === currentProfile.model)) {
          const nextModel = _chatModels[0];
          if (nextModel) {
            toast({
              title: "Model not found",
              message: `The model you were using (${currentProfile.model}) was not found. Defaulting to the next available model (${nextModel.id}).`,
              type: "info",
            });
            console.warn(
              `Model not found: ${currentProfile.model}. Defaulting to ${_chatModels[0].id}`
            );
            gptProfileStore.set({ ...currentProfile, model: _chatModels[0].id });
          } else {
            toast({
              title: "No active LLM providers",
              message: `Please enable at least one LLM provider in the settings to use the app.`,
              type: "error",
            });
            showSettings.set(true);
          }
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

export const modelPickerOpen = writable(false);
