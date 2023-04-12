import { Configuration, OpenAIApi, type ChatCompletionResponseMessage } from "openai";

let openai: OpenAIApi;
let configuration: Configuration;

export const initOpenAi = ({ apiKey = "" }: { apiKey: string }) => {
  if (openai) {
    return openai;
  }

  configuration = new Configuration({
    apiKey,
  });
  openai = new OpenAIApi(configuration);

  return openai;
};
