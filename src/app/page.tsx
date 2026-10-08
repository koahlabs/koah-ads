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

      <section className="details" aria-labelledby="how-it-works-heading">
        <h2 id="how-it-works-heading">How it works.</h2>
        <ol className="process-steps">
          <li>
            <h3>Install mux.</h3>
            <p>Add mux to Claude Code or Claude Desktop. Set it up once.</p>
          </li>
          <li>
            <h3>Use Claude as usual.</h3>
            <p>Code, write, and build. A small ad appears above your prompt.</p>
          </li>
          <li>
            <h3>Get paid.</h3>
            <p>mux pays you for the ads you see. No clicks or purchases needed.</p>
          </li>
        </ol>
        <p className="process-note">
          Join the waitlist for early access. We’ll email you the install link and
          payout details when mux is ready.
        </p>
      </section>

      <footer className="site-footer">
        <a href={SOCIAL_URL} target="_blank" rel="noopener noreferrer">
          Follow @guard_if for updates <Icon name="arrow-up-right" />
        </a>
      </footer>
    </main>
  );
}
