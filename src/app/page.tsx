import { ProductPreview } from "@/components/product-preview";
import { WaitlistForm } from "@/components/waitlist-form";
import { AuthNav } from "@/components/auth-nav";
import { SiteFooter } from "@/components/site-footer";
import { DitherBackground } from "@/components/dither-background";
import { BrandLink } from "@/components/brand-link";

export default function Home() {
  return (
    <>
      <DitherBackground />
      <main id="main-content" className="site-shell home-page">
        <header className="intro">
          <div className="intro-heading">
            <h1 className="wordmark"><BrandLink /></h1>
            <AuthNav />
          </div>
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
        </section>

        <SiteFooter showPayouts />
      </main>
    </>
  );
}
