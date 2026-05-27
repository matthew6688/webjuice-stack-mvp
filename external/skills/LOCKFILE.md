# external/skills LOCKFILE

**Pinned upstream skill repos · run `bash PULL.sh` to materialize**
**Last verified**: 2026-05-27 · 7 upstreams · ~177 skills total

| dir | upstream | pinned SHA | size | skills inside |
|---|---|---|---|---:|
| `marketingskills/` | github.com/coreyhaines31/marketingskills | `692b76118c6b379f89c0fba987a228a40f58b418` | 4 MB | 42 |
| `gstack/` | github.com/garrytan/gstack | `a6fb31726cece1d1bba401fde593db7cb96bc738` | 53 MB | 58 |
| `taste-skill/` | github.com/Leonxlnx/taste-skill | `3c7017d636c3a4aad378433ea6d0cfa6c921da4a` | 5.5 MB | 13 |
| `anthropics-skills/` | github.com/anthropics/skills | `690f15cac7f7b4c055c5ab109c79ed9259934081` | 14 MB | 18 |
| `openai-skills/` | github.com/openai/skills | `b0401f07213a66414d84a65cb50c1d226f99485a` | 7.7 MB | 44 |
| `vercel-skills/` | github.com/vercel-labs/skills | `e4243fbf7d9398722024f62850ece90fa0d5c693` | 1.1 MB | 1 |
| `creative-director-skill/` | github.com/smixs/creative-director-skill | `62b3e827e546335d5445d599df242df5f4f24ae0` | 4 MB | 1 |
| **TOTAL** |  |  | **~89 MB** | **~177** |

## Update procedure

1. `bash PULL.sh --update` — fetches latest from each upstream
2. Manually update SHA columns above
3. Re-run `bash PULL.sh` (without --update) to verify all locked
4. Commit changes to LOCKFILE.md only (clones stay gitignored)

## Why pinned

- Reproducible builds — same content regardless of when cloned
- Audit changes via `git log` per upstream
- Survive upstream-author rewrites / deletions (within shallow clone window)
