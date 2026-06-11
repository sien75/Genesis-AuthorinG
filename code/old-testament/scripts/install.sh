#!/usr/bin/env sh
set -eu

REPO_OWNER="${GAGCODE_REPO_OWNER:-sien75}"
REPO_NAME="${GAGCODE_REPO_NAME:-Genesis-AuthorinG}"
REF="${GAGCODE_REF:-main}"
PROJECT_PATH="${GAGCODE_PROJECT_PATH:-code/old-testament}"
INSTALL_DIR="${GAGCODE_INSTALL_DIR:-$HOME/.gagcode/cli}"
BIN_DIR="${GAGCODE_BIN_DIR:-$HOME/.local/bin}"
TARBALL_URL="https://github.com/$REPO_OWNER/$REPO_NAME/archive/refs/heads/$REF.tar.gz"

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "gagcode install error: missing required command: $1" >&2
    exit 1
  fi
}

need curl
need tar
need npm
need node

TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t gagcode)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

echo "Downloading gagcode from $TARBALL_URL"
curl -fsSL "$TARBALL_URL" | tar -xz -C "$TMP_DIR"

SOURCE_DIR="$TMP_DIR/$REPO_NAME-$REF/$PROJECT_PATH"
if [ ! -d "$SOURCE_DIR" ]; then
  echo "gagcode install error: expected project path not found: $PROJECT_PATH" >&2
  exit 1
fi

rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
cp -R "$SOURCE_DIR"/. "$INSTALL_DIR"/

cd "$INSTALL_DIR"
echo "Installing dependencies"
npm install

echo "Building gagcode"
npm run build

mkdir -p "$BIN_DIR"
ln -sf "$INSTALL_DIR/dist/gagcode-cli.js" "$BIN_DIR/gagcode"
chmod +x "$INSTALL_DIR/dist/gagcode-cli.js"

echo "gagcode installed at $INSTALL_DIR"
echo "gagcode executable linked at $BIN_DIR/gagcode"

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *)
    echo ""
    echo "Add this to your shell profile if gagcode is not found:"
    echo "  export PATH=\"$BIN_DIR:\$PATH\""
    ;;
esac

echo ""
echo "Verify with:"
echo "  gagcode --help"
