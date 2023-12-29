import { initOpenAi } from "$lib/llm/openai";
import { writable, derived, get } from "svelte/store";
import { persistentStore } from "../storeUtils";
import { chatModels, llmProviders, openAiConfig } from "./llmProvider";

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
    model: "prompta/nous-hermes-llama2-13b", // Default for new users. Existing users should retain persisted choice of openai gpt-*
    systemMessage: DEFAULT_SYSTEM_MESSAGE,
  },
});

/**
 * @deprecated
 * This was never used dfor its intended purpose of allowing different profiles.
 * It may be best to either remove it or implement it fully. However, the UX of
 * multiple profiles is not clear. Would take some consideration.
 *
 * That said, this store is still actively used and removing it would also take work.
 */
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

/**
 * Get the OpenAI SDK instance, which may point at another provider. It's
 * important to note that this doesn't necessarily call openai.com.
 */
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

export const verifyOpenAICompatibileProvider = async ({
  apiKey,
  baseUrl,
}: {
  apiKey?: string;
  baseUrl: string;
}) => {
  const authHeaders: Record<string, string> = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};

  // Ping the models endpoint to verify the api key
  try {
    await fetch(new URL("models", baseUrl).href, {
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
    }).then((x) => (x.ok ? x.json() : Promise.reject(x)));
    return true;
  } catch (err) {
    console.error("Could not verify api key. Likely invalid", err);
    return false;
  }
};

/**
 * This is something of a legacy function. Initially it was for openai only, but
 * i genericized it to check other endpoints.
 */
export const verifyOpenAiApiKey = async (apiKey: string) => {
  const conf = llmProviders.getOpenAi();
  const baseUrl = conf.baseUrl;
  return verifyOpenAICompatibileProvider({ apiKey, baseUrl });
};
