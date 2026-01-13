#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

clear

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║   WebXR Stream - Release Builder          ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Create release directory
mkdir -p release

echo -e "${BLUE}📦 Building Server Package...${NC}"
echo ""

# Create server package
zip -r release/webxr-stream-server.zip \
  server.js \
  sender.html \
  receiver.html \
  index.html \
  package.json \
  ecosystem.config.js \
  start-server.bat \
  start-server.sh \
  README.md \
  -x "*.git*" "node_modules/*" "sender-app/*"

echo -e "${GREEN}✅ Server package created: release/webxr-stream-server.zip${NC}"
echo ""

echo -e "${BLUE}🔨 Building Electron App...${NC}"
cd sender-app
npm install

# Detect platform and build
if [[ "$OSTYPE" == "darwin"* ]]; then
  npm run build:mac
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  npm run build:linux
fi

cd ..

echo ""
echo -e "${GREEN}✅ Build Complete!${NC}"
echo ""
echo "Release files:"
ls -lh release/
echo ""
echo "Electron builds:"
ls -lh sender-app/dist/
echo ""
