import type { PortfolioPayload } from "../../shared/types";
import { money } from "../lib/format";

export function ScheduleView({ data }: { data: PortfolioPayload }) {
  const nowKey = new Date().toISOString().slice(0, 7);
  const payingMonths = data.calendar.filter((m) => m.total > 0).length;

  return (
    <div>
      <div className="card">
        <h3>HARVEST CALENDAR</h3>
        <p className="hint" style={{ marginTop: 0 }}>
          {payingMonths} of the last 12 months had payouts — that is the rhythm of your cash flow.
        </p>
        <div className="months">
          {data.calendar.map((m) => (
            <div key={m.key} className={`month${m.key === nowKey ? " now" : ""}`}>
              <div className="m-label">
                {m.label}
                {m.key === nowKey ? " · now" : ""}
              </div>
              <div className={`m-total${m.total > 0 ? "" : " zero"}`}>
                {m.total > 0 ? money(data, m.total) : "—"}
              </div>
              <div className="chips">
                {m.items.map((it) => (
                  <span key={it.symbol} className="chip">
                    {it.symbol} {money(data, it.amount)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="hint">
        Built from your payout history (dividend activities in Ghostfolio), newest twelve months.
      </p>
    </div>
  );
}
