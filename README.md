# Monitor App - Multi-Company Server Monitoring System

Sistema completo de monitoreo de servidores para múltiples empresas, con aplicación móvil Android, backend API y agente de monitoreo.

## Arquitectura

El proyecto está dividido en tres componentes principales:

- **Backend API**: Node.js + Express + WebSocket
- **Mobile App**: React Native (Android)
- **Agent**: Agente de monitoreo instalado en servidores VPS

## Características

### Backend
- API RESTful con autenticación JWT
- WebSocket para datos en tiempo real
- Base de datos PostgreSQL con TimescaleDB para series temporales
- Redis para caché y pub/sub
- Soporte multi-empresa (multi-tenant)
- Sistema de alertas configurables
- Historial de incidentes
- Retención de datos de 1 año

### Monitoreo
- Métricas del sistema (CPU, RAM, disco, red)
- Estado de contenedores Docker
- Monitoreo de servicios (HTTP/HTTPS, bases de datos)
- Logs en tiempo real
- Tiempos de respuesta

### App Móvil
- Dashboard por empresa
- Vista de servidores en tiempo real
- Gráficos históricos
- Notificaciones push (alertas)
- Autenticación con huella digital
- Historial de incidentes

## Estructura del Proyecto

```
monitor-app/
├── backend/           # API Node.js
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── services/
│   │   ├── websocket/
│   │   └── index.js
│   ├── docker-compose.yml
│   ├── init-db.sql
│   └── package.json
├── mobile/            # App React Native
├── agent/             # Agente de monitoreo
└── docs/              # Documentación
```

## Instalación y Configuración

### Requisitos Previos

- Node.js 18+
- Docker y Docker Compose
- PostgreSQL 15+ (opcional si usas Docker)
- Redis (opcional si usas Docker)

### Backend

1. Navegar al directorio del backend:
```bash
cd backend
```

2. Copiar el archivo de configuración:
```bash
cp .env.example .env
```

3. Editar el archivo `.env` con tus configuraciones

4. Iniciar los servicios de base de datos con Docker:
```bash
docker-compose up -d
```

5. Instalar dependencias (ya instaladas):
```bash
npm install
```

6. Iniciar el servidor en modo desarrollo:
```bash
npm run dev
```

7. El servidor estará disponible en:
   - HTTP: `http://localhost:3000`
   - WebSocket: `ws://localhost:3000`

### Crear Usuario Admin

El usuario por defecto es:
- Username: `admin`
- Password: `admin123`

**IMPORTANTE**: Cambia la contraseña después del primer login usando el endpoint `/api/auth/change-password`

### Endpoints de la API

#### Autenticación
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Renovar token
- `GET /api/auth/me` - Obtener usuario actual
- `POST /api/auth/change-password` - Cambiar contraseña

#### Empresas
- `GET /api/companies` - Listar empresas
- `GET /api/companies/:id` - Obtener empresa
- `POST /api/companies` - Crear empresa
- `PUT /api/companies/:id` - Actualizar empresa
- `DELETE /api/companies/:id` - Eliminar empresa

#### Servidores
- `GET /api/servers` - Listar servidores (filtro por companyId opcional)
- `GET /api/servers/:id` - Obtener servidor
- `GET /api/servers/:id/metrics` - Obtener métricas
- `POST /api/servers` - Crear servidor
- `PUT /api/servers/:id` - Actualizar servidor
- `DELETE /api/servers/:id` - Eliminar servidor
- `POST /api/servers/:id/regenerate-api-key` - Regenerar API key

#### Agente (requiere API key)
- `POST /api/agent/metrics` - Reportar métricas
- `POST /api/agent/services` - Reportar estado de servicios
- `POST /api/agent/logs` - Reportar logs
- `POST /api/agent/heartbeat` - Heartbeat

### WebSocket

Conectarse al WebSocket con autenticación:
```javascript
const ws = new WebSocket('ws://localhost:3000?token=YOUR_JWT_TOKEN');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

// Suscribirse a actualizaciones de un servidor específico
ws.send(JSON.stringify({
  type: 'subscribe',
  payload: { serverId: 1 }
}));
```

## Base de Datos

La base de datos se inicializa automáticamente con el script `init-db.sql` que incluye:

- Extensión TimescaleDB para series temporales
- Tablas para empresas, servidores, métricas, alertas, incidentes, servicios, logs
- Hypertables para métricas y logs (optimización temporal)
- Políticas de retención de datos
- Índices optimizados

### Tablas Principales

- `companies` - Empresas
- `users` - Usuarios
- `servers` - Servidores monitoreados
- `metrics` - Métricas del sistema (hypertable)
- `alert_rules` - Reglas de alerta
- `incidents` - Incidentes
- `services` - Servicios monitoreados
- `service_checks` - Historial de checks (hypertable)
- `logs` - Logs del sistema (hypertable)
- `docker_containers` - Contenedores Docker
- `fcm_tokens` - Tokens para notificaciones push

## Desarrollo

### Backend

```bash
# Modo desarrollo con hot reload
npm run dev

# Modo producción
npm start
```

### Ver logs de Docker

```bash
docker-compose logs -f
```

### Conectarse a PostgreSQL

```bash
docker exec -it monitor-postgres psql -U monitor_user -d monitor_db
```

### Conectarse a Redis

```bash
docker exec -it monitor-redis redis-cli
```

## Próximos Pasos

1. Desarrollar el agente de monitoreo (`agent/`)
2. Desarrollar la aplicación móvil React Native (`mobile/`)
3. Implementar sistema de notificaciones push con Firebase
4. Implementar servicio de alertas automáticas
5. Crear tests unitarios e integración

## Tecnologías Utilizadas

### Backend
- Node.js
- Express.js
- WebSocket (ws)
- PostgreSQL + TimescaleDB
- Redis
- JWT (jsonwebtoken)
- bcryptjs

### Base de Datos
- PostgreSQL 15
- TimescaleDB (extensión para series temporales)
- Redis 7

## Licencia

MIT

## Autor

Sistema de monitoreo desarrollado para gestionar 4 empresas con múltiples servidores VPS.
