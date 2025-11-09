# 🎉 Deployment Exitoso - Monitor Backend

## ✅ Estado Actual

**Backend desplegado y funcionando correctamente en:**
- **URL**: https://monitoreo.victalejo.dev
- **Health Check**: https://monitoreo.victalejo.dev/health
- **Estado**: ✅ Online y operativo

---

## 🧪 Tests Realizados

### 1. Health Check
```bash
curl https://monitoreo.victalejo.dev/health
```
**Respuesta:**
```json
{
    "status": "ok",
    "timestamp": "2025-11-09T22:35:40.490Z",
    "uptime": 6311.080970851
}
```

### 2. Login de Admin
```bash
curl -X POST https://monitoreo.victalejo.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```
**Respuesta:**
```json
{
    "success": true,
    "user": {
        "id": 1,
        "username": "admin",
        "email": "admin@monitor.local"
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
}
```

---

## 🔑 Credenciales

### Base de Datos
- **Host**: monitor-postgres (interno Docker)
- **Database**: monitor_db
- **User**: monitor_user
- **Password**: `92759d326f89e9de17e733255de30152`

### JWT
- **Secret**: `e59b2e33131b6dde86545a339d13709eb8eb911ba6d6876f69afd15c526b3f51`

### Admin Inicial
- **Username**: admin
- **Password**: admin123 ⚠️ **CAMBIAR INMEDIATAMENTE**

---

## 🛠️ Infraestructura

### Servidor
- **IP**: 147.93.184.62
- **Dominio**: monitoreo.victalejo.dev
- **SSL**: Let's Encrypt (válido hasta 2026-02-07)

### Contenedores Docker
1. **monitor-postgres** (TimescaleDB 15)
2. **monitor-redis** (Redis 7)
3. **monitor-backend** (Node.js 18)

### Redes Docker
- **monitor-internal**: Red interna para DB/Redis
- **nginx-proxy**: Red externa para Nginx

### Puerto Expuesto
- **3000**: Backend (solo en localhost:3000, no público)

---

## 📋 Problemas Resueltos Durante el Deployment

### 1. Database Connection Timeout
**Problema**: Timeout de 2 segundos demasiado corto
**Solución**: Aumentado a 10 segundos + eliminado `process.exit()` en errores

### 2. Backend Healthcheck
**Problema**: Healthcheck con Node.js fallaba
**Solución**: Instalado `wget` y cambio a healthcheck HTTP simple

### 3. Deploy Script Wait Time
**Problema**: Solo 10 segundos de espera, insuficiente
**Solución**: Bucle de hasta 120 segundos verificando estado de contenedores

### 4. Nginx → Backend Connection
**Problema**: Nginx en host no podía conectar a `monitor-backend:3000`
**Solución**: Port mapping `127.0.0.1:3000:3000` + upstream a `127.0.0.1:3000`

### 5. SSL Certificate Missing
**Problema**: Certificado SSL no existía
**Solución**: Generado con `certbot --standalone` para monitoreo.victalejo.dev

---

## 🚀 Próximos Pasos

### 1. Seguridad (URGENTE)
```bash
# Cambiar contraseña de admin
curl -X POST https://monitoreo.victalejo.dev/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TU_TOKEN>" \
  -d '{
    "currentPassword": "admin123",
    "newPassword": "TuNuevaContraseñaSegura123!"
  }'
```

### 2. Crear Primera Empresa
```bash
curl -X POST https://monitoreo.victalejo.dev/api/companies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TU_TOKEN>" \
  -d '{
    "name": "Mi Empresa",
    "description": "Primera empresa de prueba"
  }'
```

### 3. Agregar Servidores
```bash
curl -X POST https://monitoreo.victalejo.dev/api/servers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TU_TOKEN>" \
  -d '{
    "companyId": 1,
    "name": "VPS Producción",
    "description": "Servidor principal",
    "hostname": "147.93.184.62"
  }'
```

### 4. Instalar Agente en Servidores

El agente no está deployado aún. Para cada servidor a monitorear:

1. Copiar carpeta `agent/` al servidor
2. Configurar `.env` con API_URL y API_KEY
3. Ejecutar `npm install && npm start`

### 5. Desarrollar Aplicación Móvil

El frontend móvil (React Native) no se ha desarrollado aún.

**Tareas pendientes:**
- Crear app React Native
- Pantallas: Login, Dashboard, Lista de empresas/servidores
- Gráficos de métricas en tiempo real
- Notificaciones push con Firebase
- Autenticación con JWT + biometría

---

## 📊 Endpoints Disponibles

### Autenticación
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Renovar token
- `GET /api/auth/me` - Usuario actual
- `POST /api/auth/change-password` - Cambiar contraseña

### Empresas
- `GET /api/companies` - Listar empresas
- `POST /api/companies` - Crear empresa
- `GET /api/companies/:id` - Ver empresa
- `PUT /api/companies/:id` - Actualizar empresa
- `DELETE /api/companies/:id` - Eliminar empresa

### Servidores
- `GET /api/servers` - Listar servidores
- `POST /api/servers` - Crear servidor
- `GET /api/servers/:id` - Ver servidor
- `PUT /api/servers/:id` - Actualizar servidor
- `DELETE /api/servers/:id` - Eliminar servidor
- `GET /api/servers/:id/metrics` - Métricas del servidor

### Agent (para agentes de monitoreo)
- `POST /api/agent/metrics` - Reportar métricas
- `POST /api/agent/heartbeat` - Heartbeat
- `POST /api/agent/services` - Estado de servicios
- `POST /api/agent/logs` - Logs del servidor

### WebSocket
- `ws://monitoreo.victalejo.dev/ws` - Conexión WebSocket para datos en tiempo real

---

## 🔧 Mantenimiento

### Ver Logs de Contenedores
```bash
ssh root@147.93.184.62

# Backend
docker logs monitor-backend --tail 100 -f

# PostgreSQL
docker logs monitor-postgres --tail 50

# Redis
docker logs monitor-redis --tail 50
```

### Reiniciar Servicios
```bash
ssh root@147.93.184.62
cd /opt/monitor-app/backend
docker-compose -f docker-compose.prod.yml restart
```

### Ver Estado de Contenedores
```bash
ssh root@147.93.184.62
docker ps | grep monitor
```

### Backups Automáticos
Los backups se crean automáticamente en cada deployment en:
`/opt/monitor-app/backups/backup_YYYYMMDD_HHMMSS.sql`

Se mantienen los últimos 7 backups.

---

## 📞 GitHub Actions

**Repositorio**: https://github.com/victalejo/monitor-app
**Actions**: https://github.com/victalejo/monitor-app/actions

Cada push a `main` que modifique archivos en `backend/**` dispara un deployment automático.

---

## ✅ Checklist de Verificación

- [x] Backend desplegado y accesible
- [x] Base de datos PostgreSQL + TimescaleDB funcionando
- [x] Redis funcionando
- [x] SSL certificado válido
- [x] Health check OK
- [x] Login funcionando
- [x] GitHub Actions configurado
- [x] Nginx proxy configurado
- [x] Backups automáticos configurados
- [ ] **⚠️ PENDIENTE: Cambiar contraseña de admin**
- [ ] Instalar agentes en servidores
- [ ] Desarrollar app móvil React Native

---

**Fecha de Deployment**: 2025-11-09
**Hora**: 23:35 UTC
**Duración Total del Setup**: ~4 horas
**Número de Intentos de Deployment**: 6
**Estado Final**: ✅ EXITOSO
