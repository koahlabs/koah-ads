import type { Metadata } from "next";
import Link from "next/link";
import { BrandLink } from "@/components/brand-link";
import { SiteFooter } from "@/components/site-footer";
import { AuthForm } from "@/components/auth-form";
import { EmailSignInForm } from "@/components/email-sign-in-form";
import { ConnectForm } from "@/components/connect-form";
import { Icon } from "@/components/icon";
import { createClient } from "@/lib/supabase/server";
import { isGoogleSignInAvailable } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Connect Sidequest | Sidequest",
  robots: { index: false, follow: false },
};

export default async function ConnectPage() {
  const supabase = await createClient({ readOnly: true });
  const user = (await supabase?.auth.getUser().catch(() => null))?.data.user;
  return (
    <main id="main-content" className="site-shell auth-page">
      <header className="intro-heading">
        <div className="wordmark">
          <BrandLink />
        </div>
      </header>
      <Link className="legal-back" href="/">
        <Icon name="arrow-left" /> Back to Sidequest
      </Link>
      <section className="auth-content" aria-labelledby="connect-heading">
        <h1 id="connect-heading">Connect Sidequest</h1>
        {user ? (
          <>
            <p className="account-email">Signed in as {user.email}</p>
            <ConnectForm />
            <AuthForm mode="sign-out" />
          </>
        ) : (
          <>
            <p>Sign in to connect Claude Code.</p>
            <div className="sign-in-card">
              <AuthForm
                mode="sign-in"
                available={!!supabase && (await isGoogleSignInAvailable())}
                destination="connect"
              />
              <div className="auth-divider">
                <span>or</span>
              </div>
              <EmailSignInForm available={!!supabase} destination="connect" />
            </div>
          </>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
