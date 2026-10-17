"use client";

import Link from "next/link";
import { Icon } from "@/components/icon";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { describeDevice, formatAgo, latestRequestAt, type SetupStatus } from "@/lib/dashboard";
import { useNow, useSetupStatus } from "@/lib/use-live";

const POLL_INTERVAL_MS = 3000;
const installCommand = "claude plugin install sidequest --marketplace koahlabs/sidequest";
const connectCommand = "claude /sidequest-connect";
// Desktop links can't run slash commands, but they can fill in a message asking Claude to run the install.
const desktopLink = `claude://code/new?q=${encodeURIComponent(
  `Install the Sidequest plugin for me: run \`${installCommand}\`, then tell me to run /sidequest-connect.`,
)}`;
const marketplaceUrl = "https://github.com/koahlabs/sidequest";

const apps = [
  { id: "terminal", label: "Terminal", icon: "terminal" },
  { id: "desktop", label: "Claude Desktop", icon: "desktop" },
] as const;
type App = (typeof apps)[number]["id"];

function AppTabs({ app, onChange }: { app: App; onChange: (app: App) => void }) {
  return (
    <div className="setup-tabs" role="group" aria-label="Where you use Claude">
      {apps.map(({ id, label, icon }) => (
        <button key={id} type="button" aria-pressed={app === id} onClick={() => onChange(id)}>
          <Icon name={icon} size={16} />
          {label}
        </button>
      ))}
    </div>
  );
}

// Something on screen to click.
function Ui({ children }: { children: ReactNode }) {
  return <span className="setup-ui">{children}</span>;
}

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const code = useRef<HTMLElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      // Clipboard access can be blocked: select the text so the user can copy it.
      if (code.current) window.getSelection()?.selectAllChildren(code.current);
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="setup-command">
      <code ref={code}>{command}</code>
      <button type="button" className="auth-button" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
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

// The last item verifies setup instead of asking for one, so it has no number.
function Marker({ done, number }: { done: boolean; number?: number }) {
  return (
    <span className={`setup-marker${number === undefined ? " is-check" : ""}`}>
      {done ? (
        <>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5.5 10.5l3 3 6-7" pathLength="1" />
          </svg>
          <span className="sr-only">Done: </span>
        </>
      ) : (
        number !== undefined && <span aria-hidden="true">{number}</span>
      )}
    </span>
  );
}

export function SetupWizard({ initial }: { initial: SetupStatus }) {
  const router = useRouter();
  const [app, setApp] = useState<App>("terminal");
  // Nothing reports an install, so the user moves past step 1 themselves.
  const [installed, setInstalled] = useState(false);
  const [initialDone] = useState(() => doneCount(initial));
  const now = useNow();
  const { status, checking, checkNow } = useSetupStatus(initial, POLL_INTERVAL_MS);
  const [device] = status.devices;
  const connected = status.devices.length > 0;
  const lastRequestAt = latestRequestAt(status.devices);

  const steps: {
    title: string;
    done: boolean;
    check?: true;
    result?: string;
    body: ReactNode;
  }[] = [
    {
      title: "Install Sidequest",
      done: installed || connected,
      body: (
        <>
          <AppTabs app={app} onChange={setApp} />
          {app === "terminal" ? (
            <>
              <CopyCommand command={`${installCommand} && ${connectCommand}`} />
              <p>Run it in a terminal. It installs Sidequest, then opens Claude Code to connect.</p>
            </>
          ) : (
            <>
              <a className="auth-button auth-button-primary setup-action" href={desktopLink}>
                <Icon name="desktop" size={16} />
                Open in Claude Desktop
              </a>
              <p>In the new session, press Enter and allow the install command.</p>
              <details className="setup-manual">
                <summary>
                  Install by hand instead
                  <Icon name="caret-down" size={12} />
                </summary>
                <ol className="setup-list">
                  <li>
                    In the Code tab, send this to open the Plugins page
                    <CopyCommand command="/plugin" />
                  </li>
                  <li>
                    Click <Ui>Add</Ui> › <Ui>Add marketplace</Ui> › <Ui>Add from a repository</Ui>
                  </li>
                  <li>
                    Click the <Ui>URL</Ui> box, paste this link, then click <Ui>Sync</Ui>
                    <CopyCommand command={marketplaceUrl} />
                  </li>
                  <li>
                    Open <Ui>Discover</Ui>, find Sidequest and click <Ui>+</Ui>
                  </li>
                </ol>
              </details>
            </>
          )}
          <div className="setup-row">
            {app === "desktop" && (
              <button
                type="button"
                className="auth-button setup-action"
                onClick={() => setInstalled(true)}
              >
                I installed it
              </button>
            )}
            <p className="setup-fine">
              <a
                href="https://github.com/koahlabs/sidequest#install"
                target="_blank"
                rel="noreferrer"
              >
                Trouble installing?
              </a>
            </p>
          </div>
        </>
      ),
    },
    {
      title: "Connect this computer",
      done: connected,
      result: device
        ? `${describeDevice(device)} · paired ${formatAgo(device.connectedAt, now)}`
        : undefined,
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
                In the session from step 1, send this
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
      title: "Check that it works",
      done: status.hasQueries,
      check: true,
      result: lastRequestAt ? `Last request ${formatAgo(lastRequestAt, now)}` : undefined,
      body: (
        <>
          <p className="setup-goal">
            Ask Claude anything in the session you just connected. We&apos;ll confirm here after
            Claude answers.
          </p>
          <div className="setup-prompt" aria-hidden="true">
            <span className="setup-prompt-caret">❯</span>
            <span className="setup-prompt-text">Ask Claude anything</span>
            <span className="setup-prompt-cursor" />
          </div>
        </>
      ),
    },
  ];
  const current = steps.findIndex((step) => !step.done);
  const stepHeadings = useRef<(HTMLHeadingElement | null)[]>([]);
  const completeHeading = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(current);

  useEffect(() => {
    if (shownStep.current === current) return;
    shownStep.current = current;
    (current === -1 ? completeHeading.current : stepHeadings.current[current])?.focus();
  }, [current]);

  return (
    <>
      <div className="dashboard-title-row">
        <h1>{connected ? "You're set up" : "Set up Sidequest"}</h1>
        <p className="setup-subtitle" role="status">
          {connected
            ? "Sidequest is connected. One quick check to see it working."
            : "Two steps. This page updates on its own."}
        </p>
      </div>
      <section className="setup-panel" aria-label="Setup steps">
        <ol className="setup-steps">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className={`setup-step ${step.done ? "is-done" : index === current ? "is-current" : "is-upcoming"}${step.done && index >= initialDone ? " is-animated" : ""}`}
              aria-current={index === current ? "step" : undefined}
            >
              <Marker done={step.done} number={step.check ? undefined : index + 1} />
              <div className="setup-step-main">
                <div className="setup-step-head">
                  <div>
                    <h2
                      ref={(element) => {
                        stepHeadings.current[index] = element;
                      }}
                      tabIndex={-1}
                    >
                      {step.title}
                    </h2>
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
                      <button
                        type="button"
                        className="text-button"
                        onClick={checkNow}
                        disabled={checking}
                      >
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
        <Collapse open={status.hasQueries}>
          <div className="setup-complete">
            <h2 ref={completeHeading} tabIndex={-1}>
              It works
            </h2>
            <p>Your message reached us. Ads appear under Claude&apos;s answers from now on.</p>
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
