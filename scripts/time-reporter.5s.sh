#!/bin/bash
# xbar plugin — shows the active time-reporter task in the macOS menu bar.
#
# <xbar.title>Time Reporter</xbar.title>
# <xbar.version>v1.1</xbar.version>
# <xbar.desc>Shows the active task from a local time-reporter server</xbar.desc>
# <xbar.dependencies>jq,curl</xbar.dependencies>
#
# Install
# -------
# 1. brew install jq            (if not already installed)
# 2. brew install --cask xbar
# 3. Symlink this script into the xbar plugins directory:
#
#      ln -s /path/to/repo/scripts/time-reporter.5s.sh \
#            ~/Library/Application\ Support/xbar/plugins/time-reporter.5s.sh
#      chmod +x /path/to/repo/scripts/time-reporter.5s.sh
#
# 4. Open xbar → "Refresh all"

API="http://localhost:3001/api"

# Format total seconds as "Xh YYm" or "Ym YYs"
format_secs() {
  local total=$1
  local h=$(( total / 3600 ))
  local m=$(( (total % 3600) / 60 ))
  local s=$(( total % 60 ))
  if (( h > 0 )); then printf "%dh %02dm" "$h" "$m"
  else             printf "%dm %02ds" "$m" "$s"
  fi
}

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
    INTERVAL_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
    PATCHED=$(echo "$STATE" | jq \
      --arg now "$NOW" \
      --arg task_id "$TASK_ID" \
      --arg interval_id "$INTERVAL_ID" '
      .tasks |= map(
        .intervals |= map(if .["end"] == null then .["end"] = $now else . end)
      ) |
      .tasks |= map(
        if .id == $task_id
        then .intervals += [{
          "id": $interval_id,
          "taskId": $task_id,
          "start": $now,
          "end": null
        }]
        else . end
      ) |
      .lastActiveTaskId = $task_id
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

# ── Today's boundaries (local time → epoch) ───────────────────────────────
# /bin/date is macOS BSD date; the -j flag is not available in GNU date.
TODAY=$(/bin/date +%Y-%m-%d)
T0=$(/bin/date -j -f "%Y-%m-%d %H:%M:%S" "$TODAY 00:00:00" "+%s")
T1=$(/bin/date +%s)

# ── Find active task ───────────────────────────────────────────────────────
ACTIVE=$(echo "$STATE" | jq -c '
  first(
    .tasks[] | . as $t |
    .intervals[] | select(.["end"] == null) |
    {id: $t.id, topic: $t.topic, client: $t.client}
  ) // empty
')

# ── Render ─────────────────────────────────────────────────────────────────
if [[ -n "$ACTIVE" ]]; then
  TASK_ID=$(echo "$ACTIVE" | jq -r '.id')
  TOPIC=$(echo "$ACTIVE"   | jq -r '.topic')
  CLIENT=$(echo "$ACTIVE"  | jq -r '.client')

  # Sum all intervals that overlap with today — matches what the browser shows
  TOTAL_SECS=$(echo "$STATE" | jq \
    --arg id "$TASK_ID" \
    --argjson t0 "$T0" \
    --argjson t1 "$T1" '
    .tasks[] | select(.id == $id) |
    [
      .intervals[] |
      (.start | if contains(".") then split(".")[0] + "Z" else . end | fromdate) as $s |
      (
        if .["end"] != null
        then (.["end"] | if contains(".") then split(".")[0] + "Z" else . end | fromdate)
        else $t1
        end
      ) as $e |
      (if $s > $t0 then $s else $t0 end) as $a |
      (if $e < $t1 then $e else $t1 end) as $b |
      if $b > $a then $b - $a else 0 end
    ] | add // 0
  ')

  ELAPSED=$(format_secs "$TOTAL_SECS")
  LABEL="${TOPIC:0:28}"
  [[ ${#TOPIC} -gt 28 ]] && LABEL="${LABEL}…"

  echo "⏱ ${LABEL}  ${ELAPSED}"
  echo "---"
  echo "${CLIENT} › ${TOPIC}"
  echo "Today: ${ELAPSED}"
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
