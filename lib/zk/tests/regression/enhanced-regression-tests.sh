#!/bin/bash

# Zero-Knowledge Infrastructure Enhanced Regression Tests 2.0
# This script combines the functionality of both part 1 and part 2 of the enhanced regression tests
# It provides thorough validation of all aspects of the ZK infrastructure

# Execute part 1 of the enhanced regression tests
# This runs the basic module and functional tests
bash "$(dirname "$0")/run-enhanced-regression-tests.sh"
PART1_EXIT=$?

# Execute part 2 of the enhanced regression tests
# This runs the error handling, browser compatibility, and stress tests
bash "$(dirname "$0")/run-enhanced-regression-tests-part2.sh"
PART2_EXIT=$?

# Final check - if either part failed, exit with error
if [ $PART1_EXIT -ne 0 ] || [ $PART2_EXIT -ne 0 ]; then
  echo -e "\n\033[0;31mEnhanced regression tests failed. Check the output above for details.\033[0m"
  exit 1
else
  echo -e "\n\033[0;32mAll enhanced regression tests completed successfully!\033[0m"
  exit 0
fi 