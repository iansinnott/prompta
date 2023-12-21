import { error, json, redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// const defaultModel = "rwkv/rwkv-5-world-3b";
const defaultModel = "gryphe/mythomist-7b";

const isModelWhitelisted = (modelName: string) => {
  // TODO if this changes or new free models come online we would want this to
  // be updated. Could make a build step to create this array
  const freeModels = new Set([
    // This are roughly ordered by my subjective interpretation of how good they are
    "nousresearch/nous-capybara-7b",
    "huggingfaceh4/zephyr-7b-beta",
    "gryphe/mythomist-7b",
    "rwkv/rwkv-5-world-3b",
    "recursal/rwkv-5-3b-ai-town",
    "openchat/openchat-7b",

    // I've separated out the instruct models, although they are good
    "mistralai/mistral-7b-instruct",
    "mistralai/mixtral-8x7b-instruct",
  ]);

  return freeModels.has(modelName);
};

/**
 * Provide free LLM access to Prompta users via the openrouter free tier. The
 * main thing unusal here is that openrouter sends invalid SSE events. This
 * endpoint strips those out.
 */
export const POST: RequestHandler = async ({ url, request }) => {
  const body = await request.json();
  let { messages, stream = false, model = defaultModel, temperature = "0.2" } = body;

  if (!isModelWhitelisted(model)) {
    console.error(`[chat] unknown model: ${model}`);
    return json({ error: `Unknown model: ${model}` }, { status: 400 });
  }

  if (typeof temperature === "string") temperature = parseFloat(temperature);

  // @todo Store more information about the requester somewhere. IP address if nothing else.

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": `https://chat.prompta.dev/`, // Optional, for including your app on openrouter.ai rankings.
      "X-Title": `Prompta`, // Optional. Shows in rankings on openrouter.ai.
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: messages,
      temperature,
      stream,
    }),
  });

  const headers = {
    ...Object.fromEntries(res.headers.entries()),
  };

  // This was causing issues. Not sure why
  delete headers["content-encoding"];

  // For non-streamed responses, there's nothing more to do
  if (!stream) {
    const x = await res.json();
    console.error(`[chat] stream erreor: ${model}`, x);
    return json(x, {
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
    });
  }

  if (!res.body) {
    console.error(`[chat] no response stream: ${model}`);
    return json({ error: `No response stream` }, { status: 400 });
  }

  const decoder = new TextDecoder("utf-8");

  // Open router comes back with "comments" which are invalid. Strip them out
  const xform = new TransformStream<Uint8Array, string>({
    start() {},
    transform(chunk, controller) {
      const s = decoder.decode(chunk);
      if (/^(id|data|event):/.test(s)) {
        controller.enqueue(s);
      } else {
        console.log("[ignore] invalid stream event", s);
      }
    },
  });

  const responseStream = res.body.pipeThrough(xform);

  return new Response(responseStream, {
    headers: {
      ...headers,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
