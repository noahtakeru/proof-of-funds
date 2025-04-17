#!/bin/bash

# Display colorful text
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}====== Starting Proof of Funds Development Environment ======${NC}"

# Check for tmux
if ! command -v tmux &> /dev/null; then
    echo -e "${RED}Error: tmux is not installed. Please install tmux to run this script.${NC}"
    echo "You can install it with: brew install tmux (on macOS) or apt-get install tmux (on Ubuntu)"
    exit 1
fi

# Create a new tmux session
SESSION_NAME="proof-of-funds"
tmux new-session -d -s $SESSION_NAME

# Window 1: Run the Next.js app
tmux rename-window -t $SESSION_NAME:0 "Next.js-App"
tmux send-keys -t $SESSION_NAME:0 "cd $(pwd) && echo -e '${GREEN}Starting Next.js app...${NC}' && npm run dev" C-m

# Window 2: Run the Hardhat node
tmux new-window -t $SESSION_NAME:1 -n "Hardhat-Node"
tmux send-keys -t $SESSION_NAME:1 "cd $(pwd) && echo -e '${GREEN}Starting Hardhat node...${NC}' && npm run node" C-m

# Window 3: Deploy contracts to local network
tmux new-window -t $SESSION_NAME:2 -n "Deploy-Contracts"
tmux send-keys -t $SESSION_NAME:2 "cd $(pwd) && echo -e '${GREEN}Waiting for Hardhat node to start...${NC}' && sleep 10 && echo -e '${GREEN}Deploying contracts to local network...${NC}' && npm run deploy:local" C-m

# Window 4: Build ZK circuits (if needed)
tmux new-window -t $SESSION_NAME:3 -n "ZK-Circuits"
tmux send-keys -t $SESSION_NAME:3 "cd $(pwd) && echo -e '${YELLOW}Do you want to build the ZK circuits? This may take a while.${NC}' && read -p 'Build ZK circuits? (y/n): ' ANSWER && if [ \"\$ANSWER\" = \"y\" ]; then echo -e '${GREEN}Building ZK circuits...${NC}' && npm run zk:build-circuits; else echo -e '${YELLOW}Skipping ZK circuit build.${NC}'; fi" C-m

# Window 5: Run ZK tests
tmux new-window -t $SESSION_NAME:4 -n "ZK-Tests"
tmux send-keys -t $SESSION_NAME:4 "cd $(pwd) && echo -e '${YELLOW}Ready to run ZK tests when needed.${NC}' && echo -e 'Run ${GREEN}npm run test:zk${NC} to test ZK components'" C-m

# Display a helpful message in the ZK-Tests window
tmux send-keys -t $SESSION_NAME:4 "echo -e '\n${BLUE}====== Development Environment Info ======${NC}'" C-m
tmux send-keys -t $SESSION_NAME:4 "echo -e '\n${GREEN}Next.js App:${NC} http://localhost:3000'" C-m
tmux send-keys -t $SESSION_NAME:4 "echo -e '${GREEN}Hardhat Node:${NC} http://localhost:8545'" C-m
tmux send-keys -t $SESSION_NAME:4 "echo -e '\n${YELLOW}Navigation Commands:${NC}'" C-m
tmux send-keys -t $SESSION_NAME:4 "echo ' - Ctrl+B then n: next window'" C-m
tmux send-keys -t $SESSION_NAME:4 "echo ' - Ctrl+B then p: previous window'" C-m
tmux send-keys -t $SESSION_NAME:4 "echo ' - Ctrl+B then d: detach from session (return to terminal)'" C-m
tmux send-keys -t $SESSION_NAME:4 "echo ' - To attach again: tmux attach -t $SESSION_NAME'" C-m
tmux send-keys -t $SESSION_NAME:4 "echo ' - To exit completely: exit from each window or kill the session'" C-m

# Attach to the session
tmux attach -t $SESSION_NAME

echo -e "${BLUE}====== Development environment stopped. ======${NC}" 