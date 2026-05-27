#!/usr/bin/env bash
# external/skills/PULL.sh
# Re-clone all upstream skill repos pinned by LOCKFILE.md.
# Idempotent: skips if already cloned + at correct SHA.
#
# Usage:
#   bash external/skills/PULL.sh            # pull all
#   bash external/skills/PULL.sh --force    # delete + re-clone
#   bash external/skills/PULL.sh --update   # fetch latest + update LOCKFILE
#
# Why this exists: OD repo (nexu-io/open-design) skills/ is a 139-skill
# discovery CATALOGUE · each SKILL.md is a 43-line stub pointing to an
# upstream repo where the REAL content lives. We pull those upstreams here.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# === pinned upstreams (sync with LOCKFILE.md) ===
# Curation rule: must hit ≥1 pipeline stage P0/P1 skill in our README map.
# Dropped 2026-05-28: openai-skills (dev/CI only · 0 fit) · vercel-skills (meta only · 0 fit).
declare -a UPSTREAMS=(
  "marketingskills|https://github.com/coreyhaines31/marketingskills.git|692b76118c6b379f89c0fba987a228a40f58b418"
  "gstack|https://github.com/garrytan/gstack.git|a6fb31726cece1d1bba401fde593db7cb96bc738"
  "taste-skill|https://github.com/Leonxlnx/taste-skill.git|3c7017d636c3a4aad378433ea6d0cfa6c921da4a"
  "anthropics-skills|https://github.com/anthropics/skills.git|690f15cac7f7b4c055c5ab109c79ed9259934081"
  "creative-director-skill|https://github.com/smixs/creative-director-skill.git|62b3e827e546335d5445d599df242df5f4f24ae0"
  "guizang-ppt-skill|https://github.com/op7418/guizang-ppt-skill.git|6bfa520b86ed5a3dffdac0a3323155e2b6f516b6"
)

FORCE=0
UPDATE=0
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --update) UPDATE=1 ;;
  esac
done

for entry in "${UPSTREAMS[@]}"; do
  IFS='|' read -r name url sha <<< "$entry"
  if [ "$FORCE" = "1" ] && [ -d "$name" ]; then
    echo "→ --force · removing $name"
    rm -rf "$name"
  fi
  if [ -d "$name/.git" ]; then
    current=$(cd "$name" && git rev-parse HEAD 2>/dev/null || echo "")
    if [ "$UPDATE" = "1" ]; then
      echo "→ $name · fetching latest"
      (cd "$name" && git fetch --depth 50 origin && git reset --hard origin/HEAD)
      newsha=$(cd "$name" && git rev-parse HEAD)
      echo "   was: $current"
      echo "   now: $newsha"
      echo "   (update LOCKFILE.md manually)"
    elif [ "$current" = "$sha" ]; then
      echo "✓ $name @ $sha (locked)"
    else
      echo "→ $name · checking out pinned $sha"
      (cd "$name" && git fetch --depth 50 origin "$sha" 2>/dev/null || true)
      (cd "$name" && git checkout "$sha")
    fi
  else
    echo "→ clone $url → $name (pinned $sha)"
    git clone --depth 1 "$url" "$name" >/dev/null 2>&1 || { echo "FAIL: $url"; continue; }
    (cd "$name" && git fetch --depth 50 origin "$sha" 2>/dev/null || true)
    (cd "$name" && git checkout "$sha" 2>/dev/null || echo "   warn: pinned sha not in shallow clone · using HEAD")
  fi
done

echo ""
echo "Done. See README.md for skill → pipeline mapping."
