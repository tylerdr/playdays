import { openai } from "@ai-sdk/openai";

export function hasOpenAIKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getOpenAIModel() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for this route.");
  }

  return openai(process.env.PLAYDAYS_OPENAI_MODEL ?? "gpt-4.1-mini");
}
