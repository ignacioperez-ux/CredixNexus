// Integracion real con la API de Anthropic (Claude). Server-only.
// SIN MOCK: si no hay ANTHROPIC_API_KEY, devuelve ai_not_configured (no inventa).

export const DEFAULT_MODEL = "claude-sonnet-5";

export type ClaudeResult =
  | { ok: true; text: string; model: string; usage: { input: number; output: number } }
  | { ok: false; error: "ai_not_configured" | "ai_error"; detail?: string };

export async function callClaude(params: {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
}): Promise<ClaudeResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: "ai_not_configured" };

  const model = params.model ?? DEFAULT_MODEL;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: params.maxTokens ?? 1024,
        system: params.system,
        messages: [{ role: "user", content: params.user }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: "ai_error", detail: detail.slice(0, 400) };
    }
    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n").trim();
    if (!text) return { ok: false, error: "ai_error", detail: "empty_response" };
    return {
      ok: true,
      text,
      model,
      usage: { input: data.usage?.input_tokens ?? 0, output: data.usage?.output_tokens ?? 0 },
    };
  } catch (e) {
    return { ok: false, error: "ai_error", detail: e instanceof Error ? e.message : "unknown" };
  }
}
