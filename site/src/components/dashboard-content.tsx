"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { StripeConnectForm } from "@/components/stripe-connect-form";
import {
  canConnectStripe,
  centsUntilStripe,
  formatCount,
  formatDate,
  formatFullDate,
  formatMoney,
  recentActivity,
  PAYOUT_THRESHOLD_CENTS,
  type DashboardData,
  type StripeStatus,
} from "@/lib/dashboard";

export function DashboardContent({
  data,
  stripeStatus,
  countries,
  notice = "",
}: {
  data: DashboardData;
  stripeStatus: StripeStatus;
  countries: string[];
  notice?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const days = [7, 30, 90].find((option) => String(option) === searchParams.get("days")) ?? 30;
  const metric = searchParams.get("metric") === "impressions" ? "impressions" : "earnings";
  const activity = recentActivity(data.daily, days, data.asOf);
  const eligible = data.available && canConnectStripe(data.balanceCents);
  const connected = stripeStatus === "connected";
  const incomplete = stripeStatus === "incomplete";
  const periodEarnings = activity.reduce((sum, item) => sum + item.earnedCents, 0);
  const periodImpressions = activity.reduce((sum, item) => sum + item.impressions, 0);
  const showChart = activity.some((item) => item.impressions > 0 || item.earnedCents > 0);
  const earningsMetric = metric === "earnings";
  const total = earningsMetric ? periodEarnings : periodImpressions;
  const values = activity.map((item) => (earningsMetric ? item.earnedCents : item.impressions));
  const step = earningsMetric ? 100 : 10;
  const ceiling = Math.ceil(Math.max(...values, step) / step) * step;
  const formatValue = earningsMetric ? formatMoney : formatCount;
  const x = (index: number) => 72 + (index * 564) / Math.max(1, days - 1);
  const points = values.map((value, index) => `${x(index)},${178 - (value / ceiling) * 150}`);
  const queryLink = (updates: Record<string, string>) =>
    `/account?${new URLSearchParams({ days: String(days), metric, ...updates })}`;
  const payoutHelp = !data.available
    ? "Your balance is unavailable. Refresh the page to try again."
    : connected
      ? "Stripe is connected. Manage your bank details in Stripe."
      : incomplete
        ? "Finish your Stripe setup to enable payouts."
        : !eligible
          ? `Earn ${formatMoney(centsUntilStripe(data.balanceCents))} more to unlock Stripe setup.`
          : stripeStatus === "unavailable"
            ? "Stripe setup is unavailable right now. Your earnings stay in your balance."
            : "Connect Stripe to set up payouts to your bank account.";

  return (
    <>
      <div className="dashboard-title-row">
        <h1>Overview</h1>
      </div>
      {(!data.available || notice) && (
        <div className="dashboard-notice" role="status">
          <Icon name="info" />
          <p>
            {!data.available
              ? "We could not load your earnings. Your balance has not changed."
              : notice}
          </p>
          <button type="button" onClick={() => router.refresh()}>
            Refresh
            <Icon name="replay" size={14} />
          </button>
        </div>
      )}

      <div className="dashboard-workspace">
        <section className="dashboard-activity" aria-labelledby="activity-heading">
          <div className="dashboard-section-heading">
            <h2 id="activity-heading">Activity</h2>
            <label className="dashboard-range">
              <span className="sr-only">Activity period</span>
              <select
                value={days}
                onChange={(event) =>
                  router.push(queryLink({ days: event.target.value }), { scroll: false })
                }
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
              <Icon name="caret-down" size={12} />
            </label>
          </div>
          <nav className="dashboard-metric-tabs" aria-label="Activity metric">
            <Link
              href={queryLink({ metric: "earnings" })}
              scroll={false}
              aria-current={earningsMetric ? "page" : undefined}
            >
              <span>Earnings</span>
              <strong>{data.available ? formatMoney(periodEarnings) : "—"}</strong>
            </Link>
            <Link
              href={queryLink({ metric: "impressions" })}
              scroll={false}
              aria-current={earningsMetric ? undefined : "page"}
            >
              <span>Impressions</span>
              <strong>{data.available ? formatCount(periodImpressions) : "—"}</strong>
            </Link>
          </nav>
          <figure className={`dashboard-chart${showChart ? "" : " is-empty"}`}>
            {showChart ? (
              <svg
                viewBox="0 0 660 220"
                role="img"
                aria-label={`${earningsMetric ? "Daily earnings" : "Daily impressions"}, ${formatDate(activity[0].date)} to ${formatDate(data.asOf)}. ${formatValue(total)} total. Exact daily values appear in the table below.`}
              >
                {[0, 1, 2, 3].map((index) => (
                  <g key={index}>
                    <line
                      x1="72"
                      y1={28 + index * 50}
                      x2="636"
                      y2={28 + index * 50}
                      className="dashboard-chart-grid"
                    />
                    <text
                      x="60"
                      y={32 + index * 50}
                      textAnchor="end"
                      className="dashboard-chart-label"
                    >
                      {formatValue(Math.round((ceiling * (3 - index)) / 3))}
                    </text>
                  </g>
                ))}
                <polyline points={points.join(" ")} className="dashboard-chart-line" />
                {[0, Math.floor((days - 1) / 2), days - 1].map((index, tick) => (
                  <text
                    key={index}
                    x={x(index)}
                    y="208"
                    textAnchor={tick === 0 ? "start" : tick === 2 ? "end" : "middle"}
                    className="dashboard-chart-label"
                  >
                    {formatDate(activity[index].date)}
                  </text>
                ))}
              </svg>
            ) : (
              <figcaption className="dashboard-chart-empty">
                <strong>{data.available ? "No activity yet" : "Activity is unavailable"}</strong>
                <span>
                  {data.available
                    ? "Use Claude with Sidequest to start earning."
                    : "Refresh the page to try again."}
                </span>
                {data.available && <Link href="/connect">Connect a computer</Link>}
              </figcaption>
            )}
          </figure>
          {data.available && (
            <details className="dashboard-daily-details">
              <summary>
                View activity details
                <Icon name="caret-down" size={12} />
              </summary>
              <dl className="dashboard-lifetime">
                <div>
                  <dt>All-time earnings</dt>
                  <dd>{formatMoney(data.totalEarnedCents)}</dd>
                </div>
                <div>
                  <dt>All-time impressions</dt>
                  <dd>{formatCount(data.totalImpressions)}</dd>
                </div>
              </dl>
              {showChart && (
                <table className="dashboard-table">
                  <caption className="sr-only">
                    Daily activity in UTC for the last {days} days
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Date (UTC)</th>
                      <th scope="col" className="numeric">
                        Impressions
                      </th>
                      <th scope="col" className="numeric">
                        Earnings
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.toReversed().map((item) => (
                      <tr key={item.date}>
                        <td>{formatDate(item.date)}</td>
                        <td className="numeric">{formatCount(item.impressions)}</td>
                        <td className="numeric">{formatMoney(item.earnedCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </details>
          )}
        </section>

        <section className="dashboard-payout" aria-labelledby="payout-heading">
          <div className="dashboard-section-heading">
            <h2 id="payout-heading">Available balance</h2>
            <span className={`dashboard-connection-status${connected ? " is-connected" : ""}`}>
              {connected && <Icon name="check" size={13} />}
              {connected ? "Connected" : incomplete ? "Setup incomplete" : "Not connected"}
            </span>
          </div>
          <p className="dashboard-balance">
            {data.available ? formatMoney(data.balanceCents) : "—"}
            <span>USD</span>
          </p>
          <dl className="dashboard-paid-total">
            <dt>Paid out</dt>
            <dd>{data.available ? formatMoney(data.paidOutCents) : "—"}</dd>
          </dl>
          {data.pendingPayoutCents > 0 && (
            <p className="dashboard-pending">
              {formatMoney(data.pendingPayoutCents)} in pending payouts
            </p>
          )}
          <div className="dashboard-threshold">
            {data.available && !eligible && !connected && !incomplete && (
              <progress
                max={PAYOUT_THRESHOLD_CENTS + 1}
                value={Math.min(data.balanceCents, PAYOUT_THRESHOLD_CENTS + 1)}
                aria-label="Progress toward Stripe setup"
              />
            )}
            <p id="stripe-help">{payoutHelp}</p>
          </div>
          <StripeConnectForm
            key={stripeStatus}
            status={stripeStatus}
            eligible={eligible}
            countries={countries}
          />
          <p className="dashboard-stripe-note">
            Payouts powered by <strong translate="no">stripe</strong>
          </p>
        </section>
      </div>

      <section className="dashboard-history" aria-labelledby="history-heading">
        <div className="dashboard-section-heading">
          <h2 id="history-heading">Payout history</h2>
          {data.payouts.length > 0 && (
            <span className="dashboard-period">Latest {data.payouts.length} payouts</span>
          )}
        </div>
        {data.payouts.length > 0 ? (
          <table className="dashboard-table">
            <caption className="sr-only">Your recent payouts in US dollars</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Status</th>
                <th scope="col" className="numeric">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {data.payouts.map((payout) => (
                <tr key={payout.id}>
                  <td>{formatFullDate(payout.date)}</td>
                  <td>
                    <span className={`dashboard-payout-status is-${payout.status}`}>
                      <span aria-hidden="true" />
                      {payout.status === "paid"
                        ? "Paid"
                        : payout.status === "pending"
                          ? "Pending"
                          : "Failed"}
                    </span>
                  </td>
                  <td className="numeric">{formatMoney(payout.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="dashboard-history-empty">
            <Icon name="bank" size={18} />
            <div>
              <p>{data.available ? "No payouts yet" : "Payout history is unavailable"}</p>
              <span>
                {data.available
                  ? "Your payouts will appear here once they are sent."
                  : "Refresh the page to try again."}
              </span>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
