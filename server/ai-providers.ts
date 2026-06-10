// The AI provider abstraction. If ANTHROPIC_API_KEY or OPENAI_API_KEY is set the
// matching provider is used, otherwise the deterministic MockProvider returns
// realistic canned output so every AI feature works offline. Callers always pass
// PHI-redacted text, the provider never sees raw identifiers.

export interface AIProvider {
  name: string;
  chat(system: string, user: string): Promise<string>;
  // Optional vision call. Present only on providers that support images.
  vision?(system: string, user: string, imageBase64: string, mediaType: string): Promise<string>;
}

class MockProvider implements AIProvider {
  name = "mock";
  // The mock echoes a structured, clinically phrased completion built from the
  // redacted prompt. It is deterministic and offline.
  async chat(_system: string, user: string): Promise<string> {
    return user; // the feature layer composes the mock output itself
  }
}

class AnthropicProvider implements AIProvider {
  name = "anthropic";
  constructor(private key: string, private model = "claude-opus-4-8") {}
  async chat(system: string, user: string): Promise<string> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
    const data = await res.json();
    // Find the text block. With thinking omitted on Opus 4.8 the text block is
    // first, but search rather than assume, to stay robust across models.
    const block = (data.content ?? []).find((b: { type: string }) => b.type === "text");
    return block?.text ?? "";
  }

  // Vision: send an image plus text and read back the text response.
  async vision(system: string, user: string, imageBase64: string, mediaType: string): Promise<string> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 2048,
        system,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
            { type: "text", text: user },
          ],
        }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic vision error ${res.status}`);
    const data = await res.json();
    const block = (data.content ?? []).find((b: { type: string }) => b.type === "text");
    return block?.text ?? "";
  }
}

class OpenAIProvider implements AIProvider {
  name = "openai";
  constructor(private key: string, private model = "gpt-4o") {}
  async chat(system: string, user: string): Promise<string> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.key}` },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  }
}

let cached: AIProvider | null = null;

export function getProvider(): AIProvider {
  if (cached) return cached;
  if (process.env.ANTHROPIC_API_KEY) {
    cached = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
  } else if (process.env.OPENAI_API_KEY) {
    cached = new OpenAIProvider(process.env.OPENAI_API_KEY);
  } else {
    cached = new MockProvider();
  }
  return cached;
}

export function isMock(): boolean {
  return getProvider().name === "mock";
}
