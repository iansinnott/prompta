import { OpenAI, type ClientOptions } from "openai";

// NOTE The openai client is not currently cached because the opts change at
// runtime. namely the base url and api key.
export const initOpenAi = (opts: ClientOptions) => {
  return new OpenAI({
    // The app is currently all browser-based, and the key is stored locally and
    // only sent to openai.
    dangerouslyAllowBrowser: true,
    ...opts,
  });
};
