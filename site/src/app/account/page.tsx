import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLink } from "@/components/brand-link";
import { SiteFooter } from "@/components/site-footer";
import { AuthForm } from "@/components/auth-form";
import { Icon } from "@/components/icon";
import { createClient } from "@/lib/supabase/server";
import { signInEnabled } from "@/lib/feature-flags";

export const metadata: Metadata = { title: "Your account | Sidequest", robots: { index: false, follow: false } };

export default async function AccountPage() {
  if (!await signInEnabled()) redirect("/");
  const supabase = await createClient({ readOnly: true });
  if (!supabase) redirect("/sign-in");
  const result = await supabase.auth.getUser().catch(() => null);
  if (!result || (result.error && (!result.error.status || result.error.status >= 500))) redirect("/sign-in?error=provider");
  if (result.error || !result.data.user) redirect("/sign-in?error=session");
  const user = result.data.user;
  const name = typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : "Your account";
  return (
    <main id="main-content" className="site-shell auth-page">
      <header className="intro-heading"><div className="wordmark"><BrandLink /></div></header>
      <Link className="legal-back" href="/"><Icon name="arrow-left" /> Back to Sidequest</Link>
      <section className="auth-content" aria-labelledby="account-heading">
        <h1 id="account-heading">{name}</h1>
        <p className="account-email">{user.email}</p>
        <p>You’re signed in. Sidequest is still in development.</p>
        <AuthForm mode="sign-out" />
      </section>
      <SiteFooter />
    </main>
  );
}
