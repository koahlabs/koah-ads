import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Use | mux",
  description: "Terms for using the mux website, accounts, and early access waitlist.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use">
      <section>
        <h2>1. About these terms</h2>
        <p>Koah Labs Inc. operates the mux website. These terms describe the website, accounts, and early access waitlist. <a href="https://www.koahlabs.com/legal/terms">Koah’s Terms of Use</a> also apply, including their provisions on intellectual property, warranties, liability, and disputes.</p>
        <p>If you do not agree to these terms, do not use the website or join the waitlist. Our <Link href="/privacy">Privacy Policy</Link> explains how the website handles information.</p>
      </section>
      <section>
        <h2>2. Accounts and the waitlist</h2>
        <p>Use a Google account or email address you control to sign in. Your first sign-in creates a mux account. Email sign-in uses a one-time link instead of a password. Signing in does not automatically join the waitlist or subscribe you to marketing emails. Keep your Google account and email account secure, do not share sign-in links, and contact us if you suspect unauthorized access.</p>
        <p>The waitlist is free. Use an email address you control and provide accurate information. The website is intended for adults aged 18 or older.</p>
        <p>Joining lets us contact you about mux and early access. You can unsubscribe from marketing emails at any time. A signup does not guarantee access, a launch date, or a place in a paid program.</p>
      </section>
      <section>
        <h2>3. Product previews and earnings</h2>
        <p>mux is in development. The Claude Code and Desktop windows, ads, and balances on this website are demonstrations. They do not create an account balance, earn money, or make a payment.</p>
        <p>We have not set final revenue shares, qualifying ad views, payout methods, minimum balances, or payment schedules. Any future earnings program will explain those rules before you join. This website does not promise a minimum income.</p>
      </section>
      <section>
        <h2>4. Acceptable use</h2>
        <p>Do not submit someone else’s email without permission, send spam, automate abusive signups, bypass security controls, or interfere with the website. We may reject abusive requests or suspend access to protect the service.</p>
      </section>
      <section>
        <h2>5. Third-party products and links</h2>
        <p>Claude, Claude Code, and Claude Desktop are third-party products. Their names and logos belong to their owners. Showing a product or sample advertiser does not mean that its owner endorses mux.</p>
        <p>Linked websites have their own terms and privacy policies. Any future mod use must also comply with the applicable AI provider’s rules and your employer’s device and software policies.</p>
      </section>
      <section>
        <h2>6. Availability and changes</h2>
        <p>We may update the website, previews, or waitlist as mux develops. The website may be unavailable during maintenance or service interruptions. We will date changes to these terms here; Koah’s Terms of Use explain the broader legal terms.</p>
      </section>
      <section>
        <h2>7. Contact</h2>
        <p>For questions about mux or these terms, email <a href="mailto:support@koahlabs.com">support@koahlabs.com</a>.</p>
      </section>
    </LegalPage>
  );
}
