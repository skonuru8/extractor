/**
 * client.ts — OpenRouter API client (OpenAI-compatible).
 *
 * Simple fetch-based client. No SDK dependency.
 * OpenRouter uses the OpenAI /chat/completions endpoint format.
 *
 * Note: <think>...</think> blocks are stripped from all responses.
 * Qwen 3.5 Flash always emits them in the response body.
 * Stripping is a no-op for models that don't.
 */

export interface ChatMessage {
  role:    "system" | "user" | "assistant";
  content: string;
}

export interface CompletionOptions {
  model:      string;
  messages:   ChatMessage[];
  max_tokens: number;
  temperature: number;
}

export interface CompletionResult {
  content: string;
  model:   string;
}

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

  /**
   * Call OpenRouter chat completions.
   * Throws on network error or non-2xx response.
   */
export async function complete(opts: CompletionOptions): Promise<CompletionResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY environment variable not set.\n" +
      "Export it: export OPENROUTER_API_KEY=sk-or-..."
    );
  }

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization":  `Bearer ${apiKey}`,
      "Content-Type":   "application/json",
      "HTTP-Referer":   "https://github.com/job-hunter",
      "X-Title":        "job-hunter-extractor",
    },
    body: JSON.stringify({
      model:           opts.model,
      messages:        opts.messages,
      max_tokens:      opts.max_tokens,
      temperature:     opts.temperature,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenRouter API error ${response.status}: ${body}`);
  }

  const data    = await response.json() as any;
  const raw     = data?.choices?.[0]?.message?.content ?? "";
  const content = stripThinkBlocks(raw);
  const model   = data?.model ?? opts.model;

  if (!content) {
    throw new Error("OpenRouter returned empty content");
  }

  return { content, model };
}

/** Remove <think>...</think> blocks Qwen models emit in the response body. */
function stripThinkBlocks(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}
