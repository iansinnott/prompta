import { LLMProvider } from "$lib/db";
import { get, writable } from "svelte/store";
import { invalidatable } from "../storeUtils";
import { dev } from "$app/environment";

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
