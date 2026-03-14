import type { GeminiModel } from "@/types";

interface RawGeminiModel {
  name: string;
  displayName: string;
  description: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
  supportedGenerationMethods: string[];
}

export async function listGeminiModels(
  apiKey: string
): Promise<GeminiModel[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=100`;

  const res = await fetch(url);

  if (res.status === 400 || res.status === 403) {
    throw new Error("Invalid API key");
  }
  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.status}`);
  }

  const data = await res.json();
  const models: RawGeminiModel[] = data.models || [];

  return models
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .filter((m) => !m.name.includes("embedding"))
    .map((m) => ({
      name: m.name.replace("models/", ""),
      displayName: m.displayName,
      description: m.description || "",
      inputTokenLimit: m.inputTokenLimit,
      outputTokenLimit: m.outputTokenLimit,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
