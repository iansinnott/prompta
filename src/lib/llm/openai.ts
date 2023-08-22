import { OpenAI } from "openai";

let openai: OpenAI;

export const initOpenAi = ({ apiKey = "" }: { apiKey: string }) => {
  if (openai) {
    return openai;
  }

  openai = new OpenAI({
    apiKey,

    // The app is currently all browser-based, and the key is stored locally and
    // only sent to openai.
    dangerouslyAllowBrowser: true,
  });

  return openai;
};
