import { OpenAI, type ClientOptions } from "openai";

let openai: OpenAI;

export const initOpenAi = (opts: ClientOptions) => {
  if (openai) {
    return openai;
  }

  openai = new OpenAI({
    // The app is currently all browser-based, and the key is stored locally and
    // only sent to openai.
    dangerouslyAllowBrowser: true,
    ...opts,
  });

  return openai;
};
