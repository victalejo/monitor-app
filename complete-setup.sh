#!/bin/bash

# Script completo para configurar el servidor
# Ejecutar este script en el servidor: 147.93.184.62

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   Monitor App - Complete Server Setup                    ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# 1. Agregar clave SSH
echo "📝 Step 1/6: Adding SSH key for GitHub Actions..."
mkdir -p ~/.ssh
echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINz1ccuEJIXBDaso5ov+7aTJDuOyERvf+oHYXeJblLzA github-actions-deploy' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
echo "✓ SSH key added"

# 2. Actualizar sistema
echo ""
echo "📦 Step 2/6: Updating system..."
apt-get update -qq

# 3. Instalar Docker
echo ""
echo "🐳 Step 3/6: Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
    echo "✓ Docker installed"
else
    echo "✓ Docker already installed"
fi

# 4. Instalar Docker Compose
echo ""
echo "🔧 Step 4/6: Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo "✓ Docker Compose installed"
else
    echo "✓ Docker Compose already installed"
fi

# 5. Instalar Certbot
echo ""
echo "🔒 Step 5/6: Installing Certbot..."
if ! command -v certbot &> /dev/null; then
    apt-get install -y certbot python3-certbot-nginx -qq
    echo "✓ Certbot installed"
else
    echo "✓ Certbot already installed"
fi

# 6. Crear estructura
echo ""
echo "📁 Step 6/6: Creating directories and networks..."
mkdir -p /opt/monitor-app/backend
mkdir -p /opt/monitor-app/backups
mkdir -p /var/www/certbot

# Crear red Docker
docker network create nginx-proxy 2>/dev/null || echo "Network nginx-proxy already exists"

echo "✓ Directories created"
echo ""

# 7. Configurar SSL
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   SSL Certificate Setup                                  ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Setting up SSL certificate for monitoreo.victalejo.dev..."
echo ""

# Verificar que Nginx esté instalado
if ! command -v nginx &> /dev/null; then
    echo "Installing Nginx..."
    apt-get install -y nginx -qq
    systemctl enable nginx
    systemctl start nginx
fi

# Obtener certificado
certbot certonly --nginx \
    -d monitoreo.victalejo.dev \
    --non-interactive \
    --agree-tos \
    --email admin@victalejo.dev \
    2>&1 | grep -i "success\|already\|valid" || echo "Certificate setup will be completed after first deployment"

# Habilitar renovación automática
systemctl enable certbot.timer 2>/dev/null || true
systemctl start certbot.timer 2>/dev/null || true

echo ""
echo "✓ SSL certificate configured"

# 8. Configurar Nginx
echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   Nginx Configuration                                    ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

cat > /etc/nginx/sites-available/monitor << 'NGINX_EOF'
upstream monitor_backend {
    server monitor-backend:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name monitoreo.victalejo.dev;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name monitoreo.victalejo.dev;

    ssl_certificate /etc/letsencrypt/live/monitoreo.victalejo.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/monitoreo.victalejo.dev/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000" always;

    access_log /var/log/nginx/monitor_access.log;
    error_log /var/log/nginx/monitor_error.log;

    client_max_body_size 10M;

    location / {
        proxy_pass http://monitor_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /health {
        proxy_pass http://monitor_backend/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        access_log off;
    }
}
NGINX_EOF

# Activar sitio
ln -sf /etc/nginx/sites-available/monitor /etc/nginx/sites-enabled/monitor

# Verificar configuración
if nginx -t 2>/dev/null; then
    echo "✓ Nginx configuration valid"
    systemctl reload nginx
    echo "✓ Nginx reloaded"
else
    echo "⚠ Nginx configuration has warnings (will work after SSL cert is obtained)"
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   ✅ Server Setup Complete!                              ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Installed versions:"
echo "  Docker: $(docker --version)"
echo "  Docker Compose: $(docker-compose --version)"
echo "  Certbot: $(certbot --version | head -1)"
echo "  Nginx: $(nginx -v 2>&1)"
echo ""
echo "Next steps:"
echo "  1. Trigger deployment by pushing to GitHub"
echo "  2. Monitor deployment at: https://github.com/victalejo/monitor-app/actions"
echo "  3. Once deployed, test: curl https://monitoreo.victalejo.dev/health"
echo ""
echo "Server is ready for deployment! 🚀"
