import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";

const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5";
const LEGACY_ANTHROPIC_MODEL_ALIASES: Record<string, string> = {
  "claude-3-5-haiku-20241022": DEFAULT_ANTHROPIC_MODEL,
};

export function hasOpenAIKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function hasAnthropicKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function hasAIKey() {
  return hasAnthropicKey() || hasOpenAIKey();
}

function getAnthropicModelId() {
  const configuredModel =
    process.env.PLAYDAYS_ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;

  return LEGACY_ANTHROPIC_MODEL_ALIASES[configuredModel] ?? configuredModel;
}

export function getOpenAIModel() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for this route.");
  }

  return openai(process.env.PLAYDAYS_OPENAI_MODEL ?? "gpt-4.1-mini");
}

export function getChatModel() {
  if (hasAnthropicKey()) {
    return anthropic(getAnthropicModelId());
  }

  if (hasOpenAIKey()) {
    return getOpenAIModel();
  }

  throw new Error("ANTHROPIC_API_KEY or OPENAI_API_KEY is required for chat.");
}
