#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

clear

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║   WebXR Stream - Server Launcher          ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed!${NC}"
    echo "Please download from: https://nodejs.org/"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ Node.js found:${NC}"
node --version
echo ""

# Check if npm packages are installed
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    npm install
    echo ""
fi

# Create logs directory if it doesn't exist
mkdir -p logs

echo -e "${BLUE}🚀 Starting WebXR Stream Server...${NC}"
echo ""
echo "Server will be available at:"
echo "  - http://localhost:3000"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
echo "════════════════════════════════════════════"
echo ""

node server.js
