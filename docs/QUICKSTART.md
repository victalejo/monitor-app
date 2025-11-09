# Guía de Inicio Rápido

Esta guía te ayudará a poner en marcha el sistema de monitoreo en 10 minutos.

## Prerequisitos

- Node.js 18+
- Docker y Docker Compose
- Git (opcional)

## Paso 1: Configurar el Backend

### 1.1 Iniciar las bases de datos

```bash
cd backend
docker-compose up -d
```

Espera unos segundos hasta que los contenedores estén listos:
```bash
docker-compose ps
```

Deberías ver `monitor-postgres` y `monitor-redis` en estado "Up".

### 1.2 Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env` si necesitas cambiar alguna configuración (opcional para desarrollo local).

### 1.3 Iniciar el backend

```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3000`

### 1.4 Verificar que funciona

En otra terminal:
```bash
curl http://localhost:3000/health
```

Deberías ver:
```json
{
  "status": "ok",
  "timestamp": "...",
  "uptime": ...
}
```

## Paso 2: Probar la Autenticación

### 2.1 Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

Deberías recibir un token JWT:
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

Guarda el `accessToken` para los siguientes pasos.

## Paso 3: Crear una Empresa y Servidor

### 3.1 Crear una empresa

```bash
curl -X POST http://localhost:3000/api/companies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "Mi Empresa",
    "description": "Empresa de prueba"
  }'
```

Respuesta:
```json
{
  "success": true,
  "company": {
    "id": 1,
    "name": "Mi Empresa",
    ...
  }
}
```

### 3.2 Crear un servidor

```bash
curl -X POST http://localhost:3000/api/servers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "companyId": 1,
    "name": "Servidor Producción",
    "hostname": "prod-server-01",
    "ipAddress": "192.168.1.100",
    "description": "Servidor principal de producción"
  }'
```

Respuesta incluirá un `api_key` - **Guárdalo**, lo necesitarás para el agente:
```json
{
  "success": true,
  "server": {
    "id": 1,
    "api_key": "abc123...",
    ...
  }
}
```

## Paso 4: Instalar el Agente

### En tu servidor VPS (Linux):

### 4.1 Instalar Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 4.2 Copiar archivos del agente

Copia la carpeta `agent/` a tu servidor:
```bash
scp -r agent/ user@your-server:/tmp/
```

### 4.3 Instalar el agente

En el servidor:
```bash
cd /tmp/agent
chmod +x install.sh
sudo ./install.sh
```

Cuando te pida:
- **Backend URL**: `http://YOUR_BACKEND_IP:3000`
- **API Key**: El `api_key` que obtuviste en el paso 3.2

### 4.4 Verificar

```bash
sudo systemctl status monitor-agent
```

Deberías ver el agente corriendo y enviando métricas.

## Paso 5: Ver las Métricas

### 5.1 Listar servidores

```bash
curl http://localhost:3000/api/servers \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Deberías ver tu servidor con `status: "online"`.

### 5.2 Ver métricas actuales

```bash
curl "http://localhost:3000/api/servers/1" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Verás las métricas más recientes del servidor.

### 5.3 Ver métricas históricas

```bash
curl "http://localhost:3000/api/servers/1/metrics?metricType=cpu&interval=5+minutes&duration=1+hour" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Paso 6: Probar WebSocket (Opcional)

Crea un archivo `test-websocket.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>WebSocket Test</title>
</head>
<body>
  <h1>WebSocket Test</h1>
  <div id="messages"></div>

  <script>
    const token = 'YOUR_ACCESS_TOKEN';
    const ws = new WebSocket(`ws://localhost:3000?token=${token}`);

    ws.onopen = () => {
      console.log('Connected');
      document.getElementById('messages').innerHTML += '<p>✓ Connected</p>';

      // Subscribe to server updates
      ws.send(JSON.stringify({
        type: 'subscribe',
        payload: { serverId: 1 }
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Received:', data);
      document.getElementById('messages').innerHTML +=
        `<p><strong>${data.type}</strong>: ${JSON.stringify(data)}</p>`;
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  </script>
</body>
</html>
```

Abre el archivo en tu navegador y verás las actualizaciones en tiempo real.

## Próximos Pasos

### Backend

1. **Cambiar la contraseña de admin**:
```bash
curl -X POST http://localhost:3000/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "currentPassword": "admin123",
    "newPassword": "tu-nueva-contraseña-segura"
  }'
```

2. **Crear alertas**:
```bash
curl -X POST http://localhost:3000/api/alerts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "serverId": 1,
    "name": "CPU Alta",
    "metricType": "cpu",
    "condition": "gt",
    "threshold": 80,
    "duration": 300
  }'
```

3. **Agregar más empresas y servidores**

### App Móvil

1. Desarrollar la aplicación React Native (próxima fase)
2. Integrar con el backend API
3. Implementar notificaciones push

### Producción

1. Configurar HTTPS (Nginx + Let's Encrypt)
2. Configurar firewall
3. Implementar backups automáticos de la base de datos
4. Configurar variables de entorno de producción
5. Usar PM2 para el backend en producción

## Troubleshooting

### El backend no se conecta a la base de datos

```bash
docker-compose logs postgres
```

Verifica que el contenedor esté corriendo y que las credenciales en `.env` sean correctas.

### El agente no envía métricas

```bash
sudo journalctl -u monitor-agent -f
```

Verifica:
- Que el backend sea accesible desde el servidor VPS
- Que el API key sea correcto
- Que no haya firewall bloqueando el puerto 3000

### Token JWT expirado

Los tokens expiran después de 7 días. Usa el endpoint `/api/auth/refresh` con tu `refreshToken` para obtener un nuevo `accessToken`.

## Comandos Útiles

### Backend
```bash
# Logs del backend
docker-compose logs -f

# Reiniciar base de datos
docker-compose restart postgres

# Ver base de datos
docker exec -it monitor-postgres psql -U monitor_user -d monitor_db

# Detener todo
docker-compose down
```

### Agente
```bash
# Status
sudo systemctl status monitor-agent

# Logs
sudo journalctl -u monitor-agent -f

# Reiniciar
sudo systemctl restart monitor-agent

# Editar configuración
sudo nano /opt/monitor-agent/.env
sudo systemctl restart monitor-agent
```

## ¿Necesitas Ayuda?

Consulta la documentación completa en:
- [README.md](../README.md) - Documentación general
- [ARCHITECTURE.md](ARCHITECTURE.md) - Arquitectura del sistema
- [Agent README](../agent/README.md) - Documentación del agente
