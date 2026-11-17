#!/bin/bash
# MalesStudio Chromium wrapper for Remotion renderer - with debug logging
echo "=== WRAPPER INVOKED ===" >> /tmp/chrome-wrapper-debug.log
date >> /tmp/chrome-wrapper-debug.log
printf 'ARGS: %s\n' "$*" >> /tmp/chrome-wrapper-debug.log
echo "------------------------" >> /tmp/chrome-wrapper-debug.log

args=()
for a in "$@"; do
  case "$a" in
    --single-process|--no-zygote) ;;
    *) args+=("$a") ;;
  esac
done
exec /usr/bin/chromium-browser "${args[@]}"
