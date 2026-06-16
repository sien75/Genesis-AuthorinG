#!/bin/sh
set -e

INSTALL_DIR="${HOME}/.local/bin"
LIB_DIR="${INSTALL_DIR}/ot-verify-lib"

if [ -f "${INSTALL_DIR}/ot-verify" ]; then
  rm "${INSTALL_DIR}/ot-verify"
  echo "Removed ${INSTALL_DIR}/ot-verify"
else
  echo "ot-verify not found at ${INSTALL_DIR}/ot-verify"
fi

if [ -d "${LIB_DIR}" ]; then
  rm -r "${LIB_DIR}"
  echo "Removed ${LIB_DIR}"
fi

echo "Uninstalled ot-verify."
