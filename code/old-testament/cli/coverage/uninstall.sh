#!/bin/sh
set -e

INSTALL_DIR="${HOME}/.local/bin"
LIB_DIR="${INSTALL_DIR}/ot-coverage-lib"

if [ -f "${INSTALL_DIR}/ot-coverage" ]; then
  rm "${INSTALL_DIR}/ot-coverage"
  echo "Removed ${INSTALL_DIR}/ot-coverage"
else
  echo "ot-coverage not found at ${INSTALL_DIR}/ot-coverage"
fi

if [ -d "${LIB_DIR}" ]; then
  rm -r "${LIB_DIR}"
  echo "Removed ${LIB_DIR}"
fi

echo "Uninstalled ot-coverage."
