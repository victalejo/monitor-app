# 🚀 DEPLOY AHORA - 3 Comandos Simples

## Situación Actual

✅ Repositorio creado: https://github.com/victalejo/monitor-app
✅ GitHub Secrets configurados
✅ GitHub Actions listo
✅ Código subido

## Lo Único que Falta: Configurar el Servidor

Ejecuta estos 3 comandos UNO POR UNO:

---

## Comando 1: Conectarse y Ejecutar Setup

**Copia y pega esto** (te pedirá contraseña: `Alejo2026`):

```bash
ssh root@147.93.184.62 "bash -s" << 'ENDSSH'
# Setup completo del servidor
echo "=== Agregando clave SSH ==="
mkdir -p ~/.ssh
echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINz1ccuEJIXBDaso5ov+7aTJDuOyERvf+oHYXeJblLzA github-actions-deploy' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh

echo "=== Instalando Docker ==="
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker

echo "=== Instalando Docker Compose ==="
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

echo "=== Instalando Certbot ==="
apt-get update && apt-get install -y certbot python3-certbot-nginx

echo "=== Creando estructura ==="
mkdir -p /opt/monitor-app/backend /opt/monitor-app/backups /var/www/certbot
docker network create nginx-proxy || true

echo "=== Configurando SSL ==="
certbot certonly --nginx -d monitoreo.victalejo.dev --non-interactive --agree-tos --email admin@victalejo.dev || true

echo "=== SETUP COMPLETADO ==="
ENDSSH
```

⏱️ **Espera**: Este comando toma 2-3 minutos. Verás mucho output.

---

## Comando 2: Configurar Nginx

**Copia y pega esto** (te pedirá contraseña nuevamente):

```bash
ssh root@147.93.184.62 "bash -s" << 'ENDSSH2'
cat > /etc/nginx/sites-available/monitor << 'NGINXCONF'
upstream monitor_backend {
    server monitor-backend:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name monitoreo.victalejo.dev;
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name monitoreo.victalejo.dev;
    ssl_certificate /etc/letsencrypt/live/monitoreo.victalejo.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/monitoreo.victalejo.dev/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://monitor_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /health {
        proxy_pass http://monitor_backend/health;
        access_log off;
    }
}
NGINXCONF

ln -sf /etc/nginx/sites-available/monitor /etc/nginx/sites-enabled/monitor
nginx -t && systemctl reload nginx || true
echo "=== NGINX CONFIGURADO ==="
ENDSSH2
```

---

## Comando 3: Trigger Deployment

**Copia y pega esto** (en tu máquina local):

```bash
cd v:\monitor-app && echo "# Deployed $(date)" >> README.md && git add README.md && git commit -m "Trigger deployment" && git push origin main
```

**¡LISTO!** Esto activará GitHub Actions.

---

## Ver el Deployment

1. Ve a: **https://github.com/victalejo/monitor-app/actions**
2. Verás un workflow corriendo
3. Espera 3-5 minutos hasta que todos los checks estén en ✅

---

## Verificar que Funciona

Después de que GitHub Actions termine:

```bash
curl https://monitoreo.victalejo.dev/health
```

Deberías ver:
```json
{"status":"ok","timestamp":"...","uptime":...}
```

---

## Login de Prueba

```bash
curl -X POST https://monitoreo.victalejo.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Deberías recibir un token JWT.

---

## ¿Problemas?

### Si el Comando 1 falla:
- Verifica que puedas conectarte: `ssh root@147.93.184.62` (contraseña: Alejo2026)
- Verifica que el dominio apunte al servidor: `ping monitoreo.victalejo.dev`

### Si GitHub Actions falla:
- Ve los logs en: https://github.com/victalejo/monitor-app/actions
- Verifica que la clave SSH esté en el servidor:
  ```bash
  ssh root@147.93.184.62 "cat ~/.ssh/authorized_keys | grep github-actions"
  ```

### Si el backend no responde después del deployment:
```bash
ssh root@147.93.184.62 "docker logs monitor-backend"
```

---

## 🎉 ¡Eso es Todo!

Solo 3 comandos y tendrás tu sistema de monitoreo deployado y funcionando.

**Credenciales importantes** (guárdalas):
- DB Password: `92759d326f89e9de17e733255de30152`
- JWT Secret: `e59b2e33131b6dde86545a339d13709eb8eb911ba6d6876f69afd15c526b3f51`
- Admin inicial: `admin` / `admin123` (cambiar después del login)

---

**URLs:**
- API: https://monitoreo.victalejo.dev
- GitHub: https://github.com/victalejo/monitor-app
- Actions: https://github.com/victalejo/monitor-app/actions
