#!/bin/bash

# Test script for Phase 2.1 implementation
# This script runs all the tests for Phase 2.1 of the ZKP platform implementation

# Set up colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print header
echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}   Testing Phase 2.1 Implementation   ${NC}"
echo -e "${BLUE}==============================================${NC}"
echo ""

# Start the backend server if it's not already running
if ! curl -s http://localhost:3000/health > /dev/null; then
  echo -e "${YELLOW}Starting backend server...${NC}"
  echo -e "${YELLOW}(This will run in a separate terminal window)${NC}"
  cd "$(dirname "$0")/../packages/backend" && npm run dev & disown
  # Give the server some time to start
  sleep 10
  echo -e "${GREEN}Backend server started${NC}"
else
  echo -e "${GREEN}Backend server is already running${NC}"
fi

# Start the frontend server if it's not already running
if ! curl -s http://localhost:3001 > /dev/null; then
  echo -e "${YELLOW}Starting frontend server...${NC}"
  echo -e "${YELLOW}(This will run in a separate terminal window)${NC}"
  cd "$(dirname "$0")/../packages/frontend" && npm run dev & disown
  # Give the server some time to start
  sleep 10
  echo -e "${GREEN}Frontend server started${NC}"
else
  echo -e "${GREEN}Frontend server is already running${NC}"
fi

echo ""
echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}   1. Testing Backend Implementation   ${NC}"
echo -e "${BLUE}==============================================${NC}"

# Run unit tests for email authentication service
echo -e "${YELLOW}Running unit tests for authentication services...${NC}"
cd "$(dirname "$0")/../packages/backend" && npx jest src/__tests__/services/emailAuthService.test.ts
test_exit_code=$?

if [ $test_exit_code -eq 0 ]; then
  echo -e "${GREEN}✅ Unit tests passed${NC}"
else
  echo -e "${RED}❌ Unit tests failed${NC}"
  exit 1
fi

echo ""
echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}   2. Testing API Endpoints   ${NC}"
echo -e "${BLUE}==============================================${NC}"

# Install required dependencies for test scripts
cd "$(dirname "$0")/.." && npm install axios chalk

# Run API endpoint tests
echo -e "${YELLOW}Testing authentication API endpoints...${NC}"
node "$(dirname "$0")/test-auth-api.js"
api_test_exit_code=$?

if [ $api_test_exit_code -eq 0 ]; then
  echo -e "${GREEN}✅ API endpoint tests passed${NC}"
else
  echo -e "${RED}❌ API endpoint tests failed${NC}"
  # Continue with other tests even if API tests fail
fi

echo ""
echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}   3. Testing Frontend Components   ${NC}"
echo -e "${BLUE}==============================================${NC}"

# Run frontend component tests
echo -e "${YELLOW}Testing frontend authentication components...${NC}"
node "$(dirname "$0")/test-frontend-auth.js"
frontend_test_exit_code=$?

if [ $frontend_test_exit_code -eq 0 ]; then
  echo -e "${GREEN}✅ Frontend component tests passed${NC}"
else
  echo -e "${RED}❌ Frontend component tests failed${NC}"
  # Continue with other tests even if frontend tests fail
fi

echo ""
echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}   4. Testing Security Features   ${NC}"
echo -e "${BLUE}==============================================${NC}"

# Run security feature tests
echo -e "${YELLOW}Testing security features...${NC}"
node "$(dirname "$0")/test-security-features.js"
security_test_exit_code=$?

if [ $security_test_exit_code -eq 0 ]; then
  echo -e "${GREEN}✅ Security feature tests passed${NC}"
else
  echo -e "${RED}❌ Security feature tests failed${NC}"
  # Continue with the summary even if security tests fail
fi

echo ""
echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}   Final Summary   ${NC}"
echo -e "${BLUE}==============================================${NC}"

# Calculate overall result
if [ $test_exit_code -eq 0 ] && [ $api_test_exit_code -eq 0 ] && [ $frontend_test_exit_code -eq 0 ] && [ $security_test_exit_code -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
  echo -e "${GREEN}✅ Phase 2.1 implementation is complete${NC}"
  echo ""
  echo -e "${YELLOW}Note: Some tests may show warnings if the application is not running in production mode${NC}"
  echo -e "${YELLOW}or if some endpoints are not fully implemented yet.${NC}"
  exit 0
else
  echo -e "${RED}❌ Some tests failed${NC}"
  echo ""
  echo -e "${YELLOW}Please review the test output above for details on what needs to be fixed.${NC}"
  exit 1
fi