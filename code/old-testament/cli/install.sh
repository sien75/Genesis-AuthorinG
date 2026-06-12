#!/bin/sh
set -e

INSTALL_DIR="${HOME}/.local/bin"
LIB_DIR="${INSTALL_DIR}/ot-coverage-lib"
mkdir -p "${LIB_DIR}/bin" "${LIB_DIR}/lib"

REPO_BASE="https://raw.githubusercontent.com/sien75/Genesis-AuthorinG/refs/heads/main/code/old-testament/cli"

echo "Downloading ot-coverage..."
curl -fsSL "${REPO_BASE}/bin/ot-coverage.mjs" -o "${LIB_DIR}/bin/ot-coverage.mjs"
curl -fsSL "${REPO_BASE}/lib/utils.mjs" -o "${LIB_DIR}/lib/utils.mjs"
curl -fsSL "${REPO_BASE}/lib/init.mjs" -o "${LIB_DIR}/lib/init.mjs"
curl -fsSL "${REPO_BASE}/lib/mark.mjs" -o "${LIB_DIR}/lib/mark.mjs"
curl -fsSL "${REPO_BASE}/lib/status.mjs" -o "${LIB_DIR}/lib/status.mjs"

cat > "${INSTALL_DIR}/ot-coverage" << 'EOF'
#!/bin/sh
exec node "${HOME}/.local/bin/ot-coverage-lib/bin/ot-coverage.mjs" "$@"
EOF

chmod +x "${INSTALL_DIR}/ot-coverage"

echo "Installed ot-coverage to ${INSTALL_DIR}/ot-coverage"
echo "Make sure ${INSTALL_DIR} is in your PATH."
echo "Test with: ot-coverage help"
