"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { formatAgo, type SetupStatus } from "@/lib/dashboard";
import { useNow, useSetupStatus } from "@/lib/use-live";

const POLL_INTERVAL_MS = 3000;
const installCommand = "claude plugin install sidequest --marketplace koahlabs/sidequest";
const marketplace = "koahlabs/sidequest";
const firstMessage = "Reply with a one-line hello.";
const sampleQuestion = "What's a fun side quest I could take on this weekend?";

type App = "terminal" | "desktop";

function AppTabs({ app, onChange }: { app: App; onChange: (app: App) => void }) {
  return (
    <div className="setup-tabs" role="tablist" aria-label="Where you use Claude">
      <button
        type="button"
        role="tab"
        aria-selected={app === "terminal"}
        onClick={() => onChange("terminal")}
      >
        Terminal
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={app === "desktop"}
        onClick={() => onChange("desktop")}
      >
        Claude Desktop
      </button>
    </div>
  );
}

// Something on screen to click.
function Ui({ children }: { children: ReactNode }) {
  return <span className="setup-ui">{children}</span>;
}

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="setup-command">
      <code>{command}</code>
      <button type="button" className="auth-button" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function doneCount(status: SetupStatus) {
  return status.hasQueries ? 3 : status.devices.length > 0 ? 2 : 0;
}

function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className="setup-collapse" data-open={open}>
      <div inert={!open}>{children}</div>
    </div>
  );
}

function Marker({ done, number }: { done: boolean; number: number }) {
  return (
    <span className="setup-marker">
      {done ? (
        <>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5.5 10.5l3 3 6-7" pathLength="1" />
          </svg>
          <span className="sr-only">Done: </span>
        </>
      ) : (
        <span aria-hidden="true">{number}</span>
      )}
    </span>
  );
}

export function SetupWizard({ initial, localSite }: { initial: SetupStatus; localSite?: string }) {
  const connectCommand = localSite
    ? `claude --settings '{"env":{"SIDEQUEST_URL":"${localSite}"}}' /sidequest-connect`
    : "claude /sidequest-connect";
  const router = useRouter();
  const [app, setApp] = useState<App>("terminal");
  // Nothing reports an install, so the user moves past step 1 themselves.
  const [installed, setInstalled] = useState(false);
  const [initialDone] = useState(() => doneCount(initial));
  const now = useNow();
  const { status, checking, checkNow } = useSetupStatus(initial, POLL_INTERVAL_MS);
  const [device] = status.devices;
  const lastRequestAt = status.devices
    .flatMap((item) => (item.lastRequestAt ? [item.lastRequestAt] : []))
    .toSorted()
    .at(-1);
  const complete = status.hasQueries;

  const steps: { title: string; done: boolean; result?: string; body: ReactNode }[] = [
    {
      title: "Install Sidequest",
      done: installed || status.devices.length > 0,
      body: (
        <>
          <AppTabs app={app} onChange={setApp} />
          {app === "terminal" ? (
            <>
              <CopyCommand command={`${installCommand} && ${connectCommand}`} />
              <p>Run it in a terminal. It installs Sidequest, then opens Claude Code to connect.</p>
            </>
          ) : (
            <ol className="setup-list">
              <li>
                In Claude Desktop, open <Ui>Settings</Ui> › <Ui>Plugins</Ui>
              </li>
              <li>
                Click <Ui>Add</Ui> › <Ui>Add marketplace</Ui> › <Ui>Add from a repository</Ui>
              </li>
              <li>
                Paste this repository and click <Ui>Add</Ui>
                <CopyCommand command={marketplace} />
              </li>
              <li>
                Open <Ui>Discover</Ui>, find Sidequest and click <Ui>+</Ui>
              </li>
            </ol>
          )}
          <div className="setup-row">
            {app === "desktop" && (
              <button
                type="button"
                className="auth-button auth-button-primary setup-action"
                onClick={() => setInstalled(true)}
              >
                I installed it
              </button>
            )}
            <a
              className="setup-fine"
              href="https://github.com/koahlabs/sidequest#install"
              target="_blank"
              rel="noreferrer"
            >
              Trouble installing?
            </a>
          </div>
        </>
      ),
    },
    {
      title: "Connect this computer",
      done: status.devices.length > 0,
      result: device ? `Paired ${formatAgo(device.connectedAt, now)}` : undefined,
      body: (
        <>
          <AppTabs app={app} onChange={setApp} />
          {app === "terminal" ? (
            <>
              <CopyCommand command={connectCommand} />
              <p>Run it in a terminal. Claude Code shows a code and opens this site.</p>
            </>
          ) : (
            <ol className="setup-list">
              <li>
                Start a new session in the <Ui>Code</Ui> tab
              </li>
              <li>
                Send this first message. Sidequest starts once the session has one.
                <CopyCommand command={firstMessage} />
              </li>
              <li>
                Then send this to connect
                <CopyCommand command="/sidequest-connect" />
              </li>
              <li>Enter the code it shows on the page that opens</li>
            </ol>
          )}
          <p className="setup-fine">
            Page didn&apos;t open, or you closed it?{" "}
            <Link href="/connect">Open the connect page</Link>
          </p>
        </>
      ),
    },
    {
      title: "Ask Claude anything",
      done: status.hasQueries,
      result: lastRequestAt ? `First request ${formatAgo(lastRequestAt, now)}` : undefined,
      body: (
        <ol className="setup-list">
          <li>
            In the same session, send this question
            <CopyCommand command={sampleQuestion} />
          </li>
          <li>
            When the answer finishes, Sidequest asks for an ad. If one fits, it shows under the
            answer.
          </li>
          <li>This step completes either way, ad or not.</li>
        </ol>
      ),
    },
  ];
  const current = steps.findIndex((step) => !step.done);

  return (
    <>
      <div className="dashboard-title-row">
        <h1>Set up Sidequest</h1>
        <p className="setup-subtitle">Three steps. This page updates on its own.</p>
      </div>
      <section className="setup-panel" aria-label="Setup steps">
        <ol className="setup-steps">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className={`setup-step ${step.done ? "is-done" : index === current ? "is-current" : "is-upcoming"}${step.done && index >= initialDone ? " is-animated" : ""}`}
              aria-current={index === current ? "step" : undefined}
            >
              <Marker done={step.done} number={index + 1} />
              <div className="setup-step-main">
                <div className="setup-step-head">
                  <div>
                    <h2>{step.title}</h2>
                    {step.done && step.result && (
                      <p className="setup-step-result" suppressHydrationWarning>
                        {step.result}
                      </p>
                    )}
                  </div>
                  {index === current && index > 0 && (
                    <span className="setup-waiting">
                      <span className="live-dot is-pulsing" aria-hidden="true" />
                      Waiting…
                      <button type="button" onClick={checkNow} disabled={checking}>
                        {checking ? "Checking…" : "Check now"}
                      </button>
                    </span>
                  )}
                </div>
                <Collapse open={index === current}>
                  <div className="setup-step-body">{step.body}</div>
                </Collapse>
              </div>
            </li>
          ))}
        </ol>
        <Collapse open={complete}>
          <div className="setup-complete">
            <h2>You&apos;re set up</h2>
            <p>Ads appear under Claude&apos;s answers. Earnings show on your dashboard.</p>
            <button
              type="button"
              className="auth-button auth-button-primary setup-action"
              onClick={() => router.replace("/account?welcome=1")}
            >
              Go to dashboard
            </button>
          </div>
        </Collapse>
      </section>
    </>
  );
}
