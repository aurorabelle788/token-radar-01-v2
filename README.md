# token-radar-01-v2

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/aurorabelle788/token-radar-01-v2/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/aurorabelle788/token-radar-01-v2/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar that prices pre-token protocols off a curve fitted to the snapshot's own traded comparables — log10(mcap) = a + b·log10(TVL) — instead of a category median, and nets every farm plan to a decision. The board shows the fit, its leave-one-out and walk-forward tests, rank ranges from 200 bootstrap refits, and a comps scatter with the fitted line. Each farm plan ends in a verdict (Farm / Thin / Skip) with an expected value, a break-even implied value, and dollars per hour, all under one stated assumption: a 5% airdrop pool shared by 10,000 eligible farmers.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json|directory>
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=azvv97zj&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
