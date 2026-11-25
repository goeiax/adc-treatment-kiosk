#!/usr/bin/env bash
# Copies files the kiosk page needs (doctor photos, videos, posters) into the data folder the RUNNING server uses.
# It writes no document: promos, treatments, pages, hearts and published versions stay as they are.
#   sudo bash server/fix-missing-files.sh            finds the running service and its data folder by itself
#   sudo bash server/fix-missing-files.sh <config>   or name the service's config file
#   add --check to only print what it found, without copying
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECK=0; CFG=""
for a in "$@"; do if [ "$a" = "--check" ]; then CHECK=1; else CFG="$a"; fi; done
DATA_ENV=""; CWD="$HERE"
echo "== ADC kiosk: missing files, $(date '+%Y-%m-%d %H:%M') on $(hostname) =="
if [ -z "$CFG" ]; then
  # several apps on one machine can run "node server.js": take the one that runs THIS checkout's server.js
  PID=""
  for p in $(pgrep -f 'node.*server\.js'); do
    c="$(readlink "/proc/$p/cwd" 2>/dev/null)"; s="$(tr '\0' '\n' < "/proc/$p/cmdline" 2>/dev/null | grep 'server\.js' | head -1)"
    case "$s" in /*) ;; *) s="$c/$s" ;; esac
    echo "found: pid $p running $s"
    if [ "$(readlink -f "$s" 2>/dev/null)" = "$(readlink -f "$HERE/server.js")" ]; then PID="$p"; fi
  done
  if [ -z "$PID" ] && [ -f "$HERE/config.json" ]; then
    echo "none of them runs $HERE/server.js, so using this checkout's own config"
    CFG="$HERE/config.json"
  elif [ -n "$PID" ] && [ -r "/proc/$PID/environ" ]; then
    CWD="$(readlink "/proc/$PID/cwd")"
    echo "running service: pid $PID, user $(ps -o user= -p "$PID" | tr -d ' '), folder $CWD"
    echo "service command: $(tr '\0' ' ' < "/proc/$PID/cmdline")"
    CFG="$(tr '\0' '\n' < "/proc/$PID/environ" | sed -n 's/^KIOSK_CONFIG=//p')"
    DATA_ENV="$(tr '\0' '\n' < "/proc/$PID/environ" | sed -n 's/^KIOSK_DATA=//p')"
    if [ -z "$CFG" ]; then
      SRV="$(tr '\0' '\n' < "/proc/$PID/cmdline" | grep 'server\.js' | head -1)"; case "$SRV" in /*) ;; *) SRV="$CWD/$SRV" ;; esac
      CFG="$(dirname "$SRV")/config.json"
    fi
    case "$CFG" in /*) ;; *) CFG="$CWD/$CFG" ;; esac
  else
    echo "No running 'node ... server.js' process found. Start the kiosk service first, or pass its config file."; exit 1
  fi
fi
echo "config file: $CFG $([ -f "$CFG" ] && echo '(found)' || echo '(not found, defaults apply)')"
DATA="$(CFG="$CFG" DATA_ENV="$DATA_ENV" node -e '
const fs=require("fs"),path=require("path");let c={};try{c=JSON.parse(fs.readFileSync(process.env.CFG,"utf8"))}catch(e){}
process.stdout.write(process.env.DATA_ENV?path.resolve(process.env.DATA_ENV):path.resolve(path.dirname(process.env.CFG),c.dataDir||"./data"))')"
echo "data folder in use: $DATA"
if [ ! -d "$DATA/db" ]; then echo "STOP: $DATA has no db folder, so it is not the folder the server uses. Nothing was copied."; exit 1; fi
echo "files there now: $(ls "$DATA/assets" 2>/dev/null | grep -c -E '^[0-9a-f]{32}$')"
echo "doctor photos in the code folder: $(ls "$(dirname "$HERE")/media/doctors" 2>/dev/null | grep -c -i -E '\.jpe?g$') (11 expected; run 'git pull' in $(dirname "$HERE") if fewer)"
if [ "$CHECK" = 1 ]; then echo "== check only, nothing copied =="; exit 0; fi
KIOSK_CONFIG="$CFG" node "$HERE/migrate.js" --assets-only --data "$DATA" || echo "(the import reported a problem, see above)"
OWNER="$(stat -c '%U:%G' "$DATA/db" 2>/dev/null)"
if [ -n "$OWNER" ]; then chown -R "$OWNER" "$DATA/assets" 2>/dev/null && echo "owner of the files set to $OWNER"; fi
echo "files there after: $(ls "$DATA/assets" | grep -c -E '^[0-9a-f]{32}$')"
echo "== done: reload the kiosk page on the screen =="
