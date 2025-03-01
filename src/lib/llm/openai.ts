import type { LLMProvider, MinimalLLMClient } from "$lib/db";
import { Anthropic } from "@anthropic-ai/sdk";
import { OpenAI, type ClientOptions } from "openai";
import { nanoid } from "nanoid";
import { env } from "$env/dynamic/public";

const headerWhitelist = new Set([
  "content-type",
  "authorization",
  "anthropic-dangerous-direct-browser-access",
]);

/**
 * A fetch wrapper to strip certain custom headers. The custom headers caused
 * CORS issues with 3-rd party providers, despite being otherwise API compatible.
 * The issue was that the SDK would specifically request those custom headers
 * as cors headers and the server would not allow them (they are custom, after all).
 * Using the defaultHeaders option in the SDK does not allow overwriting those
 * custom headers. I feel safe assuming things will still work becuase openai
 * does not document those headers as required.
 */
const openAiFetchWrapper = (url: RequestInfo, options?: RequestInit) => {
  const hs: Record<string, any> = {};

  // Filter keys. Lots of CORS servers DO NOT like the custom headers that openai SDK sets.
  // NOTE: This could be conditional on the URL being some non-openai endpoint, but this is simpler.
  // NOTE: Safari also did not like the User-Agent header, so I've adopted as whitelist approach.
  for (const [k, v] of Object.entries(options?.headers || {})) {
    if (!headerWhitelist.has(k.toLowerCase())) {
      continue;
    }
    hs[k] = v;
  }

  console.debug("OpenAI Fetch ::", (options?.method || "get").toUpperCase(), url, {
    ...hs,
    Authorization: hs.Authorization ? hs.Authorization?.slice(0, 14) + "..." : undefined,
  });

  return fetch(url, {
    ...options,
    headers: hs,
  });
};

// NOTE The openai client is not currently cached because the opts change at
// runtime. namely the base url and api key.
export const initOpenAi = (opts: ClientOptions) => {
  return new OpenAI({
    // The app is currently all browser-based, and the key is stored locally and
    // only sent to openai.
    dangerouslyAllowBrowser: true,
    fetch: openAiFetchWrapper,
    ...opts,
  });
};

export const getProviderClient = (provider: LLMProvider): MinimalLLMClient => {
  // If provider already has a client instance, return it
  if (provider.createClient) {
    return provider.createClient({
      apiKey: provider.apiKey,
      baseURL: provider.baseUrl,
    });
  }

  return initOpenAi({
    apiKey: provider.apiKey,
    baseURL: provider.baseUrl,
  });
};

export class AnthropicClient implements MinimalLLMClient {
  private anthropic: Anthropic;

  constructor(apiKey: string, baseURL?: string) {
    this.anthropic = new Anthropic({
      apiKey,
      baseURL,
      dangerouslyAllowBrowser: true,
    });
  }

  // @ts-expect-error Just deal with it TS...
  chat = {
    completions: {
      create: async (
        params:
          | OpenAI.ChatCompletionCreateParamsStreaming
          | OpenAI.ChatCompletionCreateParamsNonStreaming,
        options?: { signal?: AbortSignal }
      ) => {
        // Convert OpenAI format to Anthropic format
        const messages = params.messages.map((msg) => {
          let content;

          // Handle array content (already parsed)
          if (Array.isArray(msg.content)) {
            content = msg.content.map((item) => {
              if (item.type === "image_url") {
                // Extract base64 data from the URL
                const base64Data = item.image_url.url.split(",")[1];
                return {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/jpeg",
                    data: base64Data,
                  },
                };
              } else if (item.type === "text") {
                return {
                  type: "text",
                  text: item.text,
                };
              }
              return item;
            });
          }
          // Handle string content that might be JSON
          else if (typeof msg.content === "string" && msg.content.startsWith("[{")) {
            try {
              const parsed = JSON.parse(msg.content);
              content = parsed.map((item: any) => {
                if (item.type === "image_url") {
                  const base64Data = item.image_url.url.split(",")[1];
                  return {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: "image/jpeg",
                      data: base64Data,
                    },
                  };
                } else if (item.type === "text") {
                  return {
                    type: "text",
                    text: item.text,
                  };
                }
                return item;
              });
            } catch (e) {
              console.error("Error parsing message content:", e);
              // Fall back to treating it as plain text
              content = msg.content;
            }
          }
          // Handle plain text content
          else {
            content = msg.content;
          }

          return {
            role: msg.role === "assistant" ? "assistant" : "user",
            content,
          };
        });

        // @ts-expect-error Just deal with it TS...
        const stream = await this.anthropic.messages.create(
          {
            // @ts-ignore
            messages,
            model: params.model,
            stream: params.stream,
            max_tokens: 4096,
          },
          {
            signal: options?.signal,
          }
        );

        // Handle non-streaming case
        if (!params.stream) {
          let res = stream as Anthropic.Message;
          return {
            choices: [
              {
                message: {
                  // @ts-ignore
                  content: res.content[0].text,
                  role: res.role,
                },
                index: 0,
                logprobs: null,
                finish_reason: "stop" as const,
                id: res.id,
                model: params.model,
                object: "chat.completion",
                created: Date.now(),
                system_fingerprint: null,
              },
            ],
            id: res.id,
            model: params.model,
            object: "chat.completion",
            created: Date.now(),
            system_fingerprint: null,
          };
        }

        // Convert Anthropic stream format to OpenAI format
        return {
          async *[Symbol.asyncIterator]() {
            for await (const chunk of stream) {
              if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
                yield {
                  id: nanoid(),
                  choices: [
                    {
                      delta: {
                        content: chunk.delta?.text || "",
                      },
                    },
                  ],
                  object: "chat.completion.chunk",
                } as OpenAI.ChatCompletionChunk;
              }
            }
          },
        };
      },
    },
  };

  models = {
    list: async () => {
      const res = await this.anthropic.models.list();
      return {
        data: [
          ...res.data.map((m) => ({ id: m.id })),
          { id: "claude-3-5-sonnet-latest" },
          { id: "claude-3-5-haiku-latest" },
        ],
      };
    },
  };
}

export const promptaBaseUrl = env.PUBLIC_PROMPTA_API_URL || "https://api.prompta.dev/v1/";
if (env.PUBLIC_PROMPTA_API_URL) {
  console.log("Using Prompta API URL via env var", promptaBaseUrl);
}

export const defaultProviders: LLMProvider[] = [
  {
    id: "prompta",
    name: "Prompta",
    baseUrl: promptaBaseUrl,
    apiKey: "",
    enabled: true,
    createdAt: new Date(0),
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1/",
    apiKey: "",
    enabled: false,
    createdAt: new Date(0),
  },
  {
    id: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/",
    apiKey: "",
    enabled: false,
    createdAt: new Date(0),
    // @ts-expect-error Just deal with it TS...
    createClient: ({ apiKey, baseURL }) => {
      return new AnthropicClient(apiKey, baseURL);
    },
  },
];
