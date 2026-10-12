import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandLink } from "@/components/brand-link";
import { SiteFooter } from "@/components/site-footer";
import { AuthForm } from "@/components/auth-form";
import { EmailSignInForm } from "@/components/email-sign-in-form";
import { DitherBackground } from "@/components/dither-background";
import { createClient } from "@/lib/supabase/server";
import { getAuthErrorMessage } from "@/lib/auth-policy";
import { isGoogleSignInAvailable } from "@/lib/supabase/config";
import { signInEnabled } from "@/lib/feature-flags";

export const metadata: Metadata = { title: "Sign in | Sidequest", robots: { index: false, follow: false } };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  if (!await signInEnabled()) redirect("/");
  const { error } = await searchParams;
  const supabase = await createClient({ readOnly: true });
  let signedIn = false;
  if (supabase) {
    try {
      const { data } = await supabase.auth.getUser();
      signedIn = !!data.user;
    } catch { /* Provider failures leave sign-in available. */ }
  }
  if (signedIn) redirect("/account");
  const available = !!supabase && await isGoogleSignInAvailable();
  return (
    <>
      <DitherBackground />
      <main id="main-content" className="site-shell auth-page sign-in-page">
        <section className="auth-content sign-in-content" aria-labelledby="sign-in-heading">
          <div className="wordmark sign-in-brand"><BrandLink /></div>
          <div className="sign-in-card">
            <h1 id="sign-in-heading">Sign in</h1>
            <AuthForm mode="sign-in" available={available} initialError={error === "link" ? "" : getAuthErrorMessage(error)} />
            <div className="auth-divider"><span>or</span></div>
            <EmailSignInForm available={!!supabase} initialError={error === "link" ? getAuthErrorMessage(error) : ""} />
          </div>
        </section>
        <SiteFooter />
      </main>
    </>
  );
}
