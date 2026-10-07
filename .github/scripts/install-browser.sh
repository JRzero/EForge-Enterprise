#!/usr/bin/env bash
set -euo pipefail

# Hosted Ubuntu's Azure HTTP mirror stalled both precise-source verify attempts.
# Keep the official Ubuntu archive and all browser dependencies; bound network stalls.
for source in /etc/apt/sources.list /etc/apt/sources.list.d/ubuntu.sources; do
  if [[ -f "$source" ]]; then
    sudo sed -i 's|http://azure.archive.ubuntu.com/ubuntu|https://archive.ubuntu.com/ubuntu|g' "$source"
  fi
done
printf '%s\n' 'Acquire::http::Timeout "30";' 'Acquire::https::Timeout "30";' 'Acquire::Retries "2";' |
  sudo tee /etc/apt/apt.conf.d/99-eforge-browser-network >/dev/null

for attempt in 1 2; do
  if timeout --kill-after=15s 4m npx playwright install --with-deps chromium; then
    exit 0
  fi
  if [[ "$attempt" == 1 ]]; then
    echo 'Browser dependency installation failed or stalled; retrying once.'
    sleep 10
  fi
done
echo 'Browser dependency installation failed after two bounded attempts.' >&2
exit 1
