import { Configuration, OpenAIApi } from "openai";

// Prompts curtesy of chatgpt, of course
const prompts = [
  // gpt-4:
  //  $ write a list of example prompts I can use to show off the power and utility of LLMs. short and immediately useful is best. output the list as a JSON array so I can consume it programmatically
  "Create a unique business idea combining Artificial Intelligence and Fitness",
  "Provide five tips for effective time management",
  "Suggest three innovative ways to reduce plastic usage in everyday life",
  "Draft an engaging opening paragraph for a mystery novel",
  "Explain the benefits of meditation in simple terms",
  "Offer three creative date night ideas for a long-term couple",
  "Design a fitness plan for a busy professional with limited time",
  "Write an invitation for a company's team-building event",
  "Outline a simple four-step process for goal-setting",
  "Propose a solution for reducing traffic in large cities",
  "Provide a list of five essential ingredients for a successful teamwork",
  "Offer step-by-step instructions for creating a small herb garden in an apartment",

  // gpt-3.5
  "Generate a short story about a time traveler who accidentally goes back to the Middle Ages.",
  "Write a poem about the beauty of nature in the springtime.",
  "Write a persuasive essay arguing for the benefits of renewable energy sources over fossil fuels.",
  "Generate a recipe for a vegan chocolate cake.",
  "Summarize the plot and themes of the novel 'To Kill a Mockingbird' by Harper Lee.",
  "Summarize the key events and themes of the movie 'The Godfather.'",
  "Write a brief history of the development of the internet.",
  "Summarize the key principles of the philosophy of Stoicism.",
];

export function chooseRandomPrompts() {
  const chosenPrompts: string[] = [];

  while (chosenPrompts.length < 3) {
    const randomIndex = Math.floor(Math.random() * prompts.length);
    const randomPrompt = prompts[randomIndex];
    if (!chosenPrompts.includes(randomPrompt)) {
      chosenPrompts.push(randomPrompt);
    }
  }

  return chosenPrompts;
}

let openai: OpenAIApi;
let configuration: Configuration;

export const initOpenAi = ({ apiKey = "" } = {}) => {
  if (openai) {
    return openai;
  }

  configuration = new Configuration({
    apiKey,
  });
  openai = new OpenAIApi(configuration);

  return openai;
};
