"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Transaction = {
  id: string;
  customer_id: string;
  amount_cents: number;
  currency: string;
  merchant: string;
  country: string;
  channel: string;
  device_id: string;
  risk_score: number;
  risk_level: string;
  status: string;
  decision: string | null;
  reasons: string;
  model_version: string;
  occurred_at: string;
};
type Case = {
  id: string;
  transaction_id: string;
  title: string;
  priority: string;
  status: string;
  owner: string;
  notes: string;
  updated_at: string;
};
type Audit = {
  id: string;
  action: string;
  entity_id: string;
  created_at: string;
  metadata: string;
};
type Model = {
  version: string;
  status: string;
  precision: number;
  recall: number;
  drift: number;
  latencyMs: number;
};
type Dataset = {
  transactions: Transaction[];
  cases: Case[];
  audit: Audit[];
  user: { name: string };
  model: Model;
};
type View = "overview" | "transactions" | "reviews" | "cases" | "model";

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
const when = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
const parseReasons = (value: string): string[] => {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
};

export function RiskConsole() {
  const [view, setView] = useState<View>("overview");
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/risk", { cache: "no-store" });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Sign in is required to access Risk//OS."
            : "Unable to load risk operations data.",
        );
      setData(await response.json());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    }
  }, []);
  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const transactions = useMemo(() => data?.transactions ?? [], [data]);
  const pending = transactions.filter(
    (tx) => tx.status === "pending" || tx.status === "investigating",
  );
  const filtered = transactions.filter((tx) =>
    `${tx.id} ${tx.customer_id} ${tx.merchant} ${tx.country}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const metrics = useMemo(
    () => ({
      critical: transactions.filter((tx) => tx.risk_score >= 85).length,
      reviewed: transactions.filter((tx) => tx.status === "cleared").length,
      protected: transactions
        .filter((tx) => tx.decision === "block")
        .reduce((sum, tx) => sum + tx.amount_cents, 0),
    }),
    [transactions],
  );

  async function action(payload: Record<string, unknown>, success: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/risk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Action failed");
      setToast(success);
      setSelected(null);
      await load();
      return body;
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Action failed");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  const nav: { id: View; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "transactions", label: "Transactions" },
    { id: "reviews", label: "Review queue" },
    { id: "cases", label: "Cases" },
    { id: "model", label: "Model health" },
  ];

  if (error)
    return (
      <main className="fatal">
        <div className="wordmark">
          <span>R</span> RISK//OS
        </div>
        <h1>Risk operations are unavailable</h1>
        <p>{error}</p>
        <button onClick={() => void load()}>Try again</button>
      </main>
    );
  if (!data)
    return (
      <main className="loading">
        <div className="loader" />
        <p>Connecting to risk operations…</p>
      </main>
    );

  return (
    <main className="appShell">
      <aside className="sidebar">
        <button className="wordmark" onClick={() => setView("overview")}>
          <span>R</span> RISK//OS
        </button>
        <nav aria-label="Product navigation">
          {nav.map((item, index) => (
            <button
              className={view === item.id ? "active" : ""}
              onClick={() => setView(item.id)}
              key={item.id}
            >
              <b>0{index + 1}</b>
              {item.label}
              {item.id === "reviews" && <i>{pending.length}</i>}
            </button>
          ))}
        </nav>
        <div className="sidebarFoot">
          <span className="liveDot" /> Scoring live <small>v2.4.1</small>
        </div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div>
            <p>
              Risk operations / {nav.find((item) => item.id === view)?.label}
            </p>
            <h1>
              {view === "overview"
                ? "Good morning, Harshith."
                : nav.find((item) => item.id === view)?.label}
            </h1>
          </div>
          <div className="topActions">
            <button
              className="searchButton"
              onClick={() => setView("transactions")}
              aria-label="Search transactions"
            >
              ⌕
            </button>
            <button className="primary" onClick={() => setScoreOpen(true)}>
              + Score transaction
            </button>
            <span className="avatar">HS</span>
          </div>
        </header>
        <div className="notice">
          <span>SYNTHETIC DATA</span> Safe demonstration environment — no real
          customer or financial data.
        </div>
        {view === "overview" && (
          <Overview
            transactions={transactions}
            cases={data.cases}
            metrics={metrics}
            onOpen={setSelected}
            onView={setView}
          />
        )}
        {view === "transactions" && (
          <Transactions
            rows={filtered}
            query={query}
            setQuery={setQuery}
            onOpen={setSelected}
          />
        )}
        {view === "reviews" && <Reviews rows={pending} onOpen={setSelected} />}
        {view === "cases" && <Cases rows={data.cases} />}
        {view === "model" && (
          <ModelHealth model={data.model} audit={data.audit} />
        )}
      </section>
      {selected && (
        <TransactionDrawer
          transaction={selected}
          busy={busy}
          onClose={() => setSelected(null)}
          onDecision={(decision) =>
            void action(
              { action: "decide", transactionId: selected.id, decision },
              `Transaction ${decision === "block" ? "blocked" : "approved"}`,
            )
          }
          onCase={(title, notes) =>
            void action(
              {
                action: "create_case",
                transactionId: selected.id,
                title,
                notes,
              },
              "Investigation case created",
            )
          }
        />
      )}
      {scoreOpen && (
        <ScoreModal
          busy={busy}
          onClose={() => setScoreOpen(false)}
          onSubmit={async (payload) =>
            action(
              { action: "score", ...payload },
              "Transaction scored and added to the queue",
            )
          }
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}

function Overview({
  transactions,
  cases,
  metrics,
  onOpen,
  onView,
}: {
  transactions: Transaction[];
  cases: Case[];
  metrics: { critical: number; reviewed: number; protected: number };
  onOpen: (tx: Transaction) => void;
  onView: (view: View) => void;
}) {
  const queue = transactions
    .filter((tx) => tx.status === "pending")
    .slice(0, 3);
  return (
    <>
      <div className="metrics">
        <article>
          <span>Transactions monitored</span>
          <strong>12.4M</strong>
          <small className="up">↑ 8.2%</small>
        </article>
        <article>
          <span>High-risk signals</span>
          <strong>{metrics.critical.toLocaleString()}</strong>
          <small className="down">Live queue</small>
        </article>
        <article>
          <span>Value protected</span>
          <strong>{money(metrics.protected || 2860000)}</strong>
          <small className="up">↑ 18.4%</small>
        </article>
        <article>
          <span>Median response</span>
          <strong>4m 12s</strong>
          <small>Target &lt; 5m</small>
        </article>
      </div>
      <div className="dashboardGrid">
        <article className="panel riskPanel">
          <header>
            <div>
              <p>Risk activity</p>
              <h2>Signals over time</h2>
            </div>
            <select aria-label="Risk activity period">
              <option>Last 7 days</option>
            </select>
          </header>
          <div className="chartWrap">
            <div className="yLabels">
              <span>600</span>
              <span>400</span>
              <span>200</span>
              <span>0</span>
            </div>
            <div className="areaChart" aria-label="Risk activity chart">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <b className="threshold">Review threshold</b>
            </div>
          </div>
          <div className="chartLegend">
            <span>
              <i className="high" /> High risk
            </span>
            <span>
              <i className="medium" /> Medium risk
            </span>
            <span>
              <i className="low" /> Low risk
            </span>
          </div>
        </article>
        <article className="panel queuePanel">
          <header>
            <div>
              <p>Priority queue</p>
              <h2>Needs review</h2>
            </div>
            <button className="textButton" onClick={() => onView("reviews")}>
              View all ↗
            </button>
          </header>
          <div className="queue">
            {queue.map((tx) => (
              <button onClick={() => onOpen(tx)} key={tx.id}>
                <span
                  className={`score ${tx.risk_score >= 85 ? "critical" : "warning"}`}
                >
                  {tx.risk_score}
                </span>
                <p>
                  <b>{parseReasons(tx.reasons)[0] ?? "Risk signal"}</b>
                  <small>
                    {tx.id} · {tx.merchant}
                  </small>
                </p>
                <time>{when(tx.occurred_at)}</time>
              </button>
            ))}
          </div>
        </article>
      </div>
      <div className="lowerGrid">
        <article className="panel mix">
          <header>
            <div>
              <p>Decision mix</p>
              <h2>Today’s outcomes</h2>
            </div>
          </header>
          <div className="donut">
            <div>
              <strong>96.8%</strong>
              <span>auto cleared</span>
            </div>
          </div>
          <ul>
            <li>
              <span className="dot green" />
              Approved <b>11.9M</b>
            </li>
            <li>
              <span className="dot orange" />
              Reviewed <b>{metrics.reviewed}</b>
            </li>
            <li>
              <span className="dot red" />
              Blocked{" "}
              <b>
                {transactions.filter((tx) => tx.decision === "block").length}
              </b>
            </li>
          </ul>
        </article>
        <article className="panel caseSummary">
          <header>
            <div>
              <p>Investigations</p>
              <h2>Open cases</h2>
            </div>
            <button className="textButton" onClick={() => onView("cases")}>
              Case workspace ↗
            </button>
          </header>
          {cases.slice(0, 2).map((item) => (
            <div className="miniCase" key={item.id}>
              <span className={`priority ${item.priority}`}>
                {item.priority}
              </span>
              <div>
                <b>{item.title}</b>
                <small>
                  {item.id} · {item.owner}
                </small>
              </div>
              <span>{item.status}</span>
            </div>
          ))}
        </article>
      </div>
    </>
  );
}

function Transactions({
  rows,
  query,
  setQuery,
  onOpen,
}: {
  rows: Transaction[];
  query: string;
  setQuery: (value: string) => void;
  onOpen: (tx: Transaction) => void;
}) {
  return (
    <article className="panel tablePanel">
      <div className="tableTools">
        <div>
          <p>Transaction explorer</p>
          <h2>All scored transactions</h2>
        </div>
        <label>
          ⌕{" "}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search ID, customer, merchant…"
          />
        </label>
      </div>
      <div className="tableScroll">
        <table>
          <thead>
            <tr>
              <th>Transaction</th>
              <th>Customer</th>
              <th>Merchant</th>
              <th>Amount</th>
              <th>Location</th>
              <th>Risk</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((tx) => (
              <tr key={tx.id}>
                <td>
                  <b>{tx.id}</b>
                  <small>{when(tx.occurred_at)}</small>
                </td>
                <td>{tx.customer_id}</td>
                <td>{tx.merchant}</td>
                <td>{money(tx.amount_cents)}</td>
                <td>{tx.country}</td>
                <td>
                  <span className={`riskPill ${tx.risk_level}`}>
                    {tx.risk_score} · {tx.risk_level}
                  </span>
                </td>
                <td>
                  <span className={`statusPill ${tx.status}`}>
                    {tx.decision ?? tx.status}
                  </span>
                </td>
                <td>
                  <button
                    onClick={() => onOpen(tx)}
                    aria-label={`Open ${tx.id}`}
                  >
                    →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p className="empty">No transactions match this search.</p>
      )}
    </article>
  );
}

function Reviews({
  rows,
  onOpen,
}: {
  rows: Transaction[];
  onOpen: (tx: Transaction) => void;
}) {
  return (
    <div className="reviewLayout">
      <article className="panel reviewIntro">
        <p>Investigator workspace</p>
        <h2>Resolve the highest-impact signals first.</h2>
        <div>
          <strong>{rows.length}</strong>
          <span>items waiting</span>
        </div>
        <small>
          Queue ordering combines risk score, transaction value, and age.
        </small>
      </article>
      <div className="reviewCards">
        {rows
          .sort((a, b) => b.risk_score - a.risk_score)
          .map((tx) => (
            <button
              className="reviewCard"
              onClick={() => onOpen(tx)}
              key={tx.id}
            >
              <div className={`scoreRing ${tx.risk_level}`}>
                <strong>{tx.risk_score}</strong>
                <span>risk</span>
              </div>
              <div>
                <span className="overline">
                  {tx.id} · {when(tx.occurred_at)}
                </span>
                <h3>{tx.merchant}</h3>
                <p>{parseReasons(tx.reasons).slice(0, 2).join(" · ")}</p>
              </div>
              <div className="reviewAmount">
                <strong>{money(tx.amount_cents)}</strong>
                <span>
                  {tx.country} · {tx.channel.replaceAll("_", " ")}
                </span>
              </div>
              <span className="arrow">→</span>
            </button>
          ))}
      </div>
    </div>
  );
}

function Cases({ rows }: { rows: Case[] }) {
  return (
    <div className="caseBoard">
      <div className="caseColumn">
        <header>
          <span>Open</span>
          <b>{rows.filter((row) => row.status === "open").length}</b>
        </header>
        {rows
          .filter((row) => row.status === "open")
          .map((item) => (
            <CaseCard item={item} key={item.id} />
          ))}
      </div>
      <div className="caseColumn">
        <header>
          <span>Investigating</span>
          <b>{rows.filter((row) => row.status === "investigating").length}</b>
        </header>
        {rows
          .filter((row) => row.status === "investigating")
          .map((item) => (
            <CaseCard item={item} key={item.id} />
          ))}
      </div>
      <div className="caseColumn mutedColumn">
        <header>
          <span>Resolved</span>
          <b>0</b>
        </header>
        <div className="emptyCard">Resolved cases will appear here.</div>
      </div>
    </div>
  );
}
function CaseCard({ item }: { item: Case }) {
  return (
    <article className="caseCard">
      <div>
        <span className={`priority ${item.priority}`}>{item.priority}</span>
        <small>{item.id}</small>
      </div>
      <h3>{item.title}</h3>
      <p>{item.notes}</p>
      <footer>
        <span className="avatar small">
          {item.owner === "Unassigned" ? "?" : "HS"}
        </span>
        <span>{item.owner}</span>
        <time>{when(item.updated_at)}</time>
      </footer>
    </article>
  );
}

function ModelHealth({ model, audit }: { model: Model; audit: Audit[] }) {
  return (
    <>
      <div className="modelHero">
        <div>
          <span className="liveDot" /> PRODUCTION MODEL
        </div>
        <h2>{model.version}</h2>
        <p>
          Explainable hybrid rules baseline for real-time transaction screening.
        </p>
        <button>Healthy · no action required</button>
      </div>
      <div className="modelMetrics">
        <article>
          <span>Precision</span>
          <strong>{(model.precision * 100).toFixed(1)}%</strong>
          <i style={{ width: `${model.precision * 100}%` }} />
        </article>
        <article>
          <span>Recall</span>
          <strong>{(model.recall * 100).toFixed(1)}%</strong>
          <i style={{ width: `${model.recall * 100}%` }} />
        </article>
        <article>
          <span>Feature drift</span>
          <strong>{(model.drift * 100).toFixed(1)}%</strong>
          <i className="safe" style={{ width: `${model.drift * 100 * 5}%` }} />
        </article>
        <article>
          <span>P95 latency</span>
          <strong>{model.latencyMs} ms</strong>
          <i style={{ width: "38%" }} />
        </article>
      </div>
      <div className="modelGrid">
        <article className="panel">
          <header>
            <div>
              <p>Controls</p>
              <h2>Production safeguards</h2>
            </div>
          </header>
          <ul className="checkList">
            <li>
              <span>✓</span>
              <div>
                <b>Input validation</b>
                <small>Strict bounds, enums, and ISO country codes</small>
              </div>
            </li>
            <li>
              <span>✓</span>
              <div>
                <b>Explainable decisions</b>
                <small>Every score includes ranked risk factors</small>
              </div>
            </li>
            <li>
              <span>✓</span>
              <div>
                <b>Human review</b>
                <small>Medium and high risk decisions stay reversible</small>
              </div>
            </li>
            <li>
              <span>✓</span>
              <div>
                <b>Immutable audit events</b>
                <small>Every investigator action is attributed</small>
              </div>
            </li>
          </ul>
        </article>
        <article className="panel">
          <header>
            <div>
              <p>Audit trail</p>
              <h2>Recent events</h2>
            </div>
          </header>
          <div className="auditList">
            {audit.length ? (
              audit.map((event) => (
                <div key={event.id}>
                  <span>↳</span>
                  <p>
                    <b>{event.action.replaceAll(".", " ")}</b>
                    <small>{event.entity_id}</small>
                  </p>
                  <time>{when(event.created_at)}</time>
                </div>
              ))
            ) : (
              <p className="empty">
                Actions appear here as investigators work.
              </p>
            )}
          </div>
        </article>
      </div>
    </>
  );
}

function TransactionDrawer({
  transaction,
  busy,
  onClose,
  onDecision,
  onCase,
}: {
  transaction: Transaction;
  busy: boolean;
  onClose: () => void;
  onDecision: (value: "approve" | "block") => void;
  onCase: (title: string, notes: string) => void;
}) {
  const [caseMode, setCaseMode] = useState(false);
  const [title, setTitle] = useState(`Review ${transaction.id}`);
  const [notes, setNotes] = useState("");
  return (
    <div className="overlay">
      <aside className="drawer" aria-label="Transaction details">
        <header>
          <div>
            <span className="overline">Transaction review</span>
            <h2>{transaction.id}</h2>
          </div>
          <button onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="drawerScore">
          <div className={`scoreRing ${transaction.risk_level}`}>
            <strong>{transaction.risk_score}</strong>
            <span>risk</span>
          </div>
          <div>
            <span className={`riskPill ${transaction.risk_level}`}>
              {transaction.risk_level} risk
            </span>
            <p>Model {transaction.model_version}</p>
          </div>
        </div>
        <dl>
          <div>
            <dt>Amount</dt>
            <dd>{money(transaction.amount_cents)}</dd>
          </div>
          <div>
            <dt>Merchant</dt>
            <dd>{transaction.merchant}</dd>
          </div>
          <div>
            <dt>Customer</dt>
            <dd>{transaction.customer_id}</dd>
          </div>
          <div>
            <dt>Country / channel</dt>
            <dd>
              {transaction.country} · {transaction.channel.replaceAll("_", " ")}
            </dd>
          </div>
          <div>
            <dt>Device</dt>
            <dd>{transaction.device_id}</dd>
          </div>
          <div>
            <dt>Observed</dt>
            <dd>{when(transaction.occurred_at)}</dd>
          </div>
        </dl>
        <section className="reasonList">
          <span className="overline">Why this score</span>
          {parseReasons(transaction.reasons).map((reason, index) => (
            <div key={reason}>
              <span>{index + 1}</span>
              <p>{reason}</p>
            </div>
          ))}
        </section>
        {caseMode ? (
          <form
            className="caseForm"
            onSubmit={(event) => {
              event.preventDefault();
              onCase(title, notes);
            }}
          >
            <label>
              Case title
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              Investigator notes
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add context for the investigation…"
              />
            </label>
            <div>
              <button type="button" onClick={() => setCaseMode(false)}>
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                Create case
              </button>
            </div>
          </form>
        ) : (
          <footer className="drawerActions">
            <button
              disabled={busy || transaction.status === "cleared"}
              onClick={() => onDecision("approve")}
            >
              ✓ Approve
            </button>
            <button
              disabled={busy || transaction.status === "cleared"}
              className="danger"
              onClick={() => onDecision("block")}
            >
              ⊘ Block
            </button>
            <button
              disabled={busy || transaction.status === "cleared"}
              className="primary"
              onClick={() => setCaseMode(true)}
            >
              Create case
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}

function ScoreModal({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (
    payload: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
}) {
  const [result, setResult] = useState<{
    score: number;
    level: string;
    recommendation: string;
    reasons: { label: string }[];
  } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      customerId: form.get("customerId"),
      merchant: form.get("merchant"),
      input: {
        amount: Number(form.get("amount")),
        country: String(form.get("country")).toUpperCase(),
        homeCountry: String(form.get("homeCountry")).toUpperCase(),
        channel: form.get("channel"),
        newDevice: form.get("newDevice") === "on",
        velocity3m: Number(form.get("velocity3m")),
        distanceFromLastKm: Number(form.get("distance")),
        minutesSinceLast: Number(form.get("minutes")),
      },
    };
    const response = await onSubmit(payload);
    setResult(response as typeof result);
  }
  return (
    <div className="overlay">
      <div className="modal">
        <header>
          <div>
            <span className="overline">Live assessment</span>
            <h2>Score a transaction</h2>
          </div>
          <button onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {result ? (
          <div className="scoreResult">
            <div className={`scoreRing ${result.level}`}>
              <strong>{result.score}</strong>
              <span>risk</span>
            </div>
            <h3>{result.recommendation}</h3>
            <p>{result.reasons.map((reason) => reason.label).join(" · ")}</p>
            <button className="primary" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <form className="scoreForm" onSubmit={submit}>
            <div className="formGrid">
              <label>
                Customer ID
                <input name="customerId" defaultValue="CUS-2048" required />
              </label>
              <label>
                Merchant
                <input
                  name="merchant"
                  defaultValue="Vertex Marketplace"
                  required
                />
              </label>
              <label>
                Amount (USD)
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue="6200"
                  required
                />
              </label>
              <label>
                Transaction country
                <input
                  name="country"
                  maxLength={2}
                  defaultValue="SG"
                  required
                />
              </label>
              <label>
                Customer home country
                <input
                  name="homeCountry"
                  maxLength={2}
                  defaultValue="US"
                  required
                />
              </label>
              <label>
                Channel
                <select name="channel" defaultValue="card_not_present">
                  <option value="card_present">Card present</option>
                  <option value="card_not_present">Card not present</option>
                  <option value="bank_transfer">Bank transfer</option>
                </select>
              </label>
              <label>
                Attempts in 3 min
                <input
                  name="velocity3m"
                  type="number"
                  min="0"
                  defaultValue="7"
                  required
                />
              </label>
              <label>
                Distance from last (km)
                <input
                  name="distance"
                  type="number"
                  min="0"
                  defaultValue="6800"
                />
              </label>
              <label>
                Minutes since last
                <input name="minutes" type="number" min="0" defaultValue="42" />
              </label>
              <label className="checkbox">
                <input name="newDevice" type="checkbox" defaultChecked />{" "}
                Previously unseen device
              </label>
            </div>
            <footer>
              <button type="button" onClick={onClose}>
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                {busy ? "Scoring…" : "Run risk assessment →"}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}
