#!/bin/bash
# Build a tiny macOS .app bundle that launches `curator dashboard`.
#
# Why an .app and not Electron?
#   The dashboard already opens in your default browser. We don't need a
#   bundled Chromium — we just need a thing in /Applications you can click
#   to start the server. ~10 KB instead of ~150 MB.
#
# Usage:
#   bash scripts/build-app.sh
#   open dist/Curator.app           # try it locally
#   cp -r dist/Curator.app /Applications/   # install
#
# Quitting:
#   - From the dock: right-click → Quit (stops the dashboard server)
#   - From the menu bar: it doesn't have one (no app delegate). Use the dock.
#
# Requires:
#   - macOS (uses osascript for error dialogs, .app bundle layout)
#   - Either `curator` on PATH (after `npm link`) or this repo cloned

set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$REPO/dist/Curator.app"
CONTENTS="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS/MacOS"
RES_DIR="$CONTENTS/Resources"

# Clean previous build
rm -rf "$APP_DIR"
mkdir -p "$MACOS_DIR" "$RES_DIR"

# Info.plist — minimum keys for a "real" .app the OS will treat normally.
cat > "$CONTENTS/Info.plist" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Curator</string>
  <key>CFBundleDisplayName</key><string>Curator</string>
  <key>CFBundleIdentifier</key><string>dev.curator.dashboard</string>
  <key>CFBundleExecutable</key><string>Curator</string>
  <key>CFBundleVersion</key><string>0.1.0</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.developer-tools</string>
</dict>
</plist>
EOF

# Launcher script — runs when the user clicks the icon.
#
# Why delegate to Terminal.app (via osascript)?
#   When .apps are launched from Finder/Spotlight/Dock, macOS TCC blocks
#   reading from ~/Documents, ~/Desktop, ~/Downloads unless the app is
#   granted Full Disk Access. Since `curator` is typically `npm link`-ed
#   into ~/Documents/curator, a direct exec hits EPERM. Terminal.app
#   already has the right permissions (the user uses it daily), so we
#   ask Terminal to run the command instead. Closing the Terminal tab
#   kills the server. Simple and reliable.
cat > "$MACOS_DIR/Curator" <<'EOF'
#!/bin/bash
# Curator launcher (macOS .app)

PORT=4711
URL="http://127.0.0.1:$PORT"

# Already running? Just open the browser.
if lsof -ti:$PORT >/dev/null 2>&1; then
  open "$URL"
  exit 0
fi

# Find the curator binary using a login shell so PATH includes Homebrew
# and npm-linked binaries. We resolve the path here (in the .app's own
# context, which is enough to run `command -v`) and pass the absolute
# path to Terminal so it doesn't depend on Terminal's PATH.
SHELL_BIN="${SHELL:-/bin/zsh}"
CURATOR_BIN=$("$SHELL_BIN" -lic 'command -v curator' 2>/dev/null | tail -n1)

if [ -z "$CURATOR_BIN" ]; then
  osascript -e 'display alert "Curator not installed" message "Open Terminal and run:\n\ngit clone git@github.com:KarimJebara/Curator.git\ncd Curator\nnpm install && npm link\n\nThen open Curator.app again." as critical'
  exit 1
fi

# Hand off to Terminal.app. Terminal has the Documents/FDA permissions
# our launcher doesn't, so reads from ~/Documents/curator/* succeed.
osascript <<APPLESCRIPT
tell application "Terminal"
  activate
  do script "clear; echo 'Starting Curator dashboard…'; '$CURATOR_BIN' dashboard"
end tell
APPLESCRIPT
EOF

chmod +x "$MACOS_DIR/Curator"

# Tiny iconless badge so Finder doesn't show generic terminal cog forever:
# generate a 1024×1024 PNG with `Curator` text using sips/Image Magick if
# available, else skip and let macOS use a generic icon. Skipped for v0.1
# to keep this script dependency-free. Drop a Curator.icns in the
# Resources/ dir later to get a real icon.

echo "Built $APP_DIR"
echo
echo "Try it:    open $APP_DIR"
echo "Install:   cp -r $APP_DIR /Applications/"
echo "Spotlight: type 'Curator' after install"
