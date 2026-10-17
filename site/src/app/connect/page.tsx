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
import { lookupPendingRequest, type LookupState } from "@/lib/connect-server";
import { normalizeUserCode } from "@/lib/user-code";

export const metadata: Metadata = {
  title: "Connect Sidequest | Sidequest",
  robots: { index: false, follow: false },
};

const differentNetwork =
  "This request came from a different network than this browser. Type the code Claude shows to continue.";

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>;
}) {
  const { code } = await searchParams;
  const linkedCode = normalizeUserCode(code);
  const supabase = await createClient({ readOnly: true });
  const user = (await supabase?.auth.getUser().catch(() => null))?.data.user;
  let linked: LookupState | undefined;
  if (supabase && user && linkedCode) {
    linked = await lookupPendingRequest(linkedCode, { supabase, user });
    // A link can be phished, so only a code typed here may connect a computer on another network.
    if (linked.request?.differentNetwork) linked = { message: differentNetwork, request: null };
  }
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
      {user ? (
        <ConnectForm email={user.email ?? ""} linked={linked} />
      ) : (
        <section className="auth-content" aria-labelledby="connect-heading">
          <h1 id="connect-heading">Connect Sidequest</h1>
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
        </section>
      )}
      <SiteFooter />
    </main>
  );
}
