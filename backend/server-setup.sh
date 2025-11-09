#!/bin/bash

# Server Setup Script for Monitor Backend
# Run this ONCE on the server before first deployment

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   Monitor Backend - Server Setup                         ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Please run as root"
  exit 1
fi

echo "📦 Installing required packages..."

# Update system
apt-get update
apt-get upgrade -y

# Install Docker if not installed
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
    echo "✓ Docker installed"
else
    echo "✓ Docker already installed"
fi

# Install Docker Compose if not installed
if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo "✓ Docker Compose installed"
else
    echo "✓ Docker Compose already installed"
fi

# Check Nginx
if ! command -v nginx &> /dev/null; then
    echo "Installing Nginx..."
    apt-get install -y nginx
    systemctl enable nginx
    systemctl start nginx
    echo "✓ Nginx installed"
else
    echo "✓ Nginx already installed"
fi

# Install Certbot if not installed (for SSL)
if ! command -v certbot &> /dev/null; then
    echo "Installing Certbot..."
    apt-get install -y certbot python3-certbot-nginx
    echo "✓ Certbot installed"
else
    echo "✓ Certbot already installed"
fi

# Create Docker network for Nginx proxy
echo "Creating Docker network..."
docker network create nginx-proxy || echo "Network already exists"

# Create project directories
echo "Creating project directories..."
mkdir -p /opt/monitor-app/backend
mkdir -p /opt/monitor-app/backups
mkdir -p /var/www/certbot

echo "✓ Directories created"

# Setup SSL certificate
echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   SSL Certificate Setup                                  ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
read -p "Do you want to setup SSL certificate now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Setting up SSL for monitoreo.victalejo.dev..."

    # Obtain certificate
    certbot certonly --nginx \
        -d monitoreo.victalejo.dev \
        --non-interactive \
        --agree-tos \
        --email admin@victalejo.dev \
        || echo "Certificate setup failed or already exists"

    # Setup auto-renewal
    systemctl enable certbot.timer
    systemctl start certbot.timer

    echo "✓ SSL certificate configured"
else
    echo "⚠ SSL certificate setup skipped"
    echo "Run later with: certbot certonly --nginx -d monitoreo.victalejo.dev"
fi

# Configure firewall
echo ""
echo "Configuring firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp   # SSH
    ufw allow 80/tcp   # HTTP
    ufw allow 443/tcp  # HTTPS
    echo "✓ Firewall configured"
else
    echo "⚠ UFW not installed, skipping firewall configuration"
fi

# Setup log rotation
echo "Setting up log rotation..."
cat > /etc/logrotate.d/monitor << 'EOF'
/var/log/nginx/monitor_*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 `cat /var/run/nginx.pid`
    endscript
}

/opt/monitor-app/backups/backup_*.sql {
    weekly
    rotate 4
    compress
    missingok
    notifempty
}
EOF

echo "✓ Log rotation configured"

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   ✅ Server Setup Complete!                              ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "1. Configure GitHub Actions secrets"
echo "2. Push code to GitHub repository"
echo "3. GitHub Actions will automatically deploy"
echo ""
echo "Manual deployment:"
echo "  cd /opt/monitor-app/backend"
echo "  docker-compose -f docker-compose.prod.yml up -d"
echo ""
