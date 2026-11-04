import { useEffect, useRef, useState } from "react";
import { Button, Chip, Divider, IconButton, Message, TextInput, Text, ThinkingIndicator, ToggleGroup, usePal } from "./halaska-kit";
import { answer, GROUPS } from "./knowledge";
import Mascot from "./Mascot";

const EMBED = new URLSearchParams(location.search).has("embed");
const DARK = (new URLSearchParams(location.search).get("theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
const PAGE = 5;

const TABS = GROUPS.map((g) => g.title);

const ALL = GROUPS.flatMap((g, gi) => g.items.map((i) => ({ ...i, gi })));
const FIRST = ["What did you design at Nuton?", "How many years of experience do you have?", "What are your skills?", "Are you open to work?", "How can I contact you?"];

// Suggestions not yet asked: the group of the last question first, then the rest.
function order(asked) {
  const last = asked[asked.length - 1];
  const lastGi = ALL.find((i) => i.q === last)?.gi;
  const rest = ALL.filter((i) => !asked.includes(i.q));
  if (lastGi === undefined) {
    const first = FIRST.map((q) => rest.find((i) => i.q === q)).filter(Boolean);
    return [...first, ...rest.filter((i) => !first.includes(i))];
  }
  return [...rest.filter((i) => i.gi === lastGi), ...rest.filter((i) => i.gi !== lastGi)];
}

const ArrowUp = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M10 16V4M5 9l5-5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function Assistant() {
  const pal = usePal();
  const [messages, setMessages] = useState([]);
  const [asked, setAsked] = useState([]);
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState(TABS[0]);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [wake, setWake] = useState(0);
  const timers = useRef([]);
  const scroller = useRef(null);

  useEffect(() => {
    const onMsg = (e) => { if (e.data && e.data.t === "open") setWake((w) => w + 1); };
    window.addEventListener("message", onMsg);
    return () => { window.removeEventListener("message", onMsg); timers.current.forEach((t) => { clearTimeout(t); clearInterval(t); }); };
  }, []);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  function send(text) {
    const q = text.trim();
    if (!q || busy) return;
    const id = Date.now();
    setDraft("");
    setBusy(true);
    setPage(0);
    setAsked((a) => [...a, q]);
    setMessages((m) => [...m, { id: "u" + id, role: "user", text: q }]);
    setTyping(true);
    const a = answer(q);
    timers.current.push(setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { id: "a" + id, role: "agent", text: "", streaming: true }]);
      let i = 0;
      const iv = setInterval(() => {
        i += 3;
        const done = i >= a.text.length;
        setMessages((m) => m.map((x) => (x.id === "a" + id ? { ...x, text: a.text.slice(0, i), streaming: !done, sources: done ? a.sources : [] } : x)));
        if (done) { clearInterval(iv); setBusy(false); }
      }, 16);
      timers.current.push(iv);
    }, 600));
  }

  function clear() {
    timers.current.forEach((t) => { clearTimeout(t); clearInterval(t); });
    setMessages([]); setTab(TABS[0]); setAsked([]); setPage(0); setTyping(false); setBusy(false); setDraft("");
  }

  const pad = 20;
  const empty = messages.length === 0;
  const items = GROUPS.find((g) => g.title === tab).items;
  const state = typing ? "thinking" : busy ? "talking" : "idle";
  const pool = order(asked);
  const start = pool.length ? (page * PAGE) % pool.length : 0;
  const chips = pool.length <= PAGE ? pool : Array.from({ length: PAGE }, (_, k) => pool[(start + k) % pool.length]);

  return (
    <div style={{
      display: "flex", flexDirection: "column", overflow: "hidden", background: pal.bg,
      ...(EMBED ? { height: "100vh" } : { height: 560, width: 672, maxWidth: "100%", margin: "48px auto", border: `1px solid ${pal.border}`, borderRadius: 24 }),
    }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, padding: `14px ${EMBED ? 56 : pad}px 14px ${pad}px`, flex: "none" }}>
        <Mascot size={34} dark={DARK} state={state} wake={wake} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text as="div" size="lg" weight="semibold">Ask about Chimaobi</Text>
          <Text as="div" size="base" secondary>Portfolio assistant · answers from the published site</Text>
        </div>
        {messages.length > 0 && <Button variant="ghost" size="sm" onClick={clear}>Clear</Button>}
      </header>
      <Divider spacing={0} />

      <div ref={scroller} className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: pad, display: "flex", flexDirection: "column", gap: 16 }}>
        {empty ? (
          <div style={{ margin: "auto 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
            <Mascot size={72} dark={DARK} state={state} wake={wake} />
            <div>
              <Text as="div" size="xl" weight="semibold">What would you like to know?</Text>
              <Text as="div" size="md" secondary style={{ marginTop: 4 }}>Pick a topic, or type your own question.</Text>
            </div>
            <ToggleGroup options={TABS} value={tab} onChange={setTab} />
            <div key={tab} className="fade-in" style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 520 }}>
              {items.map((i) => <Chip key={i.q} onToggle={() => send(i.q)}>{i.label}</Chip>)}
            </div>
          </div>
        ) : messages.map((m) => (
          <div key={m.id} className="fade-in msg-wide">
            <Message role={m.role} text={m.text} streaming={m.streaming} sources={m.sources || []} avatar={null} />
          </div>
        ))}
        {typing && <ThinkingIndicator label="Looking through the portfolio" />}
      </div>

      <div style={{ flex: "none", padding: `0 ${pad}px calc(${pad}px + env(safe-area-inset-bottom, 0px))`, display: "flex", flexDirection: "column", gap: 12 }}>
        {!empty && <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", overflow: "hidden", alignItems: "center" }}>
          {chips.map((i) => <Chip key={i.q} onToggle={() => send(i.q)}>{i.label}</Chip>)}
          {pool.length > PAGE && <Chip onToggle={() => setPage((p) => p + 1)}>More</Chip>}
        </div>}
        <form onSubmit={(e) => { e.preventDefault(); send(draft); }} style={{ position: "relative" }}>
          <TextInput value={draft} onChange={setDraft} placeholder="Ask a question" aria-label="Ask a question" style={{ paddingRight: 52, borderRadius: 999 }} />
          <div style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)" }}>
            <IconButton variant="secondary" size={32} icon={<ArrowUp />} label="Send" onClick={() => send(draft)} style={{ borderRadius: 999 }} />
          </div>
        </form>
        <Text as="div" size="sm" muted align="center">Written from the published portfolio, not generated.</Text>
      </div>
    </div>
  );
}
