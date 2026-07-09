"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

type Role = "user" | "assistant";
interface Msg {
  role: Role;
  content: string;
  /** Names of tools the assistant looked up while producing this turn. */
  tools?: string[];
}

const SUGGESTIONS = [
  "Which countries score 4 on Justice?",
  "Why does Mali score the way it does on Rule of Law?",
  "Summarise the underreporting signal for Human Rights.",
  "How many CPDs have no theme mentions at all?",
];

const TOOL_LABELS: Record<string, string> = {
  get_overview: "reading dataset overview",
  query_matrix: "querying the score matrix",
  get_country: "looking up country profile",
  get_evidence: "pulling outcome/output evidence",
  list_manual_review: "checking the manual-review list",
};

type Engine = "llm" | "nlp" | null;

export default function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [engine, setEngine] = useState<Engine>(null);

  const panelId = useId();
  const titleId = useId();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Learn which engine will answer (no Anthropic key -> local NLP, never an LLM call).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/chat")
      .then((r) => r.json())
      .then((d: { engine?: Engine }) => {
        if (!cancelled && (d.engine === "llm" || d.engine === "nlp")) setEngine(d.engine);
      })
      .catch(() => {
        if (!cancelled) setEngine("nlp");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Focus the input when the panel opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Auto-scroll the transcript as content streams in.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, activeTool]);

  const closePanel = useCallback(() => {
    setOpen(false);
    abortRef.current?.abort();
    launcherRef.current?.focus();
  }, []);

  // Esc closes the panel from anywhere inside it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closePanel]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;

      const history = [...messages, { role: "user" as const, content: trimmed }];
      setMessages([...history, { role: "assistant", content: "", tools: [] }]);
      setInput("");
      setBusy(true);
      setActiveTool(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history.map((m) => ({ role: m.role, content: m.content })),
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const detail = await res.json().catch(() => null);
          throw new Error(detail?.error ?? `Request failed (${res.status}).`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const appendText = (delta: string) =>
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, content: last.content + delta };
            return next;
          });

        const addTool = (name: string) => {
          setActiveTool(name);
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = {
              ...last,
              tools: [...(last.tools ?? []), name],
            };
            return next;
          });
        };

        // Parse the SSE stream (data: {json}\n\n).
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            const line = part.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            let evt: { type: string; text?: string; name?: string; message?: string };
            try {
              evt = JSON.parse(line.slice(5).trim());
            } catch {
              continue;
            }
            if (evt.type === "text" && evt.text) appendText(evt.text);
            else if (evt.type === "tool" && evt.name) addTool(evt.name);
            else if (evt.type === "error" && evt.message) {
              appendText(`\n\n⚠️ ${evt.message}`);
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          const note = `⚠️ ${(err as Error).message}`;
          next[next.length - 1] = {
            ...last,
            content: last.content ? `${last.content}\n\n${note}` : note,
          };
          return next;
        });
      } finally {
        setBusy(false);
        setActiveTool(null);
        abortRef.current = null;
        inputRef.current?.focus();
      }
    },
    [busy, messages]
  );

  function onInputKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close data assistant" : "Open data assistant chat"}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ background: "var(--score-3)", color: "var(--score-3-ink)" }}
      >
        <ChatIcon open={open} />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-labelledby={titleId}
          className="fixed bottom-24 right-5 z-40 flex max-h-[min(70vh,640px)] w-[min(94vw,420px)] flex-col overflow-hidden rounded-xl border shadow-2xl"
          style={{ borderColor: "var(--border)", background: "var(--page)" }}
        >
          <header
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <div>
              <h2 id={titleId} className="text-sm font-semibold">
                CPD Data Assistant
              </h2>
              <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                {engine === "llm"
                  ? "Claude Opus 4.8 · grounded in the 135-country dataset"
                  : engine === "nlp"
                    ? "Local NLP engine · no API key required · works offline"
                    : "Grounded in the 135-country analysis"}
              </p>
            </div>
            <button
              type="button"
              onClick={closePanel}
              aria-label="Close chat"
              className="rounded px-2 py-1 text-lg leading-none focus-visible:outline focus-visible:outline-2"
              style={{ color: "var(--ink-secondary)" }}
            >
              ×
            </button>
          </header>

          <div
            ref={logRef}
            role="log"
            aria-live="polite"
            aria-atomic="false"
            aria-label="Conversation"
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm"
          >
            {messages.length === 0 ? (
              <Welcome onPick={send} disabled={busy} />
            ) : (
              messages.map((m, i) => <Bubble key={i} msg={m} />)
            )}
            {busy && activeTool && (
              <p className="text-xs italic" style={{ color: "var(--ink-muted)" }}>
                {TOOL_LABELS[activeTool] ?? `using ${activeTool}`}…
              </p>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t p-3"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <label htmlFor={`${panelId}-input`} className="sr-only">
              Ask a question about the CPD data
            </label>
            <div className="flex items-end gap-2">
              <textarea
                id={`${panelId}-input`}
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onInputKeyDown}
                rows={1}
                placeholder="Ask about a country, theme, or score…"
                className="max-h-32 flex-1 resize-none rounded-lg border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2"
                style={{ borderColor: "var(--border)", background: "var(--page)" }}
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-40 focus-visible:outline focus-visible:outline-2"
                style={{ background: "var(--score-3)", color: "var(--score-3-ink)" }}
              >
                {busy ? "…" : "Send"}
              </button>
            </div>
            <p className="mt-1.5 text-[11px]" style={{ color: "var(--ink-muted)" }}>
              {engine === "nlp"
                ? "Local NLP engine — parses your question and looks up exact data, no model call. Best with direct questions about a country, theme, or score."
                : "Answers are generated from the structured dataset. Verify critical figures against the tabs."}
            </p>
          </form>
        </div>
      )}
    </>
  );
}

function Welcome({
  onPick,
  disabled,
}: {
  onPick: (t: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      <p style={{ color: "var(--ink-secondary)" }}>
        Ask about any of the 135 country programmes, the 9 themes, their 0–4
        scores, or the IRRF linkage gaps. Every answer is looked up from the
        underlying data.
      </p>
      <ul className="space-y-1.5">
        {SUGGESTIONS.map((s) => (
          <li key={s}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(s)}
              className="w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:opacity-80 disabled:opacity-40 focus-visible:outline focus-visible:outline-2"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className="max-w-[85%] rounded-lg px-3 py-2"
        style={{
          background: isUser ? "var(--score-2)" : "var(--surface)",
          color: isUser ? "var(--score-2-ink)" : "var(--ink-primary)",
          border: isUser ? "none" : "1px solid var(--border)",
        }}
      >
        <span className="sr-only">{isUser ? "You said: " : "Assistant said: "}</span>
        {msg.content ? (
          <div className="whitespace-pre-wrap break-words leading-relaxed">
            {msg.content}
          </div>
        ) : (
          <span
            className="inline-flex gap-1"
            aria-label="Assistant is thinking"
            style={{ color: "var(--ink-muted)" }}
          >
            <Dot /> <Dot /> <Dot />
          </span>
        )}
      </div>
    </div>
  );
}

function Dot() {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
      style={{ background: "currentColor" }}
    />
  );
}

function ChatIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  ) : (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9A1.5 1.5 0 0 1 18.5 16H9l-4 3.5V16H5.5A1.5 1.5 0 0 1 4 14.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
