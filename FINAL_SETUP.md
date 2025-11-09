# 🎉 Configuración Completada - Pasos Finales

## ✅ Lo que ya está hecho

1. ✅ Repositorio creado: **https://github.com/victalejo/monitor-app**
2. ✅ Código subido al repositorio
3. ✅ GitHub Secrets configurados
4. ✅ Clave SSH generada

## 🔑 Paso Final: Agregar Clave SSH al Servidor

Solo necesitas ejecutar este comando para agregar la clave SSH al servidor:

```bash
ssh root@147.93.184.62 "echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINz1ccuEJIXBDaso5ov+7aTJDuOyERvf+oHYXeJblLzA github-actions-deploy' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && chmod 700 ~/.ssh && echo 'SSH key added successfully'"
```

**Contraseña**: `Alejo2026`

Cuando el comando termine, verás: `SSH key added successfully`

## 🚀 Configurar el Servidor

Ahora ejecuta el script de setup en el servidor:

```bash
ssh root@147.93.184.62
# Contraseña: Alejo2026

# Una vez conectado, ejecuta:
curl -sSL https://raw.githubusercontent.com/victalejo/monitor-app/main/backend/server-setup.sh | bash
```

Este script instalará:
- Docker y Docker Compose
- Certbot (para SSL)
- Creará las redes Docker necesarias
- Configurará el certificado SSL para monitoreo.victalejo.dev

## 📝 Configurar Nginx

Después del setup del servidor, configura Nginx:

```bash
# Aún conectado al servidor...

# Copiar configuración de Nginx
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

# Recargar Nginx
systemctl reload nginx

# Salir del servidor
exit
```

## 🎯 Hacer el Primer Deployment

GitHub Actions ya está configurado para deployment automático. Ahora solo necesitas hacer un pequeño cambio para activar el primer deployment:

```bash
cd v:\monitor-app

# Crear un archivo pequeño para activar el deployment
echo "# Monitor App Deployed" >> README.md

# Commit y push
git add README.md
git commit -m "Trigger first deployment"
git push origin main
```

Esto activará GitHub Actions automáticamente. Ve a:
**https://github.com/victalejo/monitor-app/actions**

El deployment tomará 3-5 minutos.

## ✅ Verificar Deployment

Una vez que GitHub Actions termine (todos los checks en verde ✅):

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

## 🔐 Cambiar Contraseña de Admin

**IMPORTANTE**: Cambia la contraseña de admin inmediatamente:

```bash
# Primero haz login
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
    "newPassword": "TuNuevaContraseñaSegura123!"
  }'
```

## 📊 Credenciales y Valores Generados

Guarda estos valores en un lugar seguro (password manager):

### Base de Datos
- **Usuario**: `monitor_user`
- **Contraseña**: `92759d326f89e9de17e733255de30152`
- **Base de datos**: `monitor_db`

### JWT
- **Secret**: `e59b2e33131b6dde86545a339d13709eb8eb911ba6d6876f69afd15c526b3f51`

### Admin Backend
- **Username**: `admin`
- **Password inicial**: `admin123` (CAMBIAR INMEDIATAMENTE)

## 🎉 ¡Listo!

Tu sistema de monitoreo está deployado en:
- **API**: https://monitoreo.victalejo.dev
- **Repositorio**: https://github.com/victalejo/monitor-app
- **GitHub Actions**: https://github.com/victalejo/monitor-app/actions

## 📚 Próximos Pasos

1. **Crear empresa y servidor** usando la API
2. **Instalar agente** en tus servidores VPS
3. **Ver métricas** en tiempo real

Ver [QUICKSTART.md](docs/QUICKSTART.md) para tutoriales completos.

## 🆘 Troubleshooting

### Si GitHub Actions falla:

1. Verifica que la clave SSH esté en el servidor:
```bash
ssh root@147.93.184.62 "cat ~/.ssh/authorized_keys | grep github-actions-deploy"
```

2. Verifica que los secrets estén configurados:
```bash
gh secret list
```

3. Ve los logs del deployment:
```bash
ssh root@147.93.184.62 "docker logs monitor-backend -f"
```

### Si el backend no responde:

```bash
# Verificar que los contenedores estén corriendo
ssh root@147.93.184.62 "docker ps | grep monitor"

# Ver logs
ssh root@147.93.184.62 "cd /opt/monitor-app/backend && docker-compose -f docker-compose.prod.yml logs -f"
```

## 🎊 ¡Todo Configurado!

El repositorio está creado, los secrets configurados, y el código está en GitHub.

Solo ejecuta los 3 comandos de arriba (SSH key + Setup servidor + Nginx) y estarás listo para el primer deployment! 🚀
