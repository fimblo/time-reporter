#!/bin/bash
# xbar plugin — shows the active time-reporter task in the macOS menu bar.
#
# <xbar.title>Time Reporter</xbar.title>
# <xbar.version>v1.0</xbar.version>
# <xbar.desc>Shows the active task from a local time-reporter server</xbar.desc>
# <xbar.dependencies>jq,curl</xbar.dependencies>
#
# Install
# -------
# 1. brew install jq            (if not already installed)
# 2. Install xbar from https://xbarapp.com
# 3. Symlink this script into the xbar plugins directory:
#
#      ln -s /path/to/repo/scripts/time-reporter.5s.sh \
#            ~/Library/Application\ Support/xbar/plugins/time-reporter.5s.sh
#      chmod +x /path/to/repo/scripts/time-reporter.5s.sh
#
# 4. Open xbar → "Refresh all"

API="http://localhost:3001/api"

# ── Actions (triggered by menu item clicks) ────────────────────────────────
case "${1:-}" in
  pause)
    STATE=$(curl -sf --max-time 3 "$API/state") || exit 0
    NOW=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
    PATCHED=$(echo "$STATE" | jq --arg now "$NOW" '
      .tasks |= map(
        .intervals |= map(if .["end"] == null then .["end"] = $now else . end)
      ) |
      .lastActiveTaskId = null
    ')
    curl -sf -X PUT "$API/state" \
      -H "Content-Type: application/json" -d "$PATCHED" > /dev/null
    exit 0
    ;;

  start)
    TASK_ID="${2:-}"
    [[ -z "$TASK_ID" ]] && exit 0
    STATE=$(curl -sf --max-time 3 "$API/state") || exit 0
    NOW=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
    PATCHED=$(echo "$STATE" | jq --arg now "$NOW" --arg id "$TASK_ID" '
      .tasks |= map(
        .intervals |= map(if .["end"] == null then .["end"] = $now else . end)
      ) |
      .tasks |= map(
        if .id == $id
        then .intervals += [{"start": $now, "end": null}]
        else . end
      ) |
      .lastActiveTaskId = $id
    ')
    curl -sf -X PUT "$API/state" \
      -H "Content-Type: application/json" -d "$PATCHED" > /dev/null
    exit 0
    ;;
esac

# ── Fetch state ────────────────────────────────────────────────────────────
if ! STATE=$(curl -sf --max-time 2 "$API/state" 2>/dev/null); then
  echo "⏱ –"
  echo "---"
  echo "Time Reporter: server offline"
  exit 0
fi

# ── Find active task ───────────────────────────────────────────────────────
ACTIVE=$(echo "$STATE" | jq -c '
  first(
    .tasks[] | . as $t |
    .intervals[] | select(.["end"] == null) |
    {id: $t.id, topic: $t.topic, client: $t.client, start: .start}
  ) // empty
')

# ── Elapsed time (macOS BSD date, UTC-aware) ───────────────────────────────
elapsed_str() {
  local start_epoch
  start_epoch=$(TZ=UTC date -j -f "%Y-%m-%dT%H:%M:%S" "${1:0:19}" "+%s" 2>/dev/null) || return 1
  local elapsed=$(( $(date +%s) - start_epoch ))
  local h=$(( elapsed / 3600 ))
  local m=$(( (elapsed % 3600) / 60 ))
  local s=$(( elapsed % 60 ))
  if (( h > 0 )); then printf "%dh %02dm" $h $m
  else             printf "%dm %02ds" $m $s
  fi
}

# ── Render ─────────────────────────────────────────────────────────────────
if [[ -n "$ACTIVE" ]]; then
  TOPIC=$(echo "$ACTIVE"  | jq -r '.topic')
  CLIENT=$(echo "$ACTIVE" | jq -r '.client')
  START=$(echo "$ACTIVE"  | jq -r '.start')
  ELAPSED=$(elapsed_str "$START") || ELAPSED="?"

  # Truncate long topic names in the menu bar
  LABEL="${TOPIC:0:28}"
  [[ ${#TOPIC} -gt 28 ]] && LABEL="${LABEL}…"

  echo "⏱ ${LABEL}  ${ELAPSED}"
  echo "---"
  echo "${CLIENT} › ${TOPIC}"
  echo "Running: ${ELAPSED}"
  echo "---"
  echo "⏸ Pause | bash=\"$0\" param1=pause terminal=false refresh=true"

else
  echo "⏱ –"
  echo "---"
  echo "No task running"
  echo "---"

  # List the 5 most recently active tasks as quick-start items
  RECENT=$(echo "$STATE" | jq -r '
    [
      .tasks[] | . as $t |
      select((.intervals | length) > 0) |
      (.intervals | max_by(.start) | .start) as $last |
      {id: $t.id, topic: $t.topic, client: $t.client, last: $last}
    ] |
    sort_by(.last) | reverse | .[0:5][] |
    "\(.id)\t\(.client) › \(.topic)"
  ')

  if [[ -n "$RECENT" ]]; then
    echo "Start a task:"
    while IFS=$'\t' read -r task_id label; do
      echo "▶ ${label} | bash=\"$0\" param1=start param2=${task_id} terminal=false refresh=true"
    done <<< "$RECENT"
  fi
fi
