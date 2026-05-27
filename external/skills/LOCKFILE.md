# external/skills LOCKFILE

**Pinned upstream skill repos · run `bash PULL.sh` to materialize**
**Last verified**: 2026-05-28 · **6 upstreams · ~133 skills · ~45 P0/P1 fits**

| dir | upstream | pinned SHA | size | skills | P0/P1 fits |
|---|---|---|---|---:|---:|
| `marketingskills/` | github.com/coreyhaines31/marketingskills | `692b76118c6b379f89c0fba987a228a40f58b418` | 4 MB | 42 | 15 |
| `gstack/` | github.com/garrytan/gstack | `a6fb31726cece1d1bba401fde593db7cb96bc738` | 53 MB | 58 | 7 |
| `taste-skill/` | github.com/Leonxlnx/taste-skill | `3c7017d636c3a4aad378433ea6d0cfa6c921da4a` | 5.5 MB | 13 | 8 |
| `anthropics-skills/` | github.com/anthropics/skills | `690f15cac7f7b4c055c5ab109c79ed9259934081` | 14 MB | 18 | 13 |
| `creative-director-skill/` | github.com/smixs/creative-director-skill | `62b3e827e546335d5445d599df242df5f4f24ae0` | 4 MB | 1 | 1 |
| `guizang-ppt-skill/` | github.com/op7418/guizang-ppt-skill | `6bfa520b86ed5a3dffdac0a3323155e2b6f516b6` | 4.3 MB | 1 | 1 |
| **TOTAL** |  |  | **~85 MB** | **~133** | **~45** |

## Curation policy

**Rule**: a whole upstream stays only if ≥1 of its skills is on our P0/P1 list (see `README.md` § pipeline mapping). Don't fork or cherry-pick — keep clean clones to preserve update flow.

## Dropped 2026-05-28

| upstream | reason |
|---|---|
| `openai-skills` (was 7.7 MB · 44 skills) | dev/CI tools only (gh-fix-ci · sentry · render-deploy · security-threat-model · transcribe) · 0 fit AU local-trade + sales pipeline |
| `vercel-skills` (was 1.1 MB · 1 meta skill) | only `find-skills` meta-tool · skip |

## Added 2026-05-28

| upstream | reason |
|---|---|
| `guizang-ppt-skill` (4.3 MB · 1 skill · Style A 电子杂志 + Style B 瑞士国际主义) | Sales decks · S6 proposal pitch · S9 quarterly review for retainer clients · single-file HTML 横向 PPT 直接 cf-pages deploy |

## Update procedure

1. `bash PULL.sh --update` — fetches latest from each upstream
2. Manually update SHA columns above
3. Re-run `bash PULL.sh` (without --update) to verify all locked
4. Commit changes to LOCKFILE.md only (clones stay gitignored)

## Why pinned

- Reproducible builds — same content regardless of when cloned
- Audit changes via `git log` per upstream
- Survive upstream-author rewrites / deletions (within shallow clone window)
