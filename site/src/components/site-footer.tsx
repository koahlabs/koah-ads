import Link from "next/link";
import { PayoutCounter } from "@/components/payout-counter";
import { koahPayoutEstimate } from "@/lib/payout-estimate";
import { getCurrentPayoutEstimate } from "@/lib/payout-estimate-server";

async function FooterPayout() {
  const initialCents = await getCurrentPayoutEstimate();
  return <PayoutCounter model={koahPayoutEstimate} initialCents={initialCents} />;
}

export function SiteFooter({ showPayouts = false }: { showPayouts?: boolean }) {
  return (
    <footer className="site-footer">
      <p className="text-divider" aria-hidden="true">
        {"/////////"}
      </p>
      {showPayouts && <FooterPayout />}
      <div className="footer-row">
        <p className="footer-credit">
          By{" "}
          <a href="https://www.koahlabs.com/" target="_blank" rel="noopener noreferrer">
            Koah Labs
          </a>
        </p>
        <nav className="footer-legal" aria-label="Legal">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms of Use</Link>
        </nav>
      </div>
    </footer>
  );
}
