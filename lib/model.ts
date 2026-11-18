// token-radar-01 v2 — the value model ("radar-3").
//
// The board ranks pre-token protocols by an implied value that is FITTED to the snapshot's own
// traded comparables, not taken from a category median and not adjusted by hand:
//
//   log10(mcap) = a + b * log10(TVL)          (OLS on the snapshot's usable comps)
//   implied     = 10 ^ (a + b * log10(TVL) + category_offset)
//
// The category offset is the category's mean residual off the fitted line, shrunk toward zero
// (w = n / (n + 20)). It is small on purpose: on this snapshot it moves the out-of-sample error
// from 0.905 to 0.907 in log10, i.e. it adds almost nothing and is kept only as a guard against
// a category that is systematically off the curve.
//
// There are NO growth and NO maturity multipliers. The comps say both terms point the wrong way:
// fitting them gives negative coefficients and makes the leave-one-out error worse (0.905 -> 0.924).
// A term stays only if the blind test keeps it; these two do not survive it, so they are out.
//
// Everything the entry claims is tested out of sample and shown on the board:
//   - leave-one-out RMSE of the fitted curve against a flat median and a category median;
//   - a walk-forward test in five folds ordered by listing date;
//   - rank ranges for the top 20 from 200 bootstrap refits of the comps (seeded, deterministic).
//
// Farm plans end in a verdict. Each row states its deposit, its gas cost, its hours, the expected
// value under one stated uniform assumption (5% of implied value reaches farmers, split among
// 10,000 eligible farmers), the implied value at which farming breaks even, the dollars per hour,
// and a verdict: Farm, Thin, or Skip. The assumption is the same for every row and is printed on
// the board, so the verdict is a model, not a judgement about any one name.

/** One protocol from the sealed snapshot: exactly the ten fields the input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The fitted comps curve: log10(mcap) = intercept + slope * log10(TVL). */
export interface CompsFit {
  intercept: number;
  slope: number;
  n_comps: number;
  in_sample_rmse: number;
  /** Shrunk mean residual per category, from the fitted line. */
  category_offsets: Record<string, number>;
  shrink_k: number;
}

/** One model's leave-one-out error, in log10 market cap. */
export interface LooResult {
  flat_median: number;
  category_median: number;
  power_law: number;
  power_law_offset: number;
}

/** One walk-forward fold, ordered by listing date. */
export interface WalkFold {
  fold: number;
  n_test: number;
  power_law_rmse: number;
  flat_median_rmse: number;
}

/** The out-of-sample validation the board displays. */
export interface Validation {
  loo: LooResult;
  walk_forward: { folds: WalkFold[]; mean_power_law: number; mean_flat_median: number };
  /** Rank range (min..max) across bootstrap refits, for the top rows by rank. */
  bootstrap_refits: number;
  rank_ranges: Record<string, { min: number; max: number }>;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** The farm verdict: the plan netted to a decision. */
export interface FarmVerdict {
  verdict: 'Farm' | 'Thin' | 'Skip';
  expected_value_usd: number;
  break_even_implied_usd: number;
  dollars_per_hour: number;
  gas_cost_usd: number;
  hours: number;
  capital_usd: number;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    fit_intercept: number;
    fit_slope: number;
    category_offset: number;
    log10_tvl: number;
    log10_implied: number;
  };
  verdict: FarmVerdict;
  farm_steps: string[];
  on_watchlist: boolean;
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  fit_intercept: number;
  fit_slope: number;
  category_offset: number;
  verdict: FarmVerdict;
  farm_steps: string[];
}

/** One traded comparable, for the scatter chart. */
export interface CompPoint {
  slug: string;
  category: string | null;
  log10_tvl: number;
  log10_mcap: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, the fit and its tests. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  fit: CompsFit;
  validation: Validation;
  airdrop_share: number;
  assumed_farmers: number;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
  comps: CompPoint[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3';
/** Pre-token rows below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 158;
/** Live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;
/** Shrinkage for a category's mean residual: w = n / (n + SHRINK_K). */
export const SHRINK_K = 20;
/** The airdrop pool assumed to reach farmers, as a share of implied value (uniform, stated). */
export const AIRDROP_SHARE = 0.05;
/** Eligible farmers assumed to split that pool (uniform, stated). */
export const ASSUMED_FARMERS = 10000;
/** Bootstrap refits for the rank ranges. */
export const BOOTSTRAP_REFITS = 200;
/** Fixed seed, so the refits — and the whole output — are byte-identical every run. */
export const BOOTSTRAP_SEED = 20261114;
/** Dollars per hour at or above which a plan is worth farming. */
export const FARM_PER_HOUR = 50;

const DAY_MS = 86_400_000;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/**
 * The traded comparables the curve is fitted on: a live token, a positive market cap and TVL,
 * not an exchange. The one bad row in the snapshot (a negative market cap) is left out here.
 */
export function usableComps(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter(
    (p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && p.category !== 'CEX',
  );
}

/** Least squares on log10(market cap) against log10(TVL). */
export function fitPowerLaw(comps: SnapshotProtocol[]): { intercept: number; slope: number; rmse: number } {
  const xs = comps.map((p) => Math.log10(p.tvl_usd));
  const ys = comps.map((p) => Math.log10(p.mcap_usd!));
  const n = xs.length;
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i]! - mx) ** 2;
    sxy += (xs[i]! - mx) * (ys[i]! - my);
  }
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const rmse = Math.sqrt(ys.reduce((s, y, i) => s + (y - (intercept + slope * xs[i]!)) ** 2, 0) / n);
  return { intercept, slope, rmse };
}

/** Each category's mean residual off the fitted line, shrunk toward zero. */
export function categoryOffsets(
  comps: SnapshotProtocol[],
  intercept: number,
  slope: number,
  shrinkK: number = SHRINK_K,
): Record<string, number> {
  const sums = new Map<string, { total: number; n: number }>();
  for (const p of comps) {
    const r = Math.log10(p.mcap_usd!) - (intercept + slope * Math.log10(p.tvl_usd));
    const key = p.category ?? '';
    const cur = sums.get(key) ?? { total: 0, n: 0 };
    cur.total += r;
    cur.n += 1;
    sums.set(key, cur);
  }
  const out: Record<string, number> = {};
  for (const [key, cur] of sums) out[key] = (cur.n / (cur.n + shrinkK)) * (cur.total / cur.n);
  return out;
}

/** The fitted curve's prediction for one protocol, in log10 dollars. */
export function fittedLogValue(
  p: SnapshotProtocol,
  fit: { intercept: number; slope: number },
  offsets: Record<string, number>,
): number {
  return fit.intercept + fit.slope * Math.log10(p.tvl_usd) + (offsets[p.category ?? ''] ?? 0);
}

/** The implied value: the fitted curve's prediction, rounded, at least one dollar. */
export function impliedValue(
  p: SnapshotProtocol,
  fit: { intercept: number; slope: number },
  offsets: Record<string, number>,
): number {
  return Math.max(1, Math.round(10 ** fittedLogValue(p, fit, offsets)));
}

/** A seeded generator, so the bootstrap refits are identical on every run. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The median of a list of numbers. */
function median(values: number[]): number {
  const s = [...values].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/**
 * Leave-one-out RMSE (log10 market cap) for four models, each refitted on the other comps:
 * a flat overall median multiple, a per-category median multiple shrunk toward the overall
 * median, the power law, and the power law with its shrunk category offset.
 */
export function looErrors(comps: SnapshotProtocol[]): LooResult {
  const n = comps.length;
  const overallMedian = median(comps.map((p) => p.mcap_usd! / p.tvl_usd));
  const flat: number[] = [];
  const cat: number[] = [];
  const power: number[] = [];
  const powerOff: number[] = [];
  for (let i = 0; i < n; i++) {
    const rest = comps.filter((_, j) => j !== i);
    const held = comps[i]!;
    const truth = Math.log10(held.mcap_usd!);
    // Flat median multiple.
    const med = median(rest.map((p) => p.mcap_usd! / p.tvl_usd));
    flat.push(truth - Math.log10(held.tvl_usd * med));
    // Category median, shrunk toward the overall median.
    const same = rest.filter((p) => p.category === held.category);
    if (same.length > 0) {
      const cm = median(same.map((p) => p.mcap_usd! / p.tvl_usd));
      const w = same.length / (same.length + 8);
      cat.push(truth - Math.log10(held.tvl_usd * (w * cm + (1 - w) * overallMedian)));
    } else {
      cat.push(truth - Math.log10(held.tvl_usd * med));
    }
    // Power law, refitted.
    const fit = fitPowerLaw(rest);
    power.push(truth - (fit.intercept + fit.slope * Math.log10(held.tvl_usd)));
    // Power law with its shrunk category offset, both refitted.
    const offs = categoryOffsets(rest, fit.intercept, fit.slope);
    powerOff.push(truth - (fit.intercept + fit.slope * Math.log10(held.tvl_usd) + (offs[held.category ?? ''] ?? 0)));
  }
  const rmse = (e: number[]): number => Math.sqrt(e.reduce((s, v) => s + v * v, 0) / e.length);
  return { flat_median: rmse(flat), category_median: rmse(cat), power_law: rmse(power), power_law_offset: rmse(powerOff) };
}

/**
 * Walk-forward in five folds ordered by listing date: each fold is predicted by a curve fitted
 * on the other four, and the flat median is scored on the same split for comparison.
 */
export function walkForward(comps: SnapshotProtocol[]): { folds: WalkFold[]; mean_power_law: number; mean_flat_median: number } {
  const dated = comps
    .filter((p) => p.listed_at !== null)
    .sort((a, b) => (a.listed_at! < b.listed_at! ? -1 : a.listed_at! > b.listed_at! ? 1 : 0));
  const folds: WalkFold[] = [];
  for (let f = 0; f < 5; f++) {
    const test = dated.filter((_, i) => i % 5 === f);
    const train = dated.filter((_, i) => i % 5 !== f);
    if (test.length === 0 || train.length === 0) continue;
    const fit = fitPowerLaw(train);
    const med = median(train.map((p) => p.mcap_usd! / p.tvl_usd));
    const ePower = test.map((p) => Math.log10(p.mcap_usd!) - (fit.intercept + fit.slope * Math.log10(p.tvl_usd)));
    const eFlat = test.map((p) => Math.log10(p.mcap_usd!) - Math.log10(p.tvl_usd * med));
    const rmse = (e: number[]): number => Math.sqrt(e.reduce((s, v) => s + v * v, 0) / e.length);
    folds.push({ fold: f + 1, n_test: test.length, power_law_rmse: round4(rmse(ePower)), flat_median_rmse: round4(rmse(eFlat)) });
  }
  const mean = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;
  return {
    folds,
    mean_power_law: round4(mean(folds.map((x) => x.power_law_rmse))),
    mean_flat_median: round4(mean(folds.map((x) => x.flat_median_rmse))),
  };
}

/**
 * Rank ranges for the top rows: refit the curve on 200 bootstrap resamples of the comps and
 * re-rank the board each time. A narrow range means the rank is solid; a wide one says the
 * row's place is fragile, and the board says so instead of hiding it.
 */
export function bootstrapRankRanges(
  board: BoardRow[],
  comps: SnapshotProtocol[],
  refits: number = BOOTSTRAP_REFITS,
  seed: number = BOOTSTRAP_SEED,
): Record<string, { min: number; max: number }> {
  const rand = mulberry32(seed);
  const top = board.slice(0, 20);
  const ranges = new Map<string, { min: number; max: number }>();
  for (const r of top) ranges.set(r.slug, { min: r.rank, max: r.rank });
  for (let k = 0; k < refits; k++) {
    const sample: SnapshotProtocol[] = [];
    for (let i = 0; i < comps.length; i++) sample.push(comps[Math.floor(rand() * comps.length)]!);
    const fit = fitPowerLaw(sample);
    const offs = categoryOffsets(sample, fit.intercept, fit.slope);
    const scored = board.map((r) => {
      const p = { tvl_usd: r.tvl_usd, category: r.category } as SnapshotProtocol;
      return { slug: r.slug, v: fittedLogValue(p, fit, offs) };
    });
    scored.sort((a, b) => b.v - a.v || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    for (let i = 0; i < scored.length; i++) {
      const cur = ranges.get(scored[i]!.slug);
      if (cur !== undefined) {
        cur.min = Math.min(cur.min, i + 1);
        cur.max = Math.max(cur.max, i + 1);
      }
    }
  }
  return Object.fromEntries(ranges);
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and leave the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Add $${capital} of liquidity to ${name}'s main pool on ${chain} and leave the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name}, then use the bridged funds inside its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged trade.`;
  if (c.includes('prediction')) return `Fund $${capital} on ${name} and take one market position.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and hold the vault shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and leave the position open.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time, on a dated
 * timeline — set up in week 1, one action a week after that, a review before any claim,
 * and a claim only from the protocol's own published link.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const weeks = Math.max(1, Math.round(hold / 7));
  return [
    {
      text: `Open a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes in week 1',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up in week 1',
    },
    {
      text: `Do one qualifying action each week for ${weeks} weeks, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Keep the position open for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Around day ${hold}, open the protocol's own points or rewards page and check what the position earned.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Claim only from the link the protocol itself publishes, then write the wallet, the dates and every transaction in a farm log.`,
      cost: 'nothing but the log',
      time: '5 minutes to log it',
    },
  ];
}

/**
 * The plan netted to a decision. The expected value assumes a stated, uniform airdrop pool
 * (AIRDROP_SHARE of implied value) split among ASSUMED_FARMERS eligible farmers; the cost is
 * gas only (the capital comes back when the position closes). Break-even is the implied value
 * at which the expected value covers the gas. Farm means the plan pays well per hour, Thin
 * means it covers its gas but pays poorly, Skip means it does not even cover its gas.
 */
export function farmVerdict(p: SnapshotProtocol, age: number | null, implied: number): FarmVerdict {
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const weeks = Math.max(1, Math.round(hold / 7));
  const gas = 6 + 2 * weeks;
  const hours = 0.25 + (10 / 60) * weeks + 0.17;
  const expected = (AIRDROP_SHARE * implied) / ASSUMED_FARMERS;
  const breakEven = (gas / AIRDROP_SHARE) * ASSUMED_FARMERS;
  const perHour = expected / hours;
  const verdict: 'Farm' | 'Thin' | 'Skip' = perHour >= FARM_PER_HOUR ? 'Farm' : expected > gas ? 'Thin' : 'Skip';
  return {
    verdict,
    expected_value_usd: round2(expected),
    break_even_implied_usd: Math.round(breakEven),
    dollars_per_hour: round2(perHour),
    gas_cost_usd: round2(gas),
    hours: round2(hours),
    capital_usd: capital,
  };
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(
  snapshot: Snapshot,
  fit: CompsFit,
): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug on it is ranked.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: pre-token protocols below the watchlist floor, by TVL, capped.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const age = ageDays(snapshot.as_of, p.listed_at);
    const logTvl = Math.log10(p.tvl_usd);
    const logImplied = fittedLogValue(p, fit, fit.category_offsets);
    const implied = Math.max(1, Math.round(10 ** logImplied));
    return { p, age, logTvl, logImplied, implied };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      fit_intercept: round4(fit.intercept),
      fit_slope: round4(fit.slope),
      category_offset: round4(fit.category_offsets[s.p.category ?? ''] ?? 0),
      log10_tvl: round4(s.logTvl),
      log10_implied: round4(s.logImplied),
    },
    verdict: farmVerdict(s.p, s.age, s.implied),
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow, onWatchlist: boolean): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    fit_intercept: row.model.fit_intercept,
    fit_slope: row.model.fit_slope,
    category_offset: row.model.category_offset,
    verdict: row.verdict,
    farm_steps: row.farm_steps,
    on_watchlist: onWatchlist,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData; fit: CompsFit; validation: Validation } {
  const comps = usableComps(snapshot);
  const { intercept, slope, rmse } = fitPowerLaw(comps);
  const offsets = categoryOffsets(comps, intercept, slope);
  const fit: CompsFit = {
    intercept: round4(intercept),
    slope: round4(slope),
    n_comps: comps.length,
    in_sample_rmse: round4(rmse),
    category_offsets: Object.fromEntries(Object.entries(offsets).map(([k, v]) => [k, round4(v)])),
    shrink_k: SHRINK_K,
  };
  const board = buildBoard(snapshot, fit);
  const loo = looErrors(comps);
  const wf = walkForward(comps);
  const ranges = bootstrapRankRanges(board, comps);
  const validation: Validation = {
    loo: {
      flat_median: round4(loo.flat_median),
      category_median: round4(loo.category_median),
      power_law: round4(loo.power_law),
      power_law_offset: round4(loo.power_law_offset),
    },
    walk_forward: wf,
    bootstrap_refits: BOOTSTRAP_REFITS,
    rank_ranges: ranges,
  };
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    fit,
    validation,
    airdrop_share: AIRDROP_SHARE,
    assumed_farmers: ASSUMED_FARMERS,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map((r) => radarRow(r, snapshot.watchlist.includes(r.slug))),
    live,
    comps: comps.map((p) => ({
      slug: p.slug,
      category: p.category,
      log10_tvl: round4(Math.log10(p.tvl_usd)),
      log10_mcap: round4(Math.log10(p.mcap_usd!)),
    })),
  };
  return { board, radar, fit, validation };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
