/**
 * ai/provider.ts — thin, dependency-free AI provider abstraction.
 *
 * Supports OpenAI- and Anthropic-compatible chat APIs via `fetch` (no SDK). The
 * rest of the app never talks to a provider directly: it calls `generateText()`
 * / `isAiConfigured()` so features degrade gracefully to deterministic logic when
 * no key is present. We NEVER fabricate model output — when unconfigured,
 * `generateText()` returns null and callers use their rule-based fallback.
 *
 * To enable AI, set ONE of these in the environment (server-side only):
 *   AI_PROVIDER=openai      OPENAI_API_KEY=sk-...      [OPENAI_MODEL=gpt-4o-mini]
 *   AI_PROVIDER=anthropic   ANTHROPIC_API_KEY=sk-ant-… [ANTHROPIC_MODEL=claude-haiku-4-5-20251001]
 * If AI_PROVIDER is unset it is inferred from whichever key is present.
 */

export type AiProvider = "openai" | "anthropic"

export interface AiConfig {
  provider: AiProvider
  apiKey: string
  model: string
}

/** Resolve provider config from env, or null when no key is configured. */
export function getAiConfig(): AiConfig | null {
  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase()
  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim()

  if ((explicit === "openai" || (!explicit && openaiKey)) && openaiKey) {
    return { provider: "openai", apiKey: openaiKey, model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini" }
  }
  if ((explicit === "anthropic" || (!explicit && anthropicKey)) && anthropicKey) {
    return {
      provider: "anthropic",
      apiKey: anthropicKey,
      model: process.env.ANTHROPIC_MODEL?.trim() || "claude-haiku-4-5-20251001",
    }
  }
  return null
}

export function isAiConfigured(): boolean {
  return getAiConfig() !== null
}

/**
 * Generate a plain-text completion. Returns null when unconfigured or on any
 * error/timeout — callers must have a deterministic fallback. Never throws.
 */
export async function generateText(
  prompt: string,
  opts: { system?: string; maxTokens?: number; timeoutMs?: number } = {}
): Promise<string | null> {
  const cfg = getAiConfig()
  if (!cfg) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000)
  try {
    if (cfg.provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({
          model: cfg.model,
          max_tokens: opts.maxTokens ?? 700,
          messages: [
            ...(opts.system ? [{ role: "system", content: opts.system }] : []),
            { role: "user", content: prompt },
          ],
        }),
        signal: controller.signal,
      })
      if (!res.ok) return null
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
      return json.choices?.[0]?.message?.content?.trim() || null
    }

    // anthropic
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": cfg.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: opts.maxTokens ?? 700,
        ...(opts.system ? { system: opts.system } : {}),
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    })
    if (!res.ok) return null
    const json = (await res.json()) as { content?: { text?: string }[] }
    return json.content?.map((c) => c.text || "").join("").trim() || null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
