#!/usr/bin/env bash
set -euo pipefail

# Counts merged PRs and lines changed per author in zylo/waterworks.
# Reports two windows: all time, and the trailing 365 days.
#
# Usage:
#   ./waterworks-pr-stats.sh              # human-readable tables
#   ./waterworks-pr-stats.sh --json       # raw JSON
#   REPO=zylo/other ./waterworks-pr-stats.sh

REPO="${REPO:-zylo/waterworks}"
FORMAT="${1:-table}"

# 1 year ago in YYYY-MM-DD (BSD date on macOS, GNU date on Linux)
CUTOFF=$(date -v-1y +%Y-%m-%d 2>/dev/null || date -d '1 year ago' +%Y-%m-%d)

echo "Fetching merged PRs from $REPO (this may take a minute)..." >&2

# gh paginates internally given a high --limit. additions/deletions/author/mergedAt
# come straight off the PR object.
RAW=$(gh pr list \
  --repo "$REPO" \
  --state merged \
  --limit 100000 \
  --json author,additions,deletions,mergedAt)

TOTAL=$(echo "$RAW" | jq 'length')
echo "Fetched $TOTAL merged PRs. Aggregating..." >&2

AGG=$(echo "$RAW" | jq --arg cutoff "$CUTOFF" '
  def agg(prs):
    prs
    | group_by(.author.login // "unknown")
    | map({
        author: (.[0].author.login // "unknown"),
        prs: length,
        additions: (map(.additions) | add),
        deletions: (map(.deletions) | add),
        total_changed: (map(.additions + .deletions) | add)
      })
    | sort_by(-.prs);

  {
    cutoff: $cutoff,
    all_time:  agg(.),
    last_year: agg([.[] | select(.mergedAt >= $cutoff)])
  }
')

if [[ "$FORMAT" == "--json" ]]; then
  echo "$AGG"
  exit 0
fi

print_table() {
  local title="$1"
  local data="$2"
  echo
  echo "=== $title ==="
  {
    printf "AUTHOR\tPRS\tADDITIONS\tDELETIONS\tTOTAL_CHANGED\n"
    echo "$data" | jq -r '.[] | [.author, .prs, .additions, .deletions, .total_changed] | @tsv'
  } | column -t -s $'\t'
}

print_table "All time" "$(echo "$AGG" | jq '.all_time')"
print_table "Last year (merged on or after $CUTOFF)" "$(echo "$AGG" | jq '.last_year')"
