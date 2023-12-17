import { error, json, redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

/**
 * Get a list of allowed models for free use with prompta. Also do the data
 * mapping necessary to make this work with the openai SDK.
 */
export const GET: RequestHandler = async ({ url, request }) => {
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": `https://chat.prompta.dev/`, // Optional, for including your app on openrouter.ai rankings.
      "X-Title": `Prompta`, // Optional. Shows in rankings on openrouter.ai.
      "Content-Type": "application/json",
    },
  });

  const headers = {
    ...Object.fromEntries(res.headers.entries()),
  };

  // This was causing issues. Not sure why
  delete headers["content-encoding"];

  const xs = (await res.json()).data.map((x) => ({ ...x, object: "model" }));

  const freeModels = xs.filter((model: any) => {
    // I tried their in-house model and it didn't work at all. Empty responses
    if (model.id.startsWith("openrouter")) {
      return false;
    }

    return model.pricing.prompt === "0" && model.pricing.completion === "0";
  });

  return json(
    {
      object: "list",
      data: freeModels,
    },
    {
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "Cache-Control": "max-age=3600", // Cache for one hour
      },
    }
  );
};
