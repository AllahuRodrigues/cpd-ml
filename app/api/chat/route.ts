import Anthropic from "@anthropic-ai/sdk";
import {
  CHAT_TOOLS,
  CHAT_SYSTEM_PROMPT,
  runTool,
} from "@/lib/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-opus-4-8";
const MAX_TURNS = 8;

type IncomingMessage = { role: "user" | "assistant"; content: string };

function sse(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
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
        send({
          type: "text",
          text:
            "The chat assistant isn't configured yet. Add an `ANTHROPIC_API_KEY` to `web/.env.local` and restart the dev server:\n\n```\nANTHROPIC_API_KEY=sk-ant-...\n```\n\nAll the dashboard tabs (Overview, Inventory, Theme Matrix, Evidence, IRRF Linkage Review, Manual Review List) work without a key — only this chat needs one.",
        });
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
