#!/bin/bash
set -e

# Default command
if [ "$#" -eq 0 ]; then
  exec bash
else
  exec "$@"
fi