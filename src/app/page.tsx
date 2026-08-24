import { CopyCommand } from "@/components/copy-command";
import { Terminal } from "@/components/terminal";

export default function Home() {
  return (
    <main className="w-full px-5 py-10 sm:px-6 sm:py-14">
      <div className="flex w-full max-w-[42rem] flex-col items-stretch gap-8 text-left">
        <h1 className="text-[1.35rem] font-semibold tracking-tight text-ink">
          mux
        </h1>

        <p className="max-w-[38ch] text-[1.05rem] leading-relaxed text-ink">
          Earn while you code.
        </p>

        <CopyCommand />

        <Terminal />

        <p className="max-w-[36rem] leading-[1.75] text-muted">
          <span className="text-ink">mux</span> is a split terminal that lets
          you earn money by displaying ads while you work.
        </p>

        <p className="font-mono tracking-[0.35em] text-muted">/////////</p>

        <section className="max-w-[36rem] leading-[1.75] text-muted">
          <h2 className="text-sm font-bold text-ink">Works on any terminal.</h2>
          <p className="mt-1">
            Ghostty, iTerm, the stock macOS terminal. If it doesn't work on your
            terminal,{" "}
            <a href="mailto:support@mux.com" className="underline">
              let us know
            </a>
            .
          </p>

          <h2 className="mt-10 text-sm font-bold text-ink">
            Ads that don't suck.
          </h2>
          <p className="mt-1">
            Sugested actions and ads that are relevant to your workflow.
          </p>

          <h2 className="mt-10 text-sm font-bold text-ink">
            Keyboard. Shortcuts.
          </h2>
          <p className="mt-1">
            No mouse needed. If you are used to tmux, you will feel right at
            home.
          </p>

          <h2 className="mt-10 text-sm font-bold text-ink">Size matters.</h2>
          <p className="mt-1">
            Change the size of the ad strip to suit your needs.
          </p>

          <h2 className="mt-10 text-sm font-bold text-ink">
            Paid through Stripe.
          </h2>
          <p className="mt-1">
            Connect your bank account and get paid through Stripe.
          </p>
        </section>
      </div>
    </main>
  );
}
