import { ProductPreview } from "@/components/product-preview";
import { WaitlistForm } from "@/components/waitlist-form";
import { SOCIAL_URL } from "@/lib/brand";
import { Icon } from "@/components/icon";

export default function Home() {
  return (
    <main id="main-content" className="site-shell">
      <header className="intro">
        <h1 className="wordmark">mux</h1>
        <p className="tagline">Earn while you use Claude.</p>
        <p className="description">
          Install mux for Claude Code or Claude Desktop. Get paid while you work.
        </p>
      </header>

      <WaitlistForm />
      <ProductPreview />

      <p className="text-divider" aria-hidden="true">{"/////////"}</p>

      <div className="details">
        <section aria-labelledby="workflow-heading">
          <h2 id="workflow-heading">Keep your workflow.</h2>
          <p>
            Code, write, and build as usual. A small sponsored ad sits above your
            prompt. You don’t have to click it.
          </p>
        </section>
        <section aria-labelledby="earnings-heading">
          <h2 id="earnings-heading">Share in the ad revenue.</h2>
          <p>
            Earnings will depend on ad availability and eligible views. We’ll share
            the rates and payout details before launch.
          </p>
        </section>
        <section aria-labelledby="access-heading">
          <h2 id="access-heading">Early access is on the way.</h2>
          <p>
            We’re building mux now. Join the waitlist and we’ll email you when you
            can try it. There’s nothing to install yet.
          </p>
        </section>
      </div>

      <footer className="site-footer">
        <a href={SOCIAL_URL} target="_blank" rel="noopener noreferrer">
          Follow @guard_if for updates <Icon name="arrow-up-right" />
        </a>
        <p>An independent mod. Not affiliated with Anthropic.</p>
      </footer>
    </main>
  );
}
