# Monitor Agent

Agente de monitoreo que se instala en servidores VPS para recolectar métricas y enviarlas al backend.

## Características

- Recolección de métricas del sistema (CPU, RAM, disco, red)
- Monitoreo de contenedores Docker
- Buffer local para datos offline
- Heartbeat automático
- Instalación como servicio systemd

## Requisitos

- Node.js 18+
- Linux (Ubuntu, Debian, CentOS, etc.)
- Acceso root para instalación

## Instalación Rápida

### 1. Descargar el agente

```bash
# Clonar o descargar los archivos del agente
cd /tmp
# Copiar archivos del agente aquí
```

### 2. Instalar

```bash
cd agent
chmod +x install.sh
sudo ./install.sh
```

El script te pedirá:
- URL del backend (ej: `http://tu-servidor:3000`)
- API Key del servidor (obténla desde el panel del backend)

### 3. Verificar

```bash
sudo systemctl status monitor-agent
```

## Instalación Manual

### 1. Instalar Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar

Copiar el archivo de configuración:
```bash
cp .env.example .env
```

Editar `.env`:
```
BACKEND_URL=http://your-backend-server:3000
API_KEY=your-server-api-key-here
COLLECT_INTERVAL=60
HEARTBEAT_INTERVAL=30
```

### 4. Ejecutar

```bash
npm start
```

## Configuración

### Variables de Entorno

| Variable | Descripción | Por Defecto |
|----------|-------------|-------------|
| `BACKEND_URL` | URL del backend API | `http://localhost:3000` |
| `API_KEY` | API key del servidor (REQUERIDO) | - |
| `COLLECT_INTERVAL` | Intervalo de recolección (segundos) | `60` |
| `HEARTBEAT_INTERVAL` | Intervalo de heartbeat (segundos) | `30` |

## Métricas Recolectadas

### Sistema
- **CPU**: Uso total y por core
- **Memoria**: Total, usada, libre, disponible
- **Disco**: Uso por partición/mount point
- **Red**: Tráfico RX/TX por interfaz

### Docker (si está disponible)
- Estado de contenedores
- CPU por contenedor
- Memoria por contenedor

## Administración del Servicio

### Ver estado
```bash
sudo systemctl status monitor-agent
```

### Ver logs
```bash
sudo journalctl -u monitor-agent -f
```

### Reiniciar
```bash
sudo systemctl restart monitor-agent
```

### Detener
```bash
sudo systemctl stop monitor-agent
```

### Deshabilitar
```bash
sudo systemctl disable monitor-agent
```

## Desinstalación

```bash
sudo systemctl stop monitor-agent
sudo systemctl disable monitor-agent
sudo rm /etc/systemd/system/monitor-agent.service
sudo rm -rf /opt/monitor-agent
sudo systemctl daemon-reload
```

## Troubleshooting

### El agente no se conecta al backend

1. Verificar conectividad:
```bash
curl http://your-backend:3000/health
```

2. Verificar API key:
```bash
curl -H "X-API-Key: your-api-key" http://your-backend:3000/api/agent/heartbeat -X POST
```

3. Ver logs del agente:
```bash
sudo journalctl -u monitor-agent -f
```

### Error de permisos con Docker

Agregar el usuario monitor al grupo docker:
```bash
sudo usermod -aG docker monitor
sudo systemctl restart monitor-agent
```

### Buffer creciendo sin control

Verificar que el backend esté accesible. El buffer se limpia automáticamente cuando la conexión se restablece.

## Desarrollo

### Modo desarrollo
```bash
npm run dev
```

### Estructura
```
agent/
├── src/
│   ├── collectors/       # Colectores de métricas
│   ├── services/         # API client y servicios
│   └── index.js          # Punto de entrada
├── data/                 # Buffer local
├── .env                  # Configuración
└── install.sh           # Script de instalación
```

## Seguridad

- El agente usa autenticación mediante API key
- Todas las comunicaciones deben ser sobre HTTPS en producción
- El agente corre con un usuario no-root (`monitor`)
- Los datos sensibles se almacenan en `/opt/monitor-agent/.env` con permisos restringidos

## Performance

- Consumo de CPU: < 1%
- Consumo de RAM: ~50MB
- Ancho de banda: ~10KB cada 60 segundos (dependiendo de la cantidad de métricas)
