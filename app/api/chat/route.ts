import Anthropic from "@anthropic-ai/sdk";
import {
  CHAT_TOOLS,
  CHAT_SYSTEM_PROMPT,
  runTool,
} from "@/lib/chat";
import { answerLocally } from "@/lib/nlp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-opus-4-8";
const MAX_TURNS = 8;

type IncomingMessage = { role: "user" | "assistant"; content: string };

function sse(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Split text into small whitespace-preserving chunks for a streamed feel. */
function* chunkText(text: string, wordsPerChunk = 4): Generator<string> {
  const parts = text.split(/(\s+)/);
  let buffer = "";
  let words = 0;
  for (const part of parts) {
    buffer += part;
    if (part.trim().length > 0) words++;
    if (words >= wordsPerChunk) {
      yield buffer;
      buffer = "";
      words = 0;
    }
  }
  if (buffer) yield buffer;
}

/**
 * GET /api/chat — lets the client know which engine will answer, so the UI
 * can be honest about it (no Anthropic key configured -> local NLP only,
 * no LLM call is ever made).
 */
export async function GET() {
  const engine = process.env.ANTHROPIC_API_KEY ? "llm" : "nlp";
  return Response.json({ engine, model: engine === "llm" ? MODEL : null });
}

export async function POST(request: Request) {
  let body: { messages?: IncomingMessage[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const messages: Anthropic.MessageParam[] = incoming
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .map((m) => ({ role: m.role, content: m.content }));

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return Response.json(
      { error: "Send at least one user message; the last message must be from the user." },
      { status: 400 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(sse(obj)));

      if (!apiKey) {
        // No Anthropic key configured — answer with the local NLP harness.
        // No network call, no LLM, fully deterministic against the dataset.
        try {
          const plainMessages = messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: typeof m.content === "string" ? m.content : "",
          }));
          const answer = answerLocally(plainMessages);
          for (const name of answer.toolsUsed) send({ type: "tool", name });
          if (answer.toolsUsed.length) await sleep(150);
          for (const chunk of chunkText(answer.text)) {
            send({ type: "text", text: chunk });
            await sleep(18);
          }
        } catch (err) {
          send({
            type: "error",
            message: `Local NLP engine failed: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
        send({ type: "done" });
        controller.close();
        return;
      }

      const client = new Anthropic({ apiKey });

      try {
        for (let turn = 0; turn < MAX_TURNS; turn++) {
          const modelStream = client.messages.stream({
            model: MODEL,
            max_tokens: 16000,
            system: CHAT_SYSTEM_PROMPT,
            thinking: { type: "adaptive" },
            tools: CHAT_TOOLS as unknown as Anthropic.Tool[],
            messages,
          });

          modelStream.on("text", (delta) => send({ type: "text", text: delta }));

          const message = await modelStream.finalMessage();
          messages.push({ role: "assistant", content: message.content });

          if (message.stop_reason !== "tool_use") break;

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of message.content) {
            if (block.type === "tool_use") {
              send({ type: "tool", name: block.name });
              let output: unknown;
              try {
                output = runTool(
                  block.name,
                  (block.input ?? {}) as Record<string, unknown>
                );
              } catch (err) {
                output = {
                  error: `Tool failed: ${err instanceof Error ? err.message : String(err)}`,
                };
              }
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify(output),
              });
            }
          }
          messages.push({ role: "user", content: toolResults });
        }
        send({ type: "done" });
      } catch (err) {
        const status =
          err instanceof Anthropic.APIError ? err.status : undefined;
        let msg = "Something went wrong talking to the model.";
        if (err instanceof Anthropic.AuthenticationError) {
          msg = "The ANTHROPIC_API_KEY was rejected (401). Check the key in web/.env.local.";
        } else if (err instanceof Anthropic.RateLimitError) {
          msg = "Rate limited (429). Wait a moment and try again.";
        } else if (err instanceof Anthropic.APIError) {
          msg = `Model API error${status ? ` (${status})` : ""}: ${err.message}`;
        }
        send({ type: "error", message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
