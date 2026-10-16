import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy | Sidequest",
  description:
    "How Sidequest handles waitlist information, accounts, email updates, and your privacy choices.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <section>
        <h2>1. Who we are and what this covers</h2>
        <p>
          Sidequest is a project of Koah Labs Inc. This notice covers the Sidequest website,
          accounts, and early access waitlist. It explains the current website’s data practices
          alongside{" "}
          <a href="https://www.koahlabs.com/legal/privacy-policy">Koah’s Privacy Policy</a>.
        </p>
        <p>
          The mod is still in development. We will explain its data collection, advertising, and
          payout practices before asking you to install it or join an earnings program.
        </p>
      </section>
      <section>
        <h2>2. Information we collect</h2>
        <p>
          If you join the waitlist, we store your email address, signup date, and whether we sent
          your welcome email. If you contact us, we receive the information you include in your
          message.
        </p>
        <p>
          If you sign in with Google, Supabase stores your account ID, email address, name, profile
          image when provided, and sign-in records. Google verifies your identity; we do not receive
          your Google password.
        </p>
        <p>
          If you sign in with email, Supabase stores your account ID, email address, and sign-in
          records. We send a one-time sign-in link to verify that you control the address. You do
          not need to create a password.
        </p>
        <p>
          Our hosting provider processes technical request information, including IP addresses and
          browser information, to deliver and protect the website. The signup service temporarily
          uses a hashed IP address to limit repeated requests.
        </p>
      </section>
      <section>
        <h2>3. What this website does not collect</h2>
        <p>
          The sample Claude views use fixed demo content. They do not read your screen, source code,
          files, Claude prompts, or AI responses. The waitlist does not ask for bank details,
          payment cards, or tax information.
        </p>
      </section>
      <section>
        <h2>4. How we use and share information</h2>
        <p>
          We use signup information to manage the waitlist, send a welcome email and Sidequest
          updates, and prevent duplicate messages. We use technical information to operate the site
          and prevent abuse.
        </p>
        <p>
          <a href="https://loops.so/privacy">Loops</a> manages waitlist contacts and email delivery.
          Email services may record delivery, opens, and link clicks.{" "}
          <a href="https://vercel.com/legal/privacy-notice">Vercel</a> hosts the website. These
          providers process information to support those services.
        </p>
        <p>
          <a href="https://supabase.com/privacy">Supabase</a> manages accounts and sign-in sessions.{" "}
          <a href="https://policies.google.com/privacy">Google</a> verifies Google sign-ins. We
          request basic account identity and profile information to sign you in. Signing in does not
          automatically subscribe you to marketing emails or add you to the waitlist.
        </p>
        <p>
          Our email provider delivers sign-in links. These are account messages, separate from
          marketing emails. We disable link tracking on the sign-in links in our Loops email
          template.
        </p>
        <p>
          The sample ads do not send waitlist information to advertising partners. Koah’s Privacy
          Policy explains other disclosures, including legal requests and business transfers.
        </p>
      </section>
      <section>
        <h2>5. Browser storage</h2>
        <p>
          We save your light or dark mode choice in your browser’s local storage under
          “sidequest-theme.” You can remove it by clearing this site’s browser data. We also use
          cookies to keep you signed in and complete Google or email sign-in. Signing out clears the
          current sign-in session. The current website does not include advertising pixels or
          session replay tools.
        </p>
      </section>
      <section>
        <h2>6. Your choices and privacy requests</h2>
        <p>
          You can stop marketing emails through their unsubscribe link or contact us. To request
          access, correction, or deletion of your account or waitlist information, email{" "}
          <a href="mailto:privacy@koahlabs.com">privacy@koahlabs.com</a> from the address you used
          to sign up.
        </p>
        <p>
          Your legal rights depend on where you live. Koah’s Privacy Policy explains the available
          request channels and limits. We may need to confirm your identity before completing a
          request.
        </p>
      </section>
      <section>
        <h2>7. Retention, security, and children</h2>
        <p>
          We keep information for the purposes described here and as needed for legal obligations,
          security, and disputes, as explained in Koah’s Privacy Policy. Removing yourself from
          email updates does not automatically delete all retained records.
        </p>
        <p>
          The website uses HTTPS and server-side credentials for email services. No online service
          can guarantee complete security. This site is intended for adults aged 18 or older,
          consistent with Koah’s Privacy Policy.
        </p>
      </section>
      <section>
        <h2>8. Changes and contact</h2>
        <p>
          We will update this page as the website changes. Material changes will receive notice as
          described in Koah’s Privacy Policy.
        </p>
        <p>
          For privacy questions, contact{" "}
          <a href="mailto:privacy@koahlabs.com">privacy@koahlabs.com</a> or write to Koah Labs Inc.,
          163 Second Street, Suite 300, San Francisco, CA 94105.
        </p>
      </section>
    </LegalPage>
  );
}
