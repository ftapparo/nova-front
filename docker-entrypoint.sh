#!/bin/sh
set -eu

if [ -f /etc/build_version ]; then
  BUILD_VERSION="$(cat /etc/build_version)"
  export BUILD_VERSION
  echo ">>> BUILD_VERSION: ${BUILD_VERSION}"
fi

exec nginx -g 'daemon off;'