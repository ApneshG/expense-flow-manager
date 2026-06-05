import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type Scope = "cfo" | "hod";
type ChatTurn = { role: "user" | "assistant"; content: string };

const SUGGESTED_PROMPTS: Record<Scope, string[]> = {
  cfo: [
    "What needs my attention today?",
    "Who is spending the most this month?",
    "Any pending payouts older than 7 days?",
    "How does each department's budget look?",
  ],
  hod: [
    "What's pending my approval right now?",
    "How much budget do I have left?",
    "Who in my team is the biggest spender?",
    "Anything stuck on hold by Finance?",
  ],
};

export function CopilotWidget({ scope, title, subtitle }: { scope: Scope; title?: string; subtitle?: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Check configuration on first open
  useEffect(() => {
    if (open && configured === null) {
      apiRequest("GET", "/api/copilot/status")
        .then(r => r.json())
        .then(d => setConfigured(!!d.configured))
        .catch(() => setConfigured(false));
    }
  }, [open, configured]);

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || isLoading) return;
    setInput("");
    const newHistory: ChatTurn[] = [...messages, { role: "user", content: question }];
    setMessages(newHistory);
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/copilot", {
        scope,
        question,
        history: messages.slice(-6),
      });
      const data = await res.json();
      const reply: ChatTurn = { role: "assistant", content: data.reply || "(no response)" };
      setMessages([...newHistory, reply]);
    } catch (err: any) {
      setMessages([
        ...newHistory,
        { role: "assistant", content: `Sorry, something went wrong: ${err?.message || "unknown error"}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const headerTitle = title || (scope === "cfo" ? "Finance Copilot" : "Department Copilot");
  const headerSubtitle = subtitle || "Powered by AI · context-aware to your data";

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all px-4 py-3 hover:scale-105"
          aria-label="Open Copilot"
        >
          <Sparkles className="w-5 h-5" />
          <span className="font-medium text-sm">Ask Copilot</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)] h-[560px] max-h-[calc(100vh-3rem)] bg-white rounded-2xl shadow-2xl border flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{headerTitle}</div>
                <div className="text-[10px] opacity-80 truncate">{headerSubtitle}</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="hover:bg-white/20 rounded-full p-1" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-slate-50">
            {configured === false && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-lg">
                The Copilot isn't configured yet. Admin needs to set <code className="font-mono">OPENAI_API_KEY</code> in Render env vars and redeploy.
              </div>
            )}

            {messages.length === 0 && configured !== false && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground px-1">Try asking:</div>
                {SUGGESTED_PROMPTS[scope].map((p, i) => (
                  <button
                    key={i}
                    onClick={() => send(p)}
                    className="w-full text-left text-sm px-3 py-2 rounded-lg bg-white border hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                  m.role === "user"
                    ? "ml-auto bg-indigo-600 text-white rounded-br-sm"
                    : "mr-auto bg-white border rounded-bl-sm",
                )}
              >
                {m.content}
              </div>
            ))}

            {isLoading && (
              <div className="mr-auto bg-white border rounded-2xl rounded-bl-sm px-3 py-2 text-sm flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" /> Thinking…
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="p-2 border-t bg-white flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your data…"
              disabled={isLoading || configured === false}
              className="text-sm"
            />
            <Button
              type="submit"
              size="icon"
              className="bg-indigo-600 hover:bg-indigo-700 flex-shrink-0"
              disabled={isLoading || !input.trim() || configured === false}
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
