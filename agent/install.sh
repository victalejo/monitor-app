#!/bin/bash

# Monitor Agent Installation Script
# This script installs the monitoring agent as a systemd service

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   Monitor Agent Installer                                ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Please run as root (use sudo)"
  exit 1
fi

# Variables
INSTALL_DIR="/opt/monitor-agent"
SERVICE_FILE="/etc/systemd/system/monitor-agent.service"
USER="monitor"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  echo "ERROR: Node.js is not installed"
  echo "Please install Node.js 18+ first:"
  echo "  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
  echo "  sudo apt-get install -y nodejs"
  exit 1
fi

echo "✓ Node.js version: $(node --version)"

# Create user if doesn't exist
if ! id "$USER" &>/dev/null; then
  echo "Creating user $USER..."
  useradd -r -s /bin/false $USER
  echo "✓ User created"
else
  echo "✓ User $USER already exists"
fi

# Create installation directory
echo "Creating installation directory..."
mkdir -p $INSTALL_DIR
mkdir -p $INSTALL_DIR/data
cp -r ./* $INSTALL_DIR/
chown -R $USER:$USER $INSTALL_DIR
echo "✓ Files copied to $INSTALL_DIR"

# Install dependencies
echo "Installing dependencies..."
cd $INSTALL_DIR
npm install --production
echo "✓ Dependencies installed"

# Create .env file if doesn't exist
if [ ! -f "$INSTALL_DIR/.env" ]; then
  echo ""
  echo "Configuration:"
  read -p "Enter backend URL (e.g., http://your-server:3000): " BACKEND_URL
  read -p "Enter API key: " API_KEY

  cat > $INSTALL_DIR/.env << EOF
BACKEND_URL=$BACKEND_URL
API_KEY=$API_KEY
COLLECT_INTERVAL=60
HEARTBEAT_INTERVAL=30
NODE_ENV=production
EOF

  chown $USER:$USER $INSTALL_DIR/.env
  echo "✓ Configuration file created"
else
  echo "✓ Configuration file already exists"
fi

# Create systemd service
echo "Creating systemd service..."
cat > $SERVICE_FILE << EOF
[Unit]
Description=Monitor Agent
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node $INSTALL_DIR/src/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

echo "✓ Systemd service created"

# Reload systemd
systemctl daemon-reload

# Enable and start service
echo "Starting service..."
systemctl enable monitor-agent
systemctl start monitor-agent

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   ✓ Installation Complete!                               ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Service commands:"
echo "  Start:   systemctl start monitor-agent"
echo "  Stop:    systemctl stop monitor-agent"
echo "  Status:  systemctl status monitor-agent"
echo "  Logs:    journalctl -u monitor-agent -f"
echo ""
echo "Configuration: $INSTALL_DIR/.env"
echo ""

# Show status
systemctl status monitor-agent --no-pager
