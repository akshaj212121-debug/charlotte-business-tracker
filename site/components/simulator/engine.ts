// Paper trading simulator: pure state logic (no React), so the rules are easy to read and test.
// All money here is pretend "SIM$". Nothing is ever sent to a broker or exchange.

export const START_CASH = 100_000;
export const SPREAD = 0.0005; // simulated half-spread: buys fill 0.05% above the quote, sells 0.05% below
export const STORAGE_KEY = "cbt-sim-v1";
export const KEY_STORAGE = "cbt-sim-finnhub-key";

export type Side = "buy" | "sell";
export type OrderType = "market" | "limit";
export type OrderStatus = "pending" | "filled" | "cancelled" | "rejected";

export interface Order {
  id: string;
  symbol: string;
  side: Side;
  type: OrderType;
  qty: number;
  limit?: number;
  status: OrderStatus;
  created: number;
  filledAt?: number;
  fillPrice?: number;
  note?: string;
}

export interface Position { qty: number; cost: number } // cost = total cost basis in SIM$

export interface SimState {
  version: 1;
  cash: number;
  positions: Record<string, Position>;
  orders: Order[];
  realized: number;
  history: { t: number; v: number }[];
  watch: string[];
  ack: boolean;
  createdAt: number;
}

export interface Quote { price: number; change: number; changePct: number; prevClose: number; time: number; fetched: number }

export function freshState(ack = false): SimState {
  return {
    version: 1, cash: START_CASH, positions: {}, orders: [], realized: 0,
    history: [{ t: Date.now(), v: START_CASH }],
    watch: ["BAC", "LOW", "DUK", "NUE", "HON", "TFC", "SPY"],
    ack, createdAt: Date.now(),
  };
}

export const SYMBOL_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;

// US regular session: Mon-Fri 9:30-16:00 New York time. Exchange holidays are not modelled.
export function marketOpen(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = get("weekday");
  if (day === "Sat" || day === "Sun") return false;
  const mins = Number(get("hour")) * 60 + Number(get("minute"));
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export function newOrder(o: Omit<Order, "id" | "status" | "created">): Order {
  return { ...o, id: uid(), status: "pending", created: Date.now() };
}

// Cash already promised to pending buy orders, so a trader cannot spend the same SIM$ twice.
export function reservedCash(s: SimState, quotes: Record<string, Quote>): number {
  return s.orders.filter((o) => o.status === "pending" && o.side === "buy").reduce((sum, o) => {
    const px = o.type === "limit" ? o.limit! : (quotes[o.symbol]?.price ?? 0) * (1 + SPREAD);
    return sum + px * o.qty;
  }, 0);
}

export function reservedShares(s: SimState, symbol: string): number {
  return s.orders.filter((o) => o.status === "pending" && o.side === "sell" && o.symbol === symbol).reduce((n, o) => n + o.qty, 0);
}

// Try to fill one pending order against a quote. Returns the updated state (unchanged if it should keep waiting).
export function tryFill(s: SimState, order: Order, q: Quote | undefined, open: boolean): SimState {
  if (order.status !== "pending" || !q || !open) return s;
  // Only fill on a quote taken while the market is open; an old quote from yesterday's close would be unrealistic.
  if (Date.now() - q.fetched > 90_000) return s;
  // The quote itself must be recent too: on an exchange holiday the feed keeps showing the last close.
  if (Date.now() - q.time > 30 * 60_000) return s;

  let fillPrice: number;
  if (order.side === "buy") {
    const ask = q.price * (1 + SPREAD);
    if (order.type === "limit" && ask > order.limit!) return s;
    fillPrice = order.type === "limit" ? Math.min(ask, order.limit!) : ask;
  } else {
    const bid = q.price * (1 - SPREAD);
    if (order.type === "limit" && bid < order.limit!) return s;
    fillPrice = order.type === "limit" ? Math.max(bid, order.limit!) : bid;
  }
  return applyFill(s, order, round2(fillPrice));
}

function applyFill(s: SimState, order: Order, price: number): SimState {
  const amount = price * order.qty;
  const pos = s.positions[order.symbol] ?? { qty: 0, cost: 0 };
  const reject = (note: string) => ({ ...s, orders: s.orders.map((o) => (o.id === order.id ? { ...o, status: "rejected" as const, note } : o)) });

  let cash = s.cash, realized = s.realized, next: Position;
  if (order.side === "buy") {
    if (amount > s.cash + 1e-6) return reject("Not enough SIM$ cash when the order tried to fill");
    cash -= amount;
    next = { qty: pos.qty + order.qty, cost: pos.cost + amount };
  } else {
    if (order.qty > pos.qty) return reject("You no longer hold enough shares (short selling is not simulated)");
    const basis = (pos.cost / pos.qty) * order.qty;
    cash += amount;
    realized += amount - basis;
    next = { qty: pos.qty - order.qty, cost: pos.cost - basis };
  }
  const positions = { ...s.positions };
  if (next.qty === 0) delete positions[order.symbol]; else positions[order.symbol] = next;
  return {
    ...s, cash: round2(cash), realized: round2(realized), positions,
    orders: s.orders.map((o) => (o.id === order.id ? { ...o, status: "filled" as const, fillPrice: price, filledAt: Date.now() } : o)),
  };
}

export function portfolioValue(s: SimState, quotes: Record<string, Quote>): number | null {
  let v = s.cash;
  for (const [sym, p] of Object.entries(s.positions)) {
    const q = quotes[sym];
    if (!q) return null;
    v += q.price * p.qty;
  }
  return v;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function loadState(): SimState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.version === 1) return s as SimState;
    }
  } catch { /* private window or blocked storage: start fresh */ }
  return freshState();
}

export function saveState(s: SimState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
