# Arquitectura del Sistema de Monitoreo

## Visión General

El sistema de monitoreo está diseñado como una solución multi-tenant para monitorear servidores y servicios de múltiples empresas desde una aplicación móvil Android.

## Componentes Principales

### 1. Backend API (Node.js)

**Responsabilidades:**
- Autenticación y autorización
- Gestión de empresas, servidores y servicios
- Recepción y almacenamiento de métricas
- Procesamiento de alertas
- Envío de notificaciones push
- Streaming de datos en tiempo real vía WebSocket

**Stack Tecnológico:**
- Runtime: Node.js 18+
- Framework: Express.js
- WebSocket: ws
- Autenticación: JWT
- Seguridad: helmet, bcryptjs

### 2. Base de Datos

**PostgreSQL + TimescaleDB:**
- PostgreSQL para datos estructurados
- TimescaleDB para series temporales optimizadas
- Redis para caché y pub/sub

**Modelo de Datos:**

```
companies (empresas)
  ├── servers (servidores)
  │   ├── metrics (métricas - hypertable)
  │   ├── docker_containers
  │   ├── services
  │   │   └── service_checks (hypertable)
  │   ├── alert_rules
  │   └── logs (hypertable)
  └── incidents
```

**Hypertables (TimescaleDB):**
- `metrics`: Métricas del sistema con agregaciones automáticas
- `service_checks`: Historial de checks de servicios
- `docker_status_history`: Estado de contenedores Docker
- `logs`: Logs del sistema

**Retención de Datos:**
- Métricas: 365 días
- Logs: 90 días
- Service checks: 365 días

### 3. Agente de Monitoreo

**Responsabilidades:**
- Recolección de métricas del sistema (CPU, RAM, disco, red)
- Monitoreo de contenedores Docker
- Checks de servicios HTTP/HTTPS y bases de datos
- Recolección de logs
- Envío de heartbeat
- Buffer de datos en caso de pérdida de conexión

**Stack Tecnológico:**
- Node.js (alternativa: Python)
- Instalación: Systemd service

### 4. App Móvil Android

**Responsabilidades:**
- Autenticación de usuario
- Dashboard de empresas
- Visualización de servidores y métricas
- Gráficos en tiempo real e históricos
- Recepción de notificaciones push
- Gestión de alertas

**Stack Tecnológico:**
- Framework: React Native
- State Management: Context API / Redux
- Gráficos: react-native-charts
- WebSocket: native WebSocket API
- Notificaciones: Firebase Cloud Messaging
- Biometría: react-native-biometrics

## Flujo de Datos

### 1. Recolección de Métricas

```
[Servidor VPS]
    ↓
[Agente de Monitoreo]
    ↓ (HTTP POST con API Key)
[Backend API] → [PostgreSQL + TimescaleDB]
    ↓ (Redis Pub/Sub)
[WebSocket Server]
    ↓
[App Móvil]
```

### 2. Alertas

```
[Backend - Alert Service]
    ↓ (Verificación periódica)
[Evaluación de reglas de alerta]
    ↓ (Si condición se cumple)
[Crear Incidente] → [PostgreSQL]
    ↓
[Firebase Cloud Messaging]
    ↓
[App Móvil - Notificación Push]
```

### 3. Tiempo Real

```
[Agente] → [Backend API] → [Redis Pub/Sub]
                              ↓
                    [WebSocket Server]
                              ↓
                         [App Móvil]
                         (Actualización inmediata)
```

## Seguridad

### Autenticación

**App Móvil → Backend:**
- JWT con refresh tokens
- Biometría local en el dispositivo
- HTTPS obligatorio

**Agente → Backend:**
- API Key única por servidor
- Regeneración de API key disponible
- HTTPS obligatorio

### Autorización

**Multi-tenant:**
- Cada empresa solo puede ver sus propios servidores
- Usuario único (admin) con acceso a todas las empresas

### Protección

- Rate limiting (100 requests / 15 minutos)
- Helmet.js para headers de seguridad
- CORS configurado
- Input validation con express-validator
- SQL injection prevention (prepared statements)

## Escalabilidad

### Base de Datos

**TimescaleDB Optimizaciones:**
- Hypertables con particionamiento automático
- Compression policies para datos antiguos
- Continuous aggregates para consultas rápidas
- Índices optimizados por tiempo

**Redis:**
- Caché de consultas frecuentes
- Pub/Sub para eventos en tiempo real
- Session storage

### Backend

**Escalabilidad Horizontal:**
- Stateless API (JWT)
- WebSocket sticky sessions
- Load balancer compatible

### Agentes

- Diseñados para bajo consumo de recursos
- Buffer local para datos offline
- Batch sending de métricas

## Métricas Recolectadas

### Sistema Operativo
- CPU: Uso total, por core
- Memoria: Total, usada, libre, cache
- Disco: Espacio total, usado, libre, I/O
- Red: Bytes in/out, paquetes, errores

### Docker
- Estado de contenedores
- CPU y memoria por contenedor
- Logs de contenedores
- Health checks

### Servicios
- HTTP/HTTPS: Status code, response time, uptime
- Bases de datos: Connection test, response time
- Disponibilidad (uptime %)

### Logs
- System logs (syslog)
- Application logs
- Container logs
- Niveles: info, warning, error, debug

## Alertas

### Tipos de Alertas

1. **Threshold Alerts** (Umbrales):
   - CPU > 80% por 5 minutos
   - Memoria > 90%
   - Disco > 85%
   - Red: Errores > threshold

2. **Service Alerts**:
   - Servicio HTTP down
   - Database connection failed
   - Container stopped

3. **Server Alerts**:
   - Servidor offline (sin heartbeat)
   - Múltiples servicios down

### Configuración

```javascript
{
  name: "CPU Alta",
  metricType: "cpu",
  condition: "gt",  // gt, gte, lt, lte, eq
  threshold: 80,
  duration: 300,    // segundos
  enabled: true
}
```

### Severidad

- **info**: Informativo
- **warning**: Advertencia, requiere atención
- **critical**: Crítico, requiere acción inmediata

## Notificaciones Push

### Firebase Cloud Messaging (FCM)

**Flujo:**
1. App se registra con FCM y obtiene token
2. Token se envía al backend
3. Backend almacena token en tabla `fcm_tokens`
4. Cuando ocurre un incidente, backend envía notificación vía FCM
5. App recibe notificación y muestra alerta

**Tipos de Notificaciones:**
- Alerta disparada
- Servidor offline
- Servicio caído
- Incidente resuelto

## Performance

### Consultas Optimizadas

**Métricas recientes:**
```sql
SELECT * FROM metrics
WHERE server_id = $1 AND metric_type = $2
ORDER BY time DESC
LIMIT 100
```

**Agregaciones (por hora, día):**
```sql
SELECT time_bucket('1 hour', time) AS bucket,
       AVG(value) as avg_value,
       MAX(value) as max_value
FROM metrics
WHERE server_id = $1
  AND metric_type = $2
  AND time > NOW() - INTERVAL '24 hours'
GROUP BY bucket
ORDER BY bucket ASC
```

### Caché (Redis)

- Últimas métricas por servidor (TTL: 60s)
- Estado de servidores (TTL: 30s)
- Estadísticas de empresas (TTL: 300s)

## Deployment

### Backend

**Docker Compose (Desarrollo):**
```bash
docker-compose up -d
npm run dev
```

**Producción:**
- PM2 para process management
- Nginx como reverse proxy
- Docker para PostgreSQL y Redis
- Systemd service

### Agente

**Instalación:**
```bash
curl -sSL https://backend.example.com/install-agent.sh | bash
```

**Configuración:**
```bash
/etc/monitor-agent/config.json
```

**Systemd:**
```bash
systemctl enable monitor-agent
systemctl start monitor-agent
```

### App Móvil

**Build:**
```bash
cd mobile
npx react-native run-android  # Development
npx react-native build-android # Production APK
```

## Monitoreo del Sistema de Monitoreo

- Health check endpoint: `/health`
- Logs centralizados (Winston)
- Métricas del backend (opcional: Prometheus)
- Alertas si backend no responde

## Backup y Recuperación

### Base de Datos

**Backup diario:**
```bash
pg_dump -U monitor_user monitor_db > backup_$(date +%Y%m%d).sql
```

**Restore:**
```bash
psql -U monitor_user monitor_db < backup_20231201.sql
```

### Redis

- AOF (Append Only File) habilitado
- Snapshot periódico

## Roadmap Futuro

1. Soporte para más tipos de servicios (MongoDB, Elasticsearch, etc.)
2. Machine learning para detección de anomalías
3. Auto-scaling de recursos
4. Dashboards personalizables
5. Reportes automatizados (PDF, email)
6. Integración con Slack, Teams, etc.
7. App para iOS
8. Panel web administrativo
