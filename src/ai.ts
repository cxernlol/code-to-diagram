import type { AiProtocol, ProviderSettings } from "./types";
import { AI_USAGE_TOKENS, PROVIDERS } from "./constants";
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

function normalizeBaseUrl(baseUrl: string): string {
  const base = baseUrl
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/chat\/completions$/i, "")
    .replace(/\/messages$/i, "");
  const url = new URL(base);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("The AI endpoint must use HTTP or HTTPS.");
  }
  return base;
}

function providerProtocol(provider: ProviderSettings): AiProtocol {
  return PROVIDERS[provider.provider]?.protocol ?? "openai";
}

function buildHeaders(protocol: AiProtocol, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = apiKey.trim();
  if (protocol === "anthropic") {
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";
    if (key) headers["x-api-key"] = key;
  } else if (key) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

export async function fetchProviderModels(
  provider: ProviderSettings,
  apiKey: string,
  signal?: AbortSignal,
): Promise<string[]> {
  if (!provider.baseUrl.trim()) {
    throw new Error("Enter an AI endpoint base URL first.");
  }
  const base = normalizeBaseUrl(provider.baseUrl);
  const protocol = providerProtocol(provider);
  const headers = buildHeaders(protocol, apiKey);
  delete headers["Content-Type"];

  const response = await fetch(`${base}/models`, { method: "GET", headers, signal });
  if (!response.ok) {
    throw new Error(`Model list returned ${response.status} (${response.statusText || "error"}).`);
  }
  const parsed = (await response.json()) as {
    data?: Array<{ id?: unknown }>;
    models?: Array<{ id?: unknown; name?: unknown }>;
  };
  const ids = [
    ...(Array.isArray(parsed.data) ? parsed.data.map((m) => m?.id) : []),
    ...(Array.isArray(parsed.models) ? parsed.models.map((m) => m?.id ?? m?.name) : []),
  ].filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  return Array.from(new Set(ids));
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
  const base = normalizeBaseUrl(provider.baseUrl);
  const protocol = providerProtocol(provider);
  const headers = buildHeaders(protocol, apiKey);
  const usage = provider.usage ?? "medium";
  const maxTokens = AI_USAGE_TOKENS[usage]?.maxTokens ?? AI_USAGE_TOKENS.medium.maxTokens;
  const endpointUrl = protocol === "anthropic" ? `${base}/messages` : `${base}/chat/completions`;
  const body: Record<string, unknown> =
    protocol === "anthropic"
      ? {
          model: provider.model.trim(),
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: prompt }],
          stream: true,
        }
      : {
          model: provider.model.trim(),
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
          max_tokens: maxTokens,
          stream: true,
        };

  const response = await fetch(endpointUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const raw = (await response.text()).trim();
    let detail = response.statusText;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { error?: { message?: string }; message?: string };
        detail = parsed?.error?.message || parsed?.message || raw.slice(0, 240);
      } catch {
        detail = raw.slice(0, 240);
      }
    }
    throw new Error(`AI provider returned ${response.status}: ${detail}`);
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
      if (!payload || payload === "[DONE]") {
        if (payload === "[DONE]") {
          onText(cleanModelText(fullText));
          return cleanModelText(fullText);
        }
        continue;
      }
      let chunk: {
        type?: string;
        error?: { message?: string };
        delta?: { type?: string; text?: string };
        choices?: Array<{ delta?: { content?: string | Array<{ text?: string }> } }>;
      };
      try {
        chunk = JSON.parse(payload) as typeof chunk;
      } catch (error) {
        throw new Error("The AI provider returned malformed streaming data.", { cause: error });
      }
      if (chunk.type === "error" && chunk.error?.message) {
        throw new Error(chunk.error.message);
      }
      if (chunk.type === "message_stop") {
        onText(cleanModelText(fullText));
        return cleanModelText(fullText);
      }
      if (chunk.type === "content_block_delta" && chunk.delta?.type === "text_delta" && typeof chunk.delta.text === "string") {
        fullText += chunk.delta.text;
      } else {
        const content = chunk.choices?.[0]?.delta?.content;
        if (typeof content === "string") fullText += content;
        else if (Array.isArray(content)) {
          fullText += content.map((part) => part.text ?? "").join("");
        }
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
