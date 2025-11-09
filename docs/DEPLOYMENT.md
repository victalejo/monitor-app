# Guía de Deployment

Esta guía detalla el proceso de deployment del backend a producción usando GitHub Actions.

## Servidor de Producción

- **IP**: 147.93.184.62
- **Usuario**: root
- **Dominio**: monitoreo.victalejo.dev
- **Proxy**: Nginx (puertos 80/443 ya en uso)
- **Backend**: Puerto interno 3000 (red Docker)

## Prerequisitos

1. Servidor Linux (Ubuntu/Debian) con acceso root
2. Cuenta de GitHub con repositorio
3. Dominio configurado apuntando al servidor

## Paso 1: Configuración Inicial del Servidor

### 1.1 Conectarse al servidor

```bash
ssh root@147.93.184.62
```

### 1.2 Descargar y ejecutar script de setup

```bash
# Crear directorio temporal
mkdir -p /tmp/monitor-setup
cd /tmp/monitor-setup

# Descargar el script de setup
# (o copiar manualmente el archivo server-setup.sh)

# Dar permisos de ejecución
chmod +x server-setup.sh

# Ejecutar
./server-setup.sh
```

Este script instalará:
- Docker y Docker Compose
- Nginx (si no está instalado)
- Certbot para SSL
- Creará directorios necesarios
- Configurará la red Docker
- Configurará el certificado SSL

### 1.3 Verificar instalación

```bash
docker --version
docker-compose --version
nginx -v
certbot --version
```

## Paso 2: Configurar GitHub Repository

### 2.1 Crear repositorio en GitHub

```bash
# En tu máquina local, en el directorio del proyecto
cd /path/to/monitor-app

# Inicializar git si no está inicializado
git init
git add .
git commit -m "Initial commit - Monitor App"

# Crear repositorio en GitHub y agregar remote
git remote add origin https://github.com/TU_USUARIO/monitor-app.git
git branch -M main
git push -u origin main
```

### 2.2 Configurar GitHub Secrets

Ve a tu repositorio en GitHub:
`Settings` → `Secrets and variables` → `Actions` → `New repository secret`

Configura los siguientes secretos:

| Secret Name | Descripción | Valor |
|-------------|-------------|-------|
| `SSH_PRIVATE_KEY` | Clave SSH privada para acceder al servidor | (ver instrucciones abajo) |
| `SERVER_IP` | IP del servidor | `147.93.184.62` |
| `DB_NAME` | Nombre de la base de datos | `monitor_db` |
| `DB_USER` | Usuario de PostgreSQL | `monitor_user` |
| `DB_PASSWORD` | Contraseña de PostgreSQL | (contraseña segura) |
| `JWT_SECRET` | Secret para JWT | (string aleatorio de 32+ caracteres) |
| `CORS_ORIGIN` | Origen permitido para CORS | `https://monitoreo.victalejo.dev` |

#### Generar y configurar SSH Key

En tu máquina local:

```bash
# Generar nueva clave SSH para GitHub Actions
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/monitor_deploy

# Mostrar la clave pública
cat ~/.ssh/monitor_deploy.pub
```

En el servidor:

```bash
# Agregar la clave pública a authorized_keys
echo "PEGA_AQUI_LA_CLAVE_PUBLICA" >> ~/.ssh/authorized_keys
```

En GitHub Secrets:

```bash
# Copiar la clave PRIVADA al clipboard
cat ~/.ssh/monitor_deploy

# Pegar todo el contenido (incluyendo -----BEGIN y -----END) en el secret SSH_PRIVATE_KEY
```

#### Generar JWT Secret

```bash
# Generar un string aleatorio seguro
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Usa el output como valor para `JWT_SECRET`.

## Paso 3: Configurar Nginx en el Servidor

El archivo de configuración ya fue copiado por el script de setup, pero necesitas activarlo.

### 3.1 Verificar configuración de Nginx

```bash
# En el servidor
cat /etc/nginx/sites-available/monitor
```

Si no existe, créalo manualmente:

```bash
# Copiar desde el proyecto
cp /opt/monitor-app/backend/nginx/monitor.conf /etc/nginx/sites-available/monitor
```

### 3.2 Activar sitio

```bash
# Crear symlink
ln -sf /etc/nginx/sites-available/monitor /etc/nginx/sites-enabled/monitor

# Verificar configuración
nginx -t

# Si hay errores de SSL (primera vez), es normal
# El certificado SSL se configurará después del primer deployment
```

### 3.3 Configurar SSL (si no se hizo en server-setup.sh)

```bash
# Obtener certificado SSL
certbot certonly --nginx -d monitoreo.victalejo.dev

# Recargar Nginx
systemctl reload nginx
```

## Paso 4: Primer Deployment

### 4.1 Deployment automático (GitHub Actions)

Simplemente haz push a la rama `main`:

```bash
git add .
git commit -m "Deploy to production"
git push origin main
```

GitHub Actions se encargará de:
1. ✅ Copiar archivos al servidor
2. ✅ Crear archivo .env con los secrets
3. ✅ Ejecutar script de deployment
4. ✅ Hacer backup de la base de datos
5. ✅ Construir y levantar contenedores Docker
6. ✅ Verificar salud del servicio

### 4.2 Verificar deployment

```bash
# En el servidor, ver logs de deployment
ssh root@147.93.184.62 "docker-compose -f /opt/monitor-app/backend/docker-compose.prod.yml logs -f"

# Verificar contenedores corriendo
ssh root@147.93.184.62 "docker ps | grep monitor"

# Verificar health del backend
curl https://monitoreo.victalejo.dev/health
```

Deberías ver:
```json
{
  "status": "ok",
  "timestamp": "...",
  "uptime": ...
}
```

### 4.3 Deployment manual (opcional)

Si necesitas hacer deployment manual:

```bash
# En el servidor
cd /opt/monitor-app/backend
./deploy.sh
```

## Paso 5: Verificación Post-Deployment

### 5.1 Probar la API

```bash
# Health check
curl https://monitoreo.victalejo.dev/health

# Login
curl -X POST https://monitoreo.victalejo.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Debería retornar un token JWT
```

### 5.2 Cambiar contraseña de admin

```bash
# Usar el token del login anterior
curl -X POST https://monitoreo.victalejo.dev/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_JWT" \
  -d '{
    "currentPassword": "admin123",
    "newPassword": "tu-nueva-contraseña-segura"
  }'
```

### 5.3 Verificar WebSocket

```bash
# Desde tu navegador (ver docs/QUICKSTART.md para código completo)
const ws = new WebSocket('wss://monitoreo.victalejo.dev?token=TU_TOKEN_JWT');
```

## Arquitectura de Deployment

```
Internet (HTTPS/WSS)
        ↓
Nginx (147.93.184.62:443)
        ↓ proxy_pass
[Docker Network: nginx-proxy]
        ↓
monitor-backend:3000
        ↓
[Docker Network: monitor-internal]
    ↓                    ↓
postgres:5432      redis:6379
```

## Comandos Útiles

### Ver logs

```bash
# Logs del backend
ssh root@147.93.184.62 "docker logs monitor-backend -f"

# Logs de PostgreSQL
ssh root@147.93.184.62 "docker logs monitor-postgres -f"

# Logs de Nginx
ssh root@147.93.184.62 "tail -f /var/log/nginx/monitor_access.log"
ssh root@147.93.184.62 "tail -f /var/log/nginx/monitor_error.log"
```

### Gestión de contenedores

```bash
# Ver estado
ssh root@147.93.184.62 "cd /opt/monitor-app/backend && docker-compose -f docker-compose.prod.yml ps"

# Reiniciar servicio
ssh root@147.93.184.62 "cd /opt/monitor-app/backend && docker-compose -f docker-compose.prod.yml restart backend"

# Detener todo
ssh root@147.93.184.62 "cd /opt/monitor-app/backend && docker-compose -f docker-compose.prod.yml down"

# Iniciar
ssh root@147.93.184.62 "cd /opt/monitor-app/backend && docker-compose -f docker-compose.prod.yml up -d"
```

### Base de datos

```bash
# Conectarse a PostgreSQL
ssh root@147.93.184.62 "docker exec -it monitor-postgres psql -U monitor_user -d monitor_db"

# Backup manual
ssh root@147.93.184.62 "docker exec monitor-postgres pg_dump -U monitor_user monitor_db > /opt/monitor-app/backups/manual_backup_$(date +%Y%m%d_%H%M%S).sql"

# Restore
ssh root@147.93.184.62 "docker exec -i monitor-postgres psql -U monitor_user monitor_db < /opt/monitor-app/backups/backup_TIMESTAMP.sql"
```

### Nginx

```bash
# Recargar configuración
ssh root@147.93.184.62 "nginx -t && systemctl reload nginx"

# Reiniciar
ssh root@147.93.184.62 "systemctl restart nginx"

# Ver estado
ssh root@147.93.184.62 "systemctl status nginx"
```

### SSL

```bash
# Renovar certificado manualmente
ssh root@147.93.184.62 "certbot renew"

# Ver certificados
ssh root@147.93.184.62 "certbot certificates"
```

## Troubleshooting

### Error: "Cannot connect to Docker daemon"

```bash
ssh root@147.93.184.62 "systemctl start docker"
```

### Error: "Network nginx-proxy not found"

```bash
ssh root@147.93.184.62 "docker network create nginx-proxy"
```

### Error: "SSL certificate not found"

```bash
# Configurar SSL primero
ssh root@147.93.184.62 "certbot certonly --nginx -d monitoreo.victalejo.dev"
```

### Backend no responde

```bash
# Ver logs
ssh root@147.93.184.62 "docker logs monitor-backend --tail 100"

# Verificar si el contenedor está corriendo
ssh root@147.93.184.62 "docker ps | grep monitor-backend"

# Reiniciar
ssh root@147.93.184.62 "cd /opt/monitor-app/backend && docker-compose -f docker-compose.prod.yml restart backend"
```

### Error de base de datos

```bash
# Ver logs de PostgreSQL
ssh root@147.93.184.62 "docker logs monitor-postgres --tail 100"

# Verificar conexión
ssh root@147.93.184.62 "docker exec monitor-postgres pg_isready -U monitor_user"
```

## Rollback

Si algo sale mal, puedes hacer rollback:

```bash
# Revertir a commit anterior en GitHub
git revert HEAD
git push origin main

# O restaurar desde backup
ssh root@147.93.184.62 "
  cd /opt/monitor-app/backend
  docker-compose -f docker-compose.prod.yml down
  docker exec -i monitor-postgres psql -U monitor_user monitor_db < /opt/monitor-app/backups/backup_TIMESTAMP.sql
  docker-compose -f docker-compose.prod.yml up -d
"
```

## Monitoreo

### Configurar alertas de uptime

Usa servicios como:
- UptimeRobot (https://uptimerobot.com)
- Pingdom
- StatusCake

Monitor: `https://monitoreo.victalejo.dev/health`

### Logs centralizados (opcional)

Considera configurar:
- Grafana + Loki
- ELK Stack
- Datadog

## Actualizaciones Futuras

Para deployar cambios:

1. Hacer cambios en el código
2. Commit y push a `main`
3. GitHub Actions se encarga automáticamente

```bash
git add .
git commit -m "Feature: nueva funcionalidad"
git push origin main
```

## Seguridad

- ✅ HTTPS con Let's Encrypt
- ✅ Rate limiting configurado
- ✅ Helmet headers de seguridad
- ✅ CORS configurado
- ✅ Contraseñas hasheadas con bcrypt
- ✅ JWT con expiración
- ⚠️ Firewall: Asegúrate de tener UFW o similar configurado
- ⚠️ Actualiza regularmente las dependencias

## Backup y Disaster Recovery

Los backups se crean automáticamente en cada deployment en:
`/opt/monitor-app/backups/`

Se mantienen los últimos 7 backups.

Para backup manual regular, configura un cron job:

```bash
# Agregar a crontab
crontab -e

# Backup diario a las 3 AM
0 3 * * * docker exec monitor-postgres pg_dump -U monitor_user monitor_db > /opt/monitor-app/backups/daily_backup_$(date +\%Y\%m\%d).sql
```

## Soporte

Para más información, consulta:
- [README.md](../README.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [QUICKSTART.md](QUICKSTART.md)
