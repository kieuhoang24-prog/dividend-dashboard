import { useMemo, useState } from "react";
import type { PortfolioPayload } from "../../shared/types";
import { CROP_COLORS } from "../lib/art";
import { money } from "../lib/format";

type SortKey = "symbol" | "value" | "yieldPct" | "t12mDividend";

export function HoldingsView({ data }: { data: PortfolioPayload }) {
  const [sort, setSort] = useState<SortKey>("t12mDividend");
  const [asc, setAsc] = useState(false);

  const rows = useMemo(() => {
    const arr = [...data.holdings];
    arr.sort((a, b) => {
      const dir = asc ? 1 : -1;
      if (sort === "symbol") return a.symbol.localeCompare(b.symbol) * dir;
      return ((a[sort] as number) - (b[sort] as number)) * dir;
    });
    return arr;
  }, [data, sort, asc]);

  const toggle = (key: SortKey) => {
    if (key === sort) setAsc(!asc);
    else {
      setSort(key);
      setAsc(key === "symbol");
    }
  };
  const arrow = (key: SortKey) => (key === sort ? (asc ? " ▲" : " ▼") : "");

  return (
    <div className="card">
      <h3>HOLDINGS · HARVEST LOG</h3>
      <table>
        <thead>
          <tr>
            <th onClick={() => toggle("symbol")}>
              crop{arrow("symbol")}
            </th>
            <th style={{ textAlign: "left" }}>name</th>
            <th onClick={() => toggle("value")}>value{arrow("value")}</th>
            <th onClick={() => toggle("yieldPct")}>yield{arrow("yieldPct")}</th>
            <th onClick={() => toggle("t12mDividend")}>div / yr{arrow("t12mDividend")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => (
            <tr key={h.symbol}>
              <td className="sym">
                <span
                  className="crop-chip"
                  style={{ background: CROP_COLORS[h.cropIndex % CROP_COLORS.length] }}
                />
                {h.symbol}
              </td>
              <td className="nm">{h.name}</td>
              <td>{money(data, h.value)}</td>
              <td>{h.yieldPct.toFixed(1)}%</td>
              <td className="gold">{money(data, h.t12mDividend)}</td>
            </tr>
          ))}
          <tr>
            <td className="sym" colSpan={2}>
              TOTAL
            </td>
            <td>{money(data, data.totals.totalValue)}</td>
            <td>
              {data.totals.totalValue > 0
                ? `${((data.totals.annualDividend / data.totals.totalValue) * 100).toFixed(1)}%`
                : "—"}
            </td>
            <td className="gold">{money(data, data.totals.annualDividend)}</td>
          </tr>
        </tbody>
      </table>
      <p className="hint">div / yr = dividends actually received over the trailing 12 months.</p>
    </div>
  );
}
