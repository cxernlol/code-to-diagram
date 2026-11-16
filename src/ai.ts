import type { ProviderSettings } from "./types";
import { parseMermaid } from "./lib/mermaid";

export interface AiRequest {
  provider: ProviderSettings;
  apiKey: string;
  system: string;
  prompt: string;
  signal: AbortSignal;
  onText: (text: string) => void;
}

export function cleanModelText(value: string): string {
  return value
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/i, "")
    .trim();
}

export function cleanMermaidCode(value: string): string {
  const cleaned = cleanModelText(value);
  const fenced = cleaned.match(/```(?:mermaid)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? cleaned).trim();
}

function endpoint(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, "").replace(/\/chat\/completions$/i, "");
  const url = new URL(base);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("The AI endpoint must use HTTP or HTTPS.");
  }
  return `${base}/chat/completions`;
}

export async function requestAiText({
  provider,
  apiKey,
  system,
  prompt,
  signal,
  onText,
}: AiRequest): Promise<string> {
  if (!provider.baseUrl.trim() || !provider.model.trim()) {
    throw new Error("Enter an AI endpoint and model in AI settings.");
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;
  const body: Record<string, unknown> = {
    model: provider.model.trim(),
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    stream: true,
  };
  if (provider.temperature !== null) body.temperature = provider.temperature;

  const response = await fetch(endpoint(provider.baseUrl), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const message = (await response.text()).slice(0, 400);
    throw new Error(`AI provider returned ${response.status}: ${message || response.statusText}`);
  }
  if (!response.body) throw new Error("The AI provider returned no response stream.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    if (done && buffer) buffer += "\n";
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") {
        onText(cleanModelText(fullText));
        return cleanModelText(fullText);
      }
      let chunk: {
        choices?: Array<{ delta?: { content?: string | Array<{ text?: string }> } }>;
      };
      try {
        chunk = JSON.parse(payload) as typeof chunk;
      } catch (error) {
        throw new Error("The AI provider returned malformed streaming data.", { cause: error });
      }
      const content = chunk.choices?.[0]?.delta?.content;
      if (typeof content === "string") fullText += content;
      else if (Array.isArray(content)) {
        fullText += content.map((part) => part.text ?? "").join("");
      }
      onText(cleanModelText(fullText));
    }
    if (done) return cleanModelText(fullText);
  }
}

export function parseStructuredDiagrams(
  output: string,
): { overview: string; diagrams: Array<{ name: string; code: string }> } {
  const cleaned = cleanModelText(output).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let value: unknown;
  try {
    value = JSON.parse(cleaned);
  } catch (error) {
    throw new Error(
      `The AI response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!value || typeof value !== "object") {
    throw new Error("The AI response must be a JSON object.");
  }
  const result = value as { overview?: unknown; diagrams?: unknown };
  if (typeof result.overview !== "string" || !Array.isArray(result.diagrams)) {
    throw new Error("The AI response must contain an overview and a diagrams array.");
  }
  const diagrams = result.diagrams.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const diagram = item as { name?: unknown; code?: unknown };
    if (typeof diagram.name !== "string" || typeof diagram.code !== "string") return [];
    const name = diagram.name.trim().slice(0, 80);
    const code = cleanMermaidCode(diagram.code);
    return name && code ? [{ name, code }] : [];
  });
  if (!diagrams.length) {
    throw new Error("Add at least one named Mermaid diagram to the diagrams array.");
  }
  return { overview: cleanMermaidCode(result.overview), diagrams };
}

export async function validateMermaid(code: string): Promise<void> {
  if (!code.trim()) throw new Error("A Mermaid diagram cannot be empty.");
  await parseMermaid(code);
}
