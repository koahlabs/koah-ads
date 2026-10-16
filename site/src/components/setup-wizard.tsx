"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { readSetupStatus } from "@/app/account/actions";
import { Icon } from "@/components/icon";
import type { SetupStatus } from "@/lib/dashboard";

const POLL_INTERVAL_MS = 3000;
const installCommand =
  "claude plugin marketplace add koahlabs/sidequest && claude plugin install sidequest@koah --scope user";

export function SetupWizard({ initial }: { initial: SetupStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const next = await readSetupStatus().catch(() => null);
      if (next) return setStatus(next);
      // The session ended or the status is unreadable: let the page decide what to show.
      window.clearInterval(timer);
      router.refresh();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [router]);

  useEffect(() => {
    if (status.hasQueries) router.refresh();
  }, [status.hasQueries, router]);

  async function copyCommand() {
    await navigator.clipboard.writeText(installCommand);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  const steps: { title: string; done: boolean; body: ReactNode }[] = [
    {
      title: "Install Sidequest",
      done: status.connected,
      body: (
        <>
          <div className="setup-command">
            <code>{installCommand}</code>
            <button type="button" className="auth-button" onClick={copyCommand}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p>
            Run it in a terminal. Then start a new Claude Code session, or run /reload-plugins in an
            open one.
          </p>
          <p>
            Needs Claude Code 2.1.287 or later. Run <code>claude update</code> if it is older.{" "}
            <a href="https://code.claude.com/docs/en/setup" target="_blank" rel="noreferrer">
              claude: command not found?
            </a>
          </p>
          <p>
            Using Claude Desktop? In a local Code session, click +, then Plugins, Add plugin,
            sidequest.
          </p>
        </>
      ),
    },
    {
      title: "Connect this computer",
      done: status.connected,
      body: (
        <>
          <p>
            Your new session opens this site and shows a code in Claude Code. If it does not, run
            /sidequest-connect.
          </p>
          <Link className="auth-button auth-button-primary setup-action" href="/connect">
            Enter code
          </Link>
        </>
      ),
    },
    {
      title: "Ask Claude a question",
      done: status.hasQueries,
      body: (
        <p>Ask anything in that session. Not every answer gets an ad. Ads off? Run /sidequest.</p>
      ),
    },
  ];
  const current = steps.findIndex((step) => !step.done);

  return (
    <>
      <div className="dashboard-title-row">
        <h1>Set up Sidequest</h1>
      </div>
      <ol className="setup-steps">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className={`setup-step ${step.done ? "is-done" : index === current ? "is-current" : "is-upcoming"}`}
            aria-current={index === current ? "step" : undefined}
          >
            <span className="setup-marker">
              {step.done ? (
                <>
                  <Icon name="check" size={20} />
                  <span className="sr-only">Done: </span>
                </>
              ) : (
                <span aria-hidden="true">{index + 1}</span>
              )}
            </span>
            <div className="setup-step-body">
              <h2>{step.title}</h2>
              {index === current && step.body}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
