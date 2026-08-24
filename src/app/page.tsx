import { CopyCommand } from "@/components/copy-command";
import { Terminal } from "@/components/terminal";

export default function Home() {
  return (
    <main className="w-full px-5 py-10 sm:px-6 sm:py-14">
      <div className="flex w-full max-w-[36rem] flex-col items-stretch gap-8 text-left">
        <h1 className="text-[1.35rem] font-semibold tracking-tight text-ink">mux</h1>

        <p className="max-w-[38ch] text-[1.05rem] leading-relaxed text-ink">
          Earn while you code.
        </p>

        <CopyCommand />

        <Terminal />

        <p className="max-w-[36rem] leading-[1.75] text-muted">
          <span className="text-ink">mux</span> is a split terminal. Your real
          shell — zsh, vim, Claude, Codex — runs on top. A Koah ad strip is
          pinned to the bottom. You keep shipping. The strip pays.
        </p>

        <p className="font-mono tracking-[0.35em] text-muted">###</p>

        <section className="max-w-[36rem] leading-[1.75] text-muted">
          <h2 className="text-sm font-bold text-ink">Works on most terminals</h2>
          <p className="mt-1">
            Ghostty, iTerm, Alacritty, the stock macOS one. A real PTY, so vim,
            tmux, Claude, and Codex all run as they would.
          </p>

          <h2 className="mt-10 text-sm font-bold text-ink">Keyboard to quit</h2>
          <p className="mt-1">
            ⌃A x. Same prefix as tmux. Scroll region reset, mouse reporting
            off, cursor back. The terminal is yours again.
          </p>

          <h2 className="mt-10 text-sm font-bold text-ink">Resize the strip</h2>
          <p className="mt-1">
            ⌃A ↑ and ↓. Two to six rows. Default five. Live, no restart.
          </p>

          <h2 className="mt-10 text-sm font-bold text-ink">
            Activate, learn more, or run the action
          </h2>
          <p className="mt-1">
            ⌃G fires the ad — open a page, type a command, or hand a prompt to
            the assistant. ⌃F is the second ask. Nothing is submitted for you.
          </p>

          <h2 className="mt-10 text-sm font-bold text-ink">No mouse</h2>
          <p className="mt-1">
            The strip is keys all the way down. Clicks work if you want them.
            You never need them.
          </p>

          <h2 className="mt-10 text-sm font-bold text-ink">Paid out on Stripe</h2>
          <p className="mt-1">
            Koah pays through Stripe. No new payout account to baby-sit. You
            get paid the way you already get paid.
          </p>

          <h2 className="mt-10 text-sm font-bold text-ink">
            Ads that help you ship
          </h2>
          <p className="mt-1">
            The strip types <span className="text-ink">npm i</span> at your
            prompt or pastes a prompt about this repo. It&apos;s a tool, not a
            banner.
          </p>
        </section>
      </div>
    </main>
  );
}
