#!/bin/bash

# Development Environment Startup Script for Teamager
# This script starts all necessary services for local development

echo "Starting Teamager Development Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to start service in background
start_service() {
    local name=$1
    local command=$2
    local dir=$3

    echo -e "${BLUE}Starting $name...${NC}"
    if [ ! -z "$dir" ]; then
        cd "$dir"
    fi

    # Start service in background and capture PID
    $command &
    local pid=$!
    echo -e "${GREEN}$name started (PID: $pid)${NC}"

    # Store PID for cleanup
    echo $pid >> /tmp/teamager_pids.txt
}

# Clean up any existing PIDs file
rm -f /tmp/teamager_pids.txt

echo -e "${YELLOW}Starting services...${NC}"

# 1. Backend API Server (also serves Y.js WebSocket on /yjs/*)
start_service "Backend API Server" "npm run dev" "./backend"

# Wait a moment for backend to start
sleep 2

# 2. Frontend Next.js Server
start_service "Frontend Next.js Server" "npm run dev" "./frontend"

echo ""
echo -e "${GREEN}All services started!${NC}"
echo ""
echo -e "${YELLOW}Service URLs:${NC}"
echo -e "  Frontend:        http://localhost:3000"
echo -e "  Backend API:     http://localhost:3001"
echo -e "  Y.js WebSocket:  ws://localhost:3001/yjs/*"
echo ""
echo -e "${YELLOW}Useful Commands:${NC}"
echo -e "  Stop all services: pkill -F /tmp/teamager_pids.txt"
echo ""
echo -e "${BLUE}Press Ctrl+C to stop all services${NC}"

# Create cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}Stopping all services...${NC}"

    if [ -f /tmp/teamager_pids.txt ]; then
        while read pid; do
            if kill -0 $pid 2>/dev/null; then
                echo -e "${RED}Stopping PID $pid${NC}"
                kill $pid
            fi
        done < /tmp/teamager_pids.txt
        rm -f /tmp/teamager_pids.txt
    fi

    echo -e "${GREEN}All services stopped${NC}"
    exit 0
}

# Set up signal handling
trap cleanup SIGINT SIGTERM

# Wait for all background processes
wait
