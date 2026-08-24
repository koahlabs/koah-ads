"use client";

import { useEffect, useRef, useState } from "react";
import { AdStrip } from "@/components/ad-strip";
import { BrailleSpinner } from "@/components/braille-spinner";
import {
  EarningsTicker,
  randomImpressionMills,
} from "@/components/earnings-ticker";
import { DEMO_ADS } from "@/lib/ads";

const AD_MS = 8000;
const LS = "ls";
const COMMAND = "claude";
const TYPE_MS = 70;
const WORD_MS = 58;
const STEP_MS = 380;
const THINK_MS = 2000;
const AFTER_LS_MS = 1500;
const THINK_LABEL = "Thought 2s";
const LS_OUT =
  "AGENTS.md  CLAUDE.md  README.md  eslint.config.mjs\nnext.config.ts  package.json  public  src  tsconfig.json";

type Boot = "type-ls" | "ls-out" | "idle" | "type-claude" | "session";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function words(text: string) {
  return text.match(/\S+\s*/g) ?? [text];
}

type Turn = {
  prompt: string;
  reply: string;
  thoughts: string[];
};

export function Terminal() {
  const [typed, setTyped] = useState(0);
  const [boot, setBoot] = useState<Boot>("type-ls");
  const [session, setSession] = useState(false);
  const [adIndex, setAdIndex] = useState(0);
  const [earned, setEarned] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [log, setLog] = useState<Turn[]>([]);
  const [active, setActive] = useState<Turn | null>(null);
  const [promptShown, setPromptShown] = useState("");
  const [replyShown, setReplyShown] = useState("");
  const [thoughtShown, setThoughtShown] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [thoughtDone, setThoughtDone] = useState(false);
  const runId = useRef(0);
  const activeRef = useRef<Turn | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const ad = DEMO_ADS[adIndex];

  useEffect(() => {
    if (prefersReducedMotion()) {
      setBoot("session");
      setTyped(COMMAND.length);
      setSession(true);
      return;
    }

    let cancelled = false;
    let timer = 0;

    const typeCmd = (cmd: string, then: () => void) => {
      const next = (n: number) => {
        if (cancelled) return;
        if (n < cmd.length) {
          timer = window.setTimeout(() => {
            setTyped(n + 1);
            next(n + 1);
          }, TYPE_MS);
          return;
        }
        then();
      };
      next(0);
    };

    timer = window.setTimeout(() => {
      typeCmd(LS, () => {
        timer = window.setTimeout(() => {
          if (cancelled) return;
          setBoot("ls-out");
          timer = window.setTimeout(() => {
            if (cancelled) return;
            setBoot("idle");
            setTyped(0);
            timer = window.setTimeout(() => {
              if (cancelled) return;
              setBoot("type-claude");
              typeCmd(COMMAND, () => {
                timer = window.setTimeout(() => {
                  if (cancelled) return;
                  setBoot("session");
                  setSession(true);
                }, 280);
              });
            }, AFTER_LS_MS);
          }, 360);
        }, 180);
      });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    const bump = () => setEarned((n) => n + randomImpressionMills());
    const first = window.setTimeout(bump, 800);
    const id = window.setInterval(() => {
      bump();
      if (busyRef.current) return;
      setAdIndex((i) => (i + 1) % DEMO_ADS.length);
    }, AD_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (session && !active && log.length === 0) {
      el.scrollTop = 0;
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [
    session,
    boot,
    typed,
    log,
    active,
    promptShown,
    replyShown,
    thoughtShown,
    thinking,
    thoughtDone,
  ]);

  function typeByWord(
    id: number,
    text: string,
    setShown: (value: string) => void,
    done: () => void,
  ) {
    const parts = words(text);
    let i = 0;
    const tick = () => {
      if (runId.current !== id) return;
      i += 1;
      setShown(parts.slice(0, i).join(""));
      if (i < parts.length) {
        window.setTimeout(tick, WORD_MS);
        return;
      }
      done();
    };
    tick();
  }

  function handoff(prompt: string, reply: string, thoughts: string[]) {
    const id = ++runId.current;
    const reduce = prefersReducedMotion();
    const next = { prompt, reply, thoughts };

    if (activeRef.current) {
      setLog((turns) => [...turns, activeRef.current!]);
    }

    activeRef.current = next;
    setSession(true);
    setActive(next);
    setPromptShown(reduce ? prompt : "");
    setReplyShown(reduce ? reply : "");
    setThoughtShown(reduce ? thoughts.length : 0);
    setThinking(false);
    setThoughtDone(reduce);

    if (reduce) {
      activeRef.current = null;
      setLog((turns) => [...turns, next]);
      setActive(null);
      return;
    }

    const finish = () => {
      if (runId.current !== id) return;
      activeRef.current = null;
      setLog((turns) => [...turns, next]);
      setActive(null);
      setPromptShown("");
      setReplyShown("");
      setThoughtShown(0);
      setThinking(false);
      setThoughtDone(false);
    };

    const startReply = () => {
      if (runId.current !== id) return;
      setThinking(false);
      setThoughtDone(true);
      typeByWord(id, reply, setReplyShown, finish);
    };

    const startThinking = () => {
      if (runId.current !== id) return;
      setThinking(true);
      window.setTimeout(startReply, THINK_MS);
    };

    const revealThoughts = (n: number) => {
      if (runId.current !== id) return;
      if (n >= thoughts.length) {
        startThinking();
        return;
      }
      setThoughtShown(n + 1);
      window.setTimeout(() => revealThoughts(n + 1), STEP_MS);
    };

    typeByWord(id, prompt, setPromptShown, () => {
      setPromptShown(prompt);
      revealThoughts(0);
    });
  }

  const promptDone = Boolean(
    active && promptShown.length === active.prompt.length,
  );
  const replyDone = Boolean(active && replyShown.length === active.reply.length);
  const inFlight = Boolean(active);

  return (
    <div className="term flex h-[28rem] w-full flex-col overflow-hidden rounded-[10px] border border-term-line bg-term font-mono text-[14px] leading-[19px] text-term-ink">
      <div className="relative flex h-11 shrink-0 items-center justify-center">
        <div className="absolute left-5 flex gap-2" aria-hidden>
          <span className="size-3 rounded-full bg-muted/60" />
          <span className="size-3 rounded-full bg-muted/60" />
          <span className="size-3 rounded-full bg-muted/60" />
        </div>
        <div className="text-sm text-muted">mux</div>
        <div className="absolute right-5 text-[11px] leading-none text-muted">
          <EarningsTicker mills={earned} />
        </div>
      </div>
      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 select-none"
      >
        <div className="text-term-ink/90">
          {!session ? (
            <>
              <p>
                <span className="text-term-dim">~ %</span>{" "}
                {boot === "type-ls" ? LS.slice(0, typed) : LS}
                {boot === "type-ls" ? (
                  <span className="caret ml-px">▋</span>
                ) : null}
              </p>
              {boot !== "type-ls" ? (
                <p className="mt-1 whitespace-pre-wrap text-term-ink/85">
                  {LS_OUT}
                </p>
              ) : null}
              {boot === "idle" || boot === "type-claude" ? (
                <p className="mt-4">
                  <span className="text-term-dim">~ %</span>{" "}
                  {boot === "type-claude" ? COMMAND.slice(0, typed) : ""}
                  <span className="caret ml-px">▋</span>
                </p>
              ) : null}
            </>
          ) : null}

          {session ? (
            <>
              <p>
                <span className="text-[#d97757]">✻</span> Welcome to Claude
                Code
              </p>

              {log.map((turn, i) => (
                <TurnBlock
                  key={`${turn.prompt}-${i}`}
                  prompt={turn.prompt}
                  thoughts={turn.thoughts}
                  thoughtShown={turn.thoughts.length}
                  thinking={false}
                  thoughtDone
                  reply={turn.reply}
                  showCaret={false}
                />
              ))}

              {active ? (
                <TurnBlock
                  prompt={promptShown}
                  thoughts={active.thoughts}
                  thoughtShown={thoughtShown}
                  thinking={thinking}
                  thoughtDone={thoughtDone}
                  reply={replyShown}
                  showCaret={!promptDone || (thoughtDone && !replyDone)}
                />
              ) : null}

              {!inFlight || replyDone ? (
                <p className="mt-5">
                  <span className="text-term-dim">❯</span>
                  <span className="caret ml-1">▋</span>
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
      <div className="shrink-0 border-t border-term-line">
        <AdStrip
          key={ad.brand}
          ad={ad}
          claude={session}
          onOpenChange={setBusy}
          onHandoff={handoff}
        />
      </div>
    </div>
  );
}

function TurnBlock({
  prompt,
  thoughts,
  thoughtShown,
  thinking,
  thoughtDone,
  reply,
  showCaret,
}: {
  prompt: string;
  thoughts: string[];
  thoughtShown: number;
  thinking: boolean;
  thoughtDone: boolean;
  reply: string;
  showCaret: boolean;
}) {
  const caretOnPrompt = showCaret && !thinking && !thoughtDone;
  const caretOnReply = showCaret && thoughtDone;

  return (
    <div className="mt-5">
      <p className="whitespace-pre-wrap">
        <span className="text-term-dim">❯</span> {prompt}
        {caretOnPrompt ? <span className="caret">▋</span> : null}
      </p>
      {thoughtShown > 0 || thinking || thoughtDone ? (
        <div className="mt-3 space-y-1 text-term-dim">
          {thoughts.slice(0, thoughtShown).map((step) => (
            <p key={step}>{step}</p>
          ))}
          {thinking ? (
            <p className="flex items-center gap-1.5">
              <BrailleSpinner />
              Thinking
            </p>
          ) : null}
          {thoughtDone ? <p>{THINK_LABEL}</p> : null}
        </div>
      ) : null}
      {reply ? (
        <p className="mt-4 whitespace-pre-wrap text-term-ink/85">
          {reply}
          {caretOnReply ? <span className="caret">▋</span> : null}
        </p>
      ) : null}
    </div>
  );
}
