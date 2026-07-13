import { useState, useRef, useEffect } from "react";
import api from "../api";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function ChatWidget() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => [{ role: "assistant", content: t("chat.welcome") }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      // The welcome line is UI-only; send real turns to the API
      const res = await api.post("/chat", { messages: next.slice(1) });
      setMessages([...next, { role: "assistant", content: res.data.reply }]);
    } catch (err) {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: err.response?.data?.message || t("chat.error"),
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        className="chat-fab"
        onClick={() => setOpen(!open)}
        aria-label={open ? t("chat.closeLabel") : t("chat.openLabel")}
      >
        {open ? "×" : "Ask"}
      </button>

      {open && (
        <div className="chat-panel" role="dialog" aria-label={t("chat.assistantName")}>
          <div className="chat-head">
            <strong>{t("chat.assistantName")}</strong>
            <span className="muted">{t("chat.tagline")}</span>
          </div>
          <div className="chat-body">
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                {m.content}
              </div>
            ))}
            {busy && <div className="chat-msg assistant">{t("chat.thinking")}</div>}
            <div ref={bottomRef} />
          </div>
          <form className="chat-input" onSubmit={send}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("chat.placeholder")}
              aria-label={t("chat.messageLabel")}
            />
            <button className="btn small" disabled={busy || !input.trim()}>
              {t("chat.send")}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
