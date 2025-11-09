# Instrucciones de Setup y Deployment

## 📋 Resumen

Este documento contiene las instrucciones paso a paso para deployar el Monitor App en el servidor de producción usando GitHub Actions.

**Servidor**: 147.93.184.62
**Usuario**: root
**Contraseña**: Alejo2026
**Dominio**: monitoreo.victalejo.dev

---

## Paso 1: Configurar el Servidor (Ejecutar UNA VEZ)

### 1.1 Conectarse al servidor

```bash
ssh root@147.93.184.62
# Contraseña: Alejo2026
```

### 1.2 Copiar y ejecutar script de setup

En el servidor, ejecuta:

```bash
# Crear directorio temporal
mkdir -p /tmp/monitor-setup
cd /tmp/monitor-setup

# Crear el script de setup
cat > server-setup.sh << 'SCRIPT_EOF'
#!/bin/bash

# Server Setup Script for Monitor Backend
set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   Monitor Backend - Server Setup                         ║"
echo "╚═══════════════════════════════════════════════════════════╝"

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

# Install Certbot if not installed
if ! command -v certbot &> /dev/null; then
    echo "Installing Certbot..."
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
    echo "✓ Certbot installed"
else
    echo "✓ Certbot already installed"
fi

# Create Docker network
echo "Creating Docker network..."
docker network create nginx-proxy || echo "Network already exists"

# Create project directories
echo "Creating project directories..."
mkdir -p /opt/monitor-app/backend
mkdir -p /opt/monitor-app/backups
mkdir -p /var/www/certbot

echo "✓ Setup complete!"
SCRIPT_EOF

# Dar permisos de ejecución
chmod +x server-setup.sh

# Ejecutar
./server-setup.sh
```

### 1.3 Configurar SSL para el dominio

```bash
# Obtener certificado SSL para monitoreo.victalejo.dev
certbot certonly --nginx -d monitoreo.victalejo.dev --non-interactive --agree-tos --email admin@victalejo.dev

# Habilitar auto-renovación
systemctl enable certbot.timer
systemctl start certbot.timer
```

Si certbot falla, verifica que el dominio apunte al servidor:
```bash
ping monitoreo.victalejo.dev
# Debe responder con 147.93.184.62
```

---

## Paso 2: Configurar GitHub

### 2.1 Crear repositorio en GitHub

1. Ve a https://github.com y crea un nuevo repositorio
2. Nombre: `monitor-app` (o el que prefieras)
3. **NO** inicialices con README, .gitignore o licencia (ya los tenemos)
4. Haz clic en "Create repository"

### 2.2 Conectar tu proyecto local con GitHub

En tu máquina local (Windows), abre PowerShell o Git Bash:

```bash
cd v:\monitor-app

# Cambiar nombre de rama a main
git branch -M main

# Agregar remote (reemplaza TU_USUARIO con tu usuario de GitHub)
git remote add origin https://github.com/TU_USUARIO/monitor-app.git

# IMPORTANTE: NO hagas push todavía, primero configura los secrets
```

### 2.3 Generar SSH Key para GitHub Actions

En tu máquina local:

```bash
# Generar nueva clave SSH
ssh-keygen -t ed25519 -C "github-actions-deploy" -f monitor_deploy_key

# Esto creará dos archivos:
# - monitor_deploy_key (PRIVADA - para GitHub Secrets)
# - monitor_deploy_key.pub (PÚBLICA - para el servidor)
```

### 2.4 Agregar clave pública al servidor

```bash
# Mostrar la clave pública
cat monitor_deploy_key.pub

# Copiar el output (todo el texto)
```

Ahora en el servidor:

```bash
ssh root@147.93.184.62

# Agregar la clave pública a authorized_keys
echo "PEGA_AQUI_LA_CLAVE_PUBLICA" >> ~/.ssh/authorized_keys

# Asegurar permisos correctos
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh

exit
```

### 2.5 Configurar GitHub Secrets

Ve a tu repositorio en GitHub:
`https://github.com/TU_USUARIO/monitor-app`

Luego: `Settings` → `Secrets and variables` → `Actions` → `New repository secret`

Agrega los siguientes secrets (uno por uno):

#### Secret 1: SSH_PRIVATE_KEY
```bash
# En tu máquina local, muestra la clave PRIVADA:
cat monitor_deploy_key

# Copia TODO el contenido (incluyendo las líneas -----BEGIN y -----END)
```
- Name: `SSH_PRIVATE_KEY`
- Value: (pega todo el contenido de la clave privada)

#### Secret 2: SERVER_IP
- Name: `SERVER_IP`
- Value: `147.93.184.62`

#### Secret 3: DB_NAME
- Name: `DB_NAME`
- Value: `monitor_db`

#### Secret 4: DB_USER
- Name: `DB_USER`
- Value: `monitor_user`

#### Secret 5: DB_PASSWORD
```bash
# Genera una contraseña segura
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```
- Name: `DB_PASSWORD`
- Value: (la contraseña generada)

#### Secret 6: JWT_SECRET
```bash
# Genera un secret aleatorio
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
- Name: `JWT_SECRET`
- Value: (el secret generado)

#### Secret 7: CORS_ORIGIN
- Name: `CORS_ORIGIN`
- Value: `https://monitoreo.victalejo.dev`

**IMPORTANTE**: Guarda estos valores en un lugar seguro (password manager), especialmente `DB_PASSWORD` y `JWT_SECRET`.

---

## Paso 3: Configurar Nginx en el Servidor

### 3.1 Conectarse al servidor

```bash
ssh root@147.93.184.62
```

### 3.2 Crear configuración de Nginx

```bash
# Crear archivo de configuración
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
        access_log off;
    }
}
NGINX_EOF

# Activar el sitio
ln -sf /etc/nginx/sites-available/monitor /etc/nginx/sites-enabled/monitor

# Verificar configuración
nginx -t

# Si la verificación es exitosa, recargar Nginx
systemctl reload nginx

exit
```

---

## Paso 4: Hacer el Primer Deployment

### 4.1 Push a GitHub

En tu máquina local:

```bash
cd v:\monitor-app

# Verificar que el remote está configurado
git remote -v

# Push a GitHub
git push -u origin main
```

Ingresa tu usuario y contraseña de GitHub (o token de acceso personal).

### 4.2 Verificar GitHub Actions

1. Ve a tu repositorio en GitHub
2. Clic en la pestaña "Actions"
3. Deberías ver un workflow corriendo: "Deploy to Production"
4. Haz clic en el workflow para ver el progreso

El deployment toma aproximadamente 3-5 minutos.

### 4.3 Verificar que el deployment fue exitoso

```bash
# Probar health check
curl https://monitoreo.victalejo.dev/health

# Deberías ver:
# {"status":"ok","timestamp":"...","uptime":...}

# Probar login
curl -X POST https://monitoreo.victalejo.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Deberías recibir un token JWT
```

---

## Paso 5: Configuración Post-Deployment

### 5.1 Cambiar contraseña de admin

```bash
# Primero haz login y guarda el token
TOKEN=$(curl -s -X POST https://monitoreo.victalejo.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | \
  grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

# Cambiar contraseña
curl -X POST https://monitoreo.victalejo.dev/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "currentPassword": "admin123",
    "newPassword": "TU_NUEVA_CONTRASEÑA_SEGURA"
  }'
```

### 5.2 Crear tu primera empresa

```bash
curl -X POST https://monitoreo.victalejo.dev/api/companies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Mi Primera Empresa",
    "description": "Descripción de la empresa"
  }'
```

---

## Paso 6: Instalar Agente en un Servidor VPS

En el servidor que quieres monitorear:

```bash
# Descargar agente
git clone https://github.com/TU_USUARIO/monitor-app.git /tmp/monitor-agent
cd /tmp/monitor-agent/agent

# Ejecutar instalación
chmod +x install.sh
sudo ./install.sh

# Cuando te pida:
# - Backend URL: https://monitoreo.victalejo.dev
# - API Key: (obtenerlo del paso anterior al crear un servidor)
```

---

## ✅ Checklist de Verificación

- [ ] Servidor configurado con Docker y Docker Compose
- [ ] Certificado SSL configurado
- [ ] Repositorio GitHub creado
- [ ] SSH Key configurada en el servidor
- [ ] 7 GitHub Secrets configurados
- [ ] Nginx configurado y funcionando
- [ ] Primer deployment exitoso
- [ ] Health check responde correctamente
- [ ] Login funciona
- [ ] Contraseña de admin cambiada
- [ ] Primera empresa creada

---

## 🔧 Comandos Útiles

### Ver logs en el servidor

```bash
ssh root@147.93.184.62

# Logs del backend
docker logs monitor-backend -f

# Logs de PostgreSQL
docker logs monitor-postgres -f

# Logs de Nginx
tail -f /var/log/nginx/monitor_error.log
```

### Reiniciar servicios

```bash
ssh root@147.93.184.62

# Reiniciar backend
cd /opt/monitor-app/backend
docker-compose -f docker-compose.prod.yml restart backend

# Reiniciar todo
docker-compose -f docker-compose.prod.yml restart
```

### Ver estado

```bash
ssh root@147.93.184.62

# Estado de contenedores
cd /opt/monitor-app/backend
docker-compose -f docker-compose.prod.yml ps

# Health check interno
curl http://localhost:3000/health
```

---

## 🚨 Troubleshooting

### Error: "Permission denied (publickey)"

Verifica que la clave SSH esté correctamente agregada al servidor:
```bash
ssh root@147.93.184.62 "cat ~/.ssh/authorized_keys"
```

### Error: "Network nginx-proxy not found"

```bash
ssh root@147.93.184.62 "docker network create nginx-proxy"
```

### Error: SSL certificate not found

```bash
ssh root@147.93.184.62
certbot certonly --nginx -d monitoreo.victalejo.dev
systemctl reload nginx
```

### Backend no responde

```bash
ssh root@147.93.184.62
cd /opt/monitor-app/backend
docker-compose -f docker-compose.prod.yml logs backend
```

---

## 📚 Próximos Pasos

1. ✅ Lee la documentación completa en [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
2. ✅ Configura backups automáticos
3. ✅ Instala agentes en tus servidores VPS
4. ✅ Configura alertas
5. ✅ Desarrolla la app móvil (siguiente fase)

---

## 🆘 Soporte

Si tienes problemas, consulta:
- [README.md](README.md) - Documentación general
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) - Guía detallada de deployment
- [docs/QUICKSTART.md](docs/QUICKSTART.md) - Tutorial de uso

---

**¡Listo! Tu sistema de monitoreo está deployado y funcionando! 🎉**
