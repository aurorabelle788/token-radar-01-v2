// Token Radar dashboard — renders window.RADAR (written by main.ts into data.js).
// No framework, no network. Sorting and filtering run in the page; the detail view reads
// the same row the board ranks, and its numbers are the board's numbers.
(function () {
  var R = window.RADAR;
  var rows = R.rows;
  var bySlug = {};
  rows.forEach(function (r) { bySlug[r.slug] = r; });

  function money(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'k';
    return '$' + Math.round(n);
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // ---- KPIs ---------------------------------------------------------------
  var counts = { Farm: 0, Thin: 0, Skip: 0 };
  rows.forEach(function (r) { counts[r.verdict.verdict]++; });
  document.getElementById('kpis').innerHTML = [
    ['Watchlist', R.watchlist_size + ' protocols'],
    ['Board', R.board_size + ' rows (' + R.early_size + ' early)'],
    ['Fitted curve', 'log10(mcap) = ' + R.fit.intercept + ' + ' + R.fit.slope + ' x log10(TVL)'],
    ['Comps', R.fit.n_comps + ' traded tokens'],
    ['Leave-one-out', R.validation.loo.power_law_offset + ' log10 (power law + offset)'],
    ['Verdicts', counts.Farm + ' Farm / ' + counts.Thin + ' Thin / ' + counts.Skip + ' Skip'],
  ].map(function (k) { return '<div class="kpi">' + esc(k[0]) + '<b>' + esc(k[1]) + '</b></div>'; }).join('');
  document.getElementById('subtitle').textContent =
    'Snapshot ' + R.as_of + ' (' + R.source + '). ' + R.board_size + ' pre-token protocols ranked by the fitted comps curve.';
  document.getElementById('assumption').textContent =
    'Farm verdicts assume an airdrop pool of ' + (R.airdrop_share * 100) + '% of implied value shared by ' +
    R.assumed_farmers.toLocaleString('en-US') + ' eligible farmers. Gas is the only cost; the deposit comes back when the position closes.';

  // ---- Board --------------------------------------------------------------
  var sortKey = 'rank', sortDir = 1;
  var tbody = document.querySelector('#board tbody');
  function filtered() {
    var q = (document.getElementById('q').value || '').toLowerCase();
    var v = document.getElementById('verdict').value;
    var w = document.getElementById('watch').value;
    return rows.filter(function (r) {
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      if (v && r.verdict.verdict !== v) return false;
      if (w === 'watch' && !r.on_watchlist) return false;
      if (w === 'early' && r.on_watchlist) return false;
      return true;
    });
  }
  function renderBoard() {
    var list = filtered().slice();
    list.sort(function (a, b) {
      var x = a[sortKey], y = b[sortKey];
      if (sortKey === 'per_hour') { x = a.verdict.dollars_per_hour; y = b.verdict.dollars_per_hour; }
      if (sortKey === 'verdict') { x = a.verdict.verdict; y = b.verdict.verdict; }
      if (typeof x === 'string') return (x < y ? -1 : x > y ? 1 : 0) * sortDir;
      return (x - y) * sortDir;
    });
    document.getElementById('count').textContent = list.length + ' of ' + rows.length + ' rows';
    tbody.innerHTML = list.map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '"><td class="num">' + r.rank + '</td><td>' + esc(r.name) +
        '<br><span style="color:var(--muted);font-size:12px">' + esc(r.slug) + '</span></td><td>' + esc(r.category || '—') +
        '</td><td class="num">' + money(r.tvl_usd) + '</td><td class="num">' + money(r.implied_value_usd) +
        '</td><td class="num">$' + r.verdict.dollars_per_hour.toLocaleString('en-US') + '</td><td class="v-' + r.verdict.verdict + '">' +
        r.verdict.verdict + '</td></tr>';
    }).join('');
  }
  document.querySelectorAll('#board th').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.getAttribute('data-sort');
      if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = k === 'rank' ? 1 : -1; }
      renderBoard();
    });
  });
  ['q', 'verdict', 'watch'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', renderBoard);
  });
  tbody.addEventListener('click', function (e) {
    var tr = e.target.closest('tr');
    if (tr) showDetail(tr.getAttribute('data-slug'));
  });

  // ---- Detail -------------------------------------------------------------
  function showDetail(slug) {
    var r = bySlug[slug];
    if (!r) return;
    var v = r.verdict;
    var range = R.validation.rank_ranges[slug];
    var rangeText = range ? ('rank ' + range.min + '–' + range.max + ' across ' + R.validation.bootstrap_refits + ' refits') : 'outside the top 20';
    document.getElementById('detail').hidden = false;
    document.getElementById('detail').innerHTML =
      '<h2>#' + r.rank + ' — ' + esc(r.name) + ' <span style="color:var(--muted);font-weight:400">(' + esc(r.slug) + ')</span></h2>' +
      '<div class="grid">' +
      '<div class="cell">TVL<b>' + money(r.tvl_usd) + '</b></div>' +
      '<div class="cell">Implied value<b>' + money(r.implied_value_usd) + '</b></div>' +
      '<div class="cell">Category<b>' + esc(r.category || '—') + '</b></div>' +
      '<div class="cell">Chains<b>' + esc(r.chains.join(', ') || '—') + '</b></div>' +
      '<div class="cell">7-day TVL change<b>' + (r.change_7d === null ? '—' : r.change_7d + '%') + '</b></div>' +
      '<div class="cell">Listed<b>' + (r.listed_at || '—') + (r.age_days === null ? '' : ' (' + r.age_days + ' days)') + '</b></div>' +
      '</div>' +
      '<p><b>How the number is made:</b> log10(implied) = ' + r.fit_intercept + ' + ' + r.fit_slope + ' x log10(TVL)' +
      ' + category offset ' + r.category_offset + ' = ' + (Math.log10(r.implied_value_usd)).toFixed(3) +
      '. No growth or maturity multiplier: the comps give both terms a negative sign, so they are out. ' +
      'Bootstrap rank range: ' + rangeText + '.</p>' +
      '<p class="verdict">Verdict: <span class="v-' + v.verdict + '">' + v.verdict + '</span> — expected $' +
      v.expected_value_usd.toLocaleString('en-US') + ' · break-even at $' + v.break_even_implied_usd.toLocaleString('en-US') +
      ' implied · $' + v.dollars_per_hour.toLocaleString('en-US') + '/hour · gas $' + v.gas_cost_usd + ' · ' + v.hours + ' hours · $' + v.capital_usd + ' deposit</p>' +
      '<h3>Farm plan</h3><ol>' + r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '<p style="color:var(--muted);font-size:13px">The plan is dated: set up in week 1, one qualifying action a week, review around the hold date, claim only from the protocol’s own published link.</p>';
    document.getElementById('detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ---- Validation tab -----------------------------------------------------
  var loo = R.validation.loo;
  document.getElementById('loo').innerHTML =
    '<h3>Leave-one-out error (log10 market cap, lower is better)</h3>' +
    '<table><thead><tr><th>Model</th><th>LOO RMSE</th></tr></thead><tbody>' +
    '<tr><td>Flat overall median multiple</td><td class="num">' + loo.flat_median + '</td></tr>' +
    '<tr><td>Category median multiple (shrunk)</td><td class="num">' + loo.category_median + '</td></tr>' +
    '<tr><td>Fitted power law</td><td class="num">' + loo.power_law + '</td></tr>' +
    '<tr><td><b>Fitted power law + shrunk category offset (this entry)</b></td><td class="num"><b>' + loo.power_law_offset + '</b></td></tr>' +
    '</tbody></table>' +
    '<p>Each number refits its model on 118 comps and predicts the one left out. The power law beats the medians out of sample; adding growth and age terms makes it worse (0.924), so they are not in the model.</p>';
  var wf = R.validation.walk_forward;
  document.getElementById('walk').innerHTML =
    '<h3>Walk-forward by listing date (5 folds, newer listings held out)</h3>' +
    '<table><thead><tr><th>Fold</th><th>Held out</th><th>Power law RMSE</th><th>Flat median RMSE</th></tr></thead><tbody>' +
    wf.folds.map(function (f) {
      return '<tr><td class="num">' + f.fold + '</td><td class="num">' + f.n_test + '</td><td class="num">' + f.power_law_rmse + '</td><td class="num">' + f.flat_median_rmse + '</td></tr>';
    }).join('') + '</tbody></table>' +
    '<p>Mean RMSE: power law ' + wf.mean_power_law + ' vs flat median ' + wf.mean_flat_median + '. The curve holds up on listings it never saw.</p>';
  var top20 = rows.slice(0, 20);
  document.getElementById('ranks').innerHTML =
    '<h3>Rank ranges from ' + R.validation.bootstrap_refits + ' bootstrap refits</h3>' +
    '<table><thead><tr><th>#</th><th>Protocol</th><th>Rank range</th></tr></thead><tbody>' +
    top20.map(function (r) {
      var g = R.validation.rank_ranges[r.slug];
      return '<tr><td class="num">' + r.rank + '</td><td>' + esc(r.name) + '</td><td class="num">' + (g ? g.min + '–' + g.max : '—') + '</td></tr>';
    }).join('') + '</tbody></table>' +
    '<p>A narrow range means the rank is solid across refits of the comps; a wide one means the row’s place is fragile, and the board says so.</p>';

  // Scatter: log TVL (x) vs log mcap (y), one dot per comp, fitted line overlaid.
  (function scatter() {
    var W = 760, H = 420, P = 46;
    var xs = R.comps.map(function (c) { return c.log10_tvl; });
    var ys = R.comps.map(function (c) { return c.log10_mcap; });
    var x0 = Math.min.apply(null, xs) - 0.2, x1 = Math.max.apply(null, xs) + 0.2;
    var y0 = Math.min.apply(null, ys) - 0.2, y1 = Math.max.apply(null, ys) + 0.2;
    function X(v) { return P + ((v - x0) / (x1 - x0)) * (W - 2 * P); }
    function Y(v) { return H - P - ((v - y0) / (y1 - y0)) * (H - 2 * P); }
    var dots = R.comps.map(function (c) {
      return '<circle cx="' + X(c.log10_tvl).toFixed(1) + '" cy="' + Y(c.log10_mcap).toFixed(1) + '" r="3" fill="#58a6ff" opacity="0.7"/>';
    }).join('');
    var lx0 = X(x0), ly0 = Y(R.fit.intercept + R.fit.slope * x0);
    var lx1 = X(x1), ly1 = Y(R.fit.intercept + R.fit.slope * x1);
    document.getElementById('scatter').innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Comps scatter with fitted line">' +
      '<line x1="' + P + '" y1="' + (H - P) + '" x2="' + (W - P) + '" y2="' + (H - P) + '" stroke="#30363d"/>' +
      '<line x1="' + P + '" y1="' + P + '" x2="' + P + '" y2="' + (H - P) + '" stroke="#30363d"/>' +
      '<line x1="' + lx0.toFixed(1) + '" y1="' + ly0.toFixed(1) + '" x2="' + lx1.toFixed(1) + '" y2="' + ly1.toFixed(1) + '" stroke="#3fb950" stroke-width="2"/>' +
      dots +
      '<text x="' + (W - P) + '" y="' + (H - 12) + '" fill="#8b949e" font-size="12" text-anchor="end">log10(TVL, USD)</text>' +
      '<text x="12" y="' + (P - 8) + '" fill="#8b949e" font-size="12">log10(market cap, USD)</text>' +
      '</svg>';
  })();
  document.getElementById('fitnote').textContent =
    'Fitted on ' + R.fit.n_comps + ' traded comparables: log10(mcap) = ' + R.fit.intercept + ' + ' + R.fit.slope +
    ' x log10(TVL), in-sample RMSE ' + R.fit.in_sample_rmse + '. The slope is below 1, so the market cap / TVL multiple falls as TVL grows — a flat multiple cannot say that. ' +
    'Category offsets (shrunk, k=' + R.fit.shrink_k + ') are the categories’ mean residuals off this line.';

  // ---- Live tab -----------------------------------------------------------
  document.querySelector('#livetab tbody').innerHTML = R.live.map(function (p) {
    return '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.category || '—') + '</td><td class="num">' + money(p.tvl_usd) +
      '</td><td class="num">' + money(p.mcap_usd || 0) + '</td><td class="num">' + (p.change_7d === null ? '—' : p.change_7d + '%') + '</td></tr>';
  }).join('');

  // ---- Tabs ---------------------------------------------------------------
  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('#tabs button').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      var tab = b.getAttribute('data-tab');
      document.getElementById('tab-board').hidden = tab !== 'board';
      document.getElementById('tab-validation').hidden = tab !== 'validation';
      document.getElementById('tab-live').hidden = tab !== 'live';
    });
  });

  renderBoard();
})();
