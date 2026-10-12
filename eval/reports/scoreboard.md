# LearnPath Flow Scoreboard

Append-only history of accuracy iterations. Newest at the bottom.
Score = weighted accuracy (need 0.6 / intervention 0.25 / review 0.15), %.

| # | date (UTC) | backend | split | score | Δ | note |
|---|------------|---------|-------|-------|---|------|
| 1 | 2026-10-12 09:59:01 | demo | all | 90.56 | — | baseline (demo backend) |
| 2 | 2026-10-12 10:12:35 | demo | train | 87.86 | — | demo baseline (train) |
| 3 | 2026-10-12 10:13:53 | demo | all | 100.00 | — | fix: conflict routes to insufficient_evidence |
