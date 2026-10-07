#!/usr/bin/env bash
set -euo pipefail

# Hosted Ubuntu's Azure HTTP mirror stalled both precise-source verify attempts.
# Keep the official Ubuntu archive and all browser dependencies; bound network stalls.
for source in /etc/apt/sources.list /etc/apt/sources.list.d/ubuntu.sources /etc/apt/apt-mirrors.txt; do
  if [[ -f "$source" ]]; then
    sudo sed -i -e 's|http://azure.archive.ubuntu.com/ubuntu|https://archive.ubuntu.com/ubuntu|g' -e 's|http://archive.ubuntu.com/ubuntu|https://archive.ubuntu.com/ubuntu|g' "$source"
  fi
done
printf '%s\n' 'Acquire::http::Timeout "30";' 'Acquire::https::Timeout "30";' 'Acquire::Retries "2";' |
  sudo tee /etc/apt/apt.conf.d/99-eforge-browser-network >/dev/null

node_binary="$(command -v node)"
for attempt in 1 2; do
  # Run the dependency timeout as root, so it owns and can terminate its own
  # apt children. Timing out an unprivileged CLI left sudo's apt process alive.
  # Download the browser as the ordinary runner user, preserving its cache owner.
  if sudo timeout --kill-after=15s 2m "$node_binary" node_modules/playwright/cli.js install-deps chromium &&
      timeout --kill-after=15s 2m "$node_binary" node_modules/playwright/cli.js install chromium; then
    exit 0
  fi
  if [[ "$attempt" == 1 ]]; then
    echo 'Browser dependency installation failed or stalled; retrying once.'
    sleep 10
  fi
done
echo 'Browser dependency installation failed after two bounded attempts.' >&2
exit 1
