// token-radar-01 v2 — the entrypoint ("radar-3").
//
// Run it from this repository (Node 22, standard library only):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json|directory>
//
// What it does, in order:
//   1. Reads the sealed DefiLlama snapshot and fits the comps curve on its traded protocols.
//   2. Scores every pre-token protocol, ranks the board, and nets every farm plan to a verdict.
//   3. Tests the model out of sample (leave-one-out, walk-forward by listing date, 200
//      bootstrap refits) and prints the numbers, so a bad fit fails loudly instead of silently.
//   4. Refuses to write anything when the board breaks the gate (missing watchlist rows, ranks
//      out of order, a farm step outside 20..600 characters).
//   5. Writes board.json, data.js, the dashboard and the screenshots into the output directory,
//      then the dossier the judge reads, built by the vendored make.fun library.
//
// The output is deterministic: the bootstrap uses a fixed seed, every sort breaks ties by slug,
// and no wall-clock time enters any file. Two runs write byte-identical output.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's own caps: the text cap shapes the dossier's bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** The value of --name <value>, or the fallback when the flag is absent. */
function flag(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq === undefined ? fallback : eq.slice(name.length + 3);
}

const inputArg = flag('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar v2: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const out = flag('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar, fit, validation } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`token radar v2: the model wrote a board the gate refuses: ${issue}\n`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

/** Copy one directory's regular files into `to`, skipping names that start with a dot. */
function copyDir(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

copyDir(join(here, 'dashboard'), join(out, 'dashboard'));
const shots = copyDir(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3) {
  process.stderr.write(`token radar v2: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`);
  process.exit(1);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write(`token radar v2: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
    process.exit(1);
  }
}

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }),
);

// The validation, printed so a run's numbers are on the record.
const verdicts = { Farm: 0, Thin: 0, Skip: 0 };
for (const r of board) verdicts[r.verdict.verdict]++;
const dossierBytes = statSync(join(out, 'dossier.json')).size;
const topRange = validation.rank_ranges[board[0]!.slug];
process.stdout.write(
  `token radar v2: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
    `token radar v2: fit log10(mcap) = ${fit.intercept} + ${fit.slope} * log10(TVL) on ${fit.n_comps} comps, in-sample RMSE ${fit.in_sample_rmse}\n` +
    `token radar v2: LOO RMSE flat median ${validation.loo.flat_median}, category median ${validation.loo.category_median}, power law ${validation.loo.power_law}, power law + offset ${validation.loo.power_law_offset}\n` +
    `token radar v2: walk-forward mean RMSE power law ${validation.walk_forward.mean_power_law} vs flat median ${validation.walk_forward.mean_flat_median}\n` +
    `token radar v2: verdicts Farm ${verdicts.Farm}, Thin ${verdicts.Thin}, Skip ${verdicts.Skip}\n` +
    `token radar v2: top ${board[0]!.slug} $${board[0]!.implied_value_usd.toLocaleString('en-US')}` +
    (topRange ? `, rank range ${topRange.min}–${topRange.max} across ${validation.bootstrap_refits} refits` : '') +
    `, dossier ${dossierBytes.toLocaleString('en-US')} bytes\n` +
    `token radar v2: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')}, ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}\n`,
);
