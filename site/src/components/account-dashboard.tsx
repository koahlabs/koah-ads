import Link from "next/link";
import { BrandLink } from "@/components/brand-link";
import { SiteFooter } from "@/components/site-footer";
import { AuthForm } from "@/components/auth-form";
import { Icon } from "@/components/icon";
import { DashboardContent } from "@/components/dashboard-content";
import { SetupWizard } from "@/components/setup-wizard";
import type { DashboardData, SetupStatus, StripeStatus } from "@/lib/dashboard";

export function AccountDashboard({
  name,
  email,
  data,
  stripeStatus,
  countries,
  notice,
  setup,
}: {
  name: string;
  email: string;
  data: DashboardData;
  stripeStatus: StripeStatus;
  countries: string[];
  notice?: string;
  setup: SetupStatus | null;
}) {
  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header-inner">
          <div className="wordmark">
            <BrandLink />
          </div>
          <details className="dashboard-account-menu">
            <summary aria-label="Account menu">
              <span className="dashboard-avatar" aria-hidden="true">
                {name.slice(0, 1).toUpperCase()}
              </span>
              <span className="dashboard-account-name">{name}</span>
              <Icon name="caret-down" size={12} />
            </summary>
            <div className="dashboard-account-popover">
              <p>{email}</p>
              <Link className="dashboard-connect-link" href="/connect">
                Connect a computer
              </Link>
              <AuthForm mode="sign-out" />
            </div>
          </details>
        </div>
      </header>
      <main id="main-content" className="dashboard-main">
        {setup && !setup.hasQueries ? (
          <SetupWizard initial={setup} />
        ) : (
          <DashboardContent
            data={data}
            stripeStatus={stripeStatus}
            countries={countries}
            notice={notice}
          />
        )}
      </main>
      <div className="dashboard-footer">
        <SiteFooter />
      </div>
    </div>
  );
}
