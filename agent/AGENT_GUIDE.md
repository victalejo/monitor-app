# Monitor Agent - Complete Guide

## Overview

The Monitor Agent is a lightweight, Node.js-based monitoring daemon that collects system metrics, Docker container stats, service health checks, and logs, then sends them to the Monitor Backend.

**Key Features:**
- 📊 System monitoring (CPU, RAM, disk, network)
- 🐳 Docker container monitoring
- 🔍 Service health checks (HTTP/HTTPS, databases)
- 📝 Log collection (system + Docker containers)
- 💾 Offline buffering when backend unavailable
- ⚡ Low resource usage (~50MB RAM, <1% CPU)

---

## Architecture

```
┌─────────────────────────────────────────────┐
│           MONITOR AGENT (VPS)               │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────┐      ┌──────────────────┐ │
│  │ Collectors  │      │ Monitors         │ │
│  ├─────────────┤      ├──────────────────┤ │
│  │ • System    │      │ • HTTP/HTTPS     │ │
│  │ • Docker    │      │ • PostgreSQL     │ │
│  │ • Logs      │      │ • MySQL          │ │
│  └─────────────┘      │ • MongoDB        │ │
│                       └──────────────────┘ │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │         API Client                   │  │
│  │  • Send to Backend                   │  │
│  │  • Offline Buffering                 │  │
│  │  • Auto-retry Failed Requests        │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
                    │
                    │ HTTPS + API Key
                    ▼
┌─────────────────────────────────────────────┐
│        MONITOR BACKEND (Central)            │
│   https://monitoreo.victalejo.dev           │
└─────────────────────────────────────────────┘
```

---

## Installation

### Prerequisites

1. **Node.js 18+**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Server Already Created in Backend**
   - Create company: `POST /api/companies`
   - Create server: `POST /api/servers`
   - Copy the generated `api_key` from response

### Automated Installation (Recommended)

```bash
# 1. Download agent to server
git clone https://github.com/victalejo/monitor-app.git
cd monitor-app/agent

# 2. Run install script (requires root)
chmod +x install.sh
sudo ./install.sh
```

**The script will:**
- Check for Node.js
- Create `monitor` system user
- Install to `/opt/monitor-agent`
- Run `npm install`
- Prompt for Backend URL and API Key
- Create systemd service
- Start and enable the agent

### Manual Installation

```bash
# 1. Copy agent files to server
scp -r agent/ user@your-server:/tmp/agent

# 2. SSH to server
ssh user@your-server

# 3. Move to installation directory
sudo mkdir -p /opt/monitor-agent
sudo cp -r /tmp/agent/* /opt/monitor-agent/
cd /opt/monitor-agent

# 4. Install dependencies
npm install --production

# 5. Create .env file
cp .env.example .env
nano .env
# Edit BACKEND_URL and API_KEY

# 6. Test run
npm start

# 7. Create systemd service (see below)
```

---

## Configuration

### Environment Variables (.env)

```bash
# Backend Configuration
BACKEND_URL=https://monitoreo.victalejo.dev    # Your backend URL
API_KEY=your-server-specific-api-key          # From POST /api/servers

# Collection Intervals (in seconds)
COLLECT_INTERVAL=60              # System metrics (default: 60s)
HEARTBEAT_INTERVAL=30            # Heartbeat (default: 30s)
LOG_INTERVAL=300                 # Logs (default: 5 minutes)
SERVICE_CHECK_INTERVAL=60        # Service health checks (default: 60s)

# Agent Configuration
NODE_ENV=production
```

### Getting Your API Key

```bash
# 1. Login to backend
curl -X POST https://monitoreo.victalejo.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"yourpassword"}'

# Copy accessToken from response

# 2. Create server
curl -X POST https://monitoreo.victalejo.dev/api/servers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "companyId": 1,
    "name": "Web Server 1",
    "hostname": "web1.example.com",
    "ipAddress": "192.168.1.100",
    "description": "Production web server"
  }'

# Copy "apiKey" from response to your .env file
```

---

## What Gets Monitored

### 1. System Metrics (every 60s)

**CPU:**
- Current load percentage
- Load per core
- Average load

**Memory:**
- Usage percentage
- Total, used, free, available bytes

**Disk:**
- Usage percentage per partition
- Mount path, filesystem, size, used, available

**Network:**
- RX/TX bytes per second
- Per network interface

### 2. Docker Containers (every 60s)

- Container CPU usage %
- Container memory usage %
- Container status (running/stopped)
- Container info (ID, name, image)

### 3. Service Health Checks (every 60s)

**HTTP/HTTPS:**
- Status code
- Response time
- Uptime status (up/down/degraded)

**Databases (PostgreSQL, MySQL, MongoDB):**
- TCP connection check
- Response time
- Connection status

### 4. Logs (every 5 minutes)

**System Logs:**
- Journalctl entries (if available)
- Syslog fallback
- Parsed by level (error/warning/info/debug)

**Docker Logs:**
- Container stdout/stderr
- Parsed by level
- Per-container tracking

---

## Service Management

### Using systemd (Production)

```bash
# Status
sudo systemctl status monitor-agent

# Start/Stop/Restart
sudo systemctl start monitor-agent
sudo systemctl stop monitor-agent
sudo systemctl restart monitor-agent

# Enable/Disable autostart
sudo systemctl enable monitor-agent
sudo systemctl disable monitor-agent

# View logs
sudo journalctl -u monitor-agent -f        # Follow logs
sudo journalctl -u monitor-agent --since "1 hour ago"
```

### Manual Run (Development/Testing)

```bash
cd /opt/monitor-agent

# Production mode
npm start

# Development mode (auto-restart on changes)
npm run dev
```

---

## Offline Buffering

When the backend is unreachable, the agent **automatically buffers** all data locally and retries when connection is restored.

**Buffer Configuration:**
- **Max Size:** 1000 items (configurable in apiClient.js)
- **Max Age:** 24 hours
- **Storage:** `data/buffer.json`
- **Auto-cleanup:** Removes oldest items when limits reached

**How it Works:**
1. Agent tries to send data to backend
2. If request fails → data saved to buffer file
3. On next successful connection → buffer is flushed
4. Old buffered items automatically removed

**Check Buffer Status:**
```bash
cat /opt/monitor-agent/data/buffer.json | jq length
```

---

## Troubleshooting

### Agent Not Sending Data

```bash
# 1. Check service status
sudo systemctl status monitor-agent

# 2. Check logs
sudo journalctl -u monitor-agent --since "10 minutes ago"

# 3. Test backend connectivity
curl -H "X-API-Key: YOUR_API_KEY" https://monitoreo.victalejo.dev/api/agent/heartbeat

# 4. Verify .env file
cat /opt/monitor-agent/.env

# 5. Check buffer
cat /opt/monitor-agent/data/buffer.json
```

### High Memory/CPU Usage

```bash
# Check agent resource usage
ps aux | grep "node.*index.js"

# If high:
# 1. Reduce collection intervals in .env
# 2. Reduce LOG_INTERVAL (logs are heavy)
# 3. Check for stuck processes

# Restart agent
sudo systemctl restart monitor-agent
```

### Docker Metrics Not Collecting

```bash
# Agent needs access to Docker socket
# 1. Check Docker is running
sudo systemctl status docker

# 2. Check socket permissions
ls -l /var/run/docker.sock

# 3. Add monitor user to docker group
sudo usermod -aG docker monitor
sudo systemctl restart monitor-agent
```

### Service Checks Not Working

Service monitoring requires services to be configured in the backend first.

Currently, the agent doesn't fetch services from backend automatically (TODO feature). You would need to manually populate `cachedServices` or implement the backend endpoint.

---

## Uninstallation

```bash
# Stop and disable service
sudo systemctl stop monitor-agent
sudo systemctl disable monitor-agent

# Remove service file
sudo rm /etc/systemd/system/monitor-agent.service
sudo systemctl daemon-reload

# Remove files
sudo rm -rf /opt/monitor-agent

# Remove user
sudo userdel monitor

# Remove logs
sudo journalctl --vacuum-time=1d
```

---

## Performance

**Resource Usage (Typical):**
- **RAM:** ~50MB
- **CPU:** <1%
- **Network:** ~10KB/minute (depends on metrics count)
- **Disk:** Minimal (buffer file only)

**Tested On:**
- Ubuntu 20.04 / 22.04
- Debian 11 / 12
- Node.js 18.x / 20.x
- Docker 20.x+

---

## API Endpoints Used

The agent communicates with these backend endpoints:

```
POST /api/agent/metrics        # Send system/Docker metrics
POST /api/agent/services       # Send service health checks
POST /api/agent/logs           # Send collected logs
POST /api/agent/heartbeat      # Update server status
```

All require `X-API-Key` header for authentication.

---

## Development

### Project Structure

```
agent/
├── src/
│   ├── index.js                 # Main entry point
│   ├── collectors/              # Data collectors
│   │   ├── systemMetrics.js     # CPU, RAM, disk, network
│   │   ├── dockerMetrics.js     # Docker containers
│   │   ├── systemLogs.js        # journalctl/syslog
│   │   └── dockerLogs.js        # Container logs
│   ├── monitors/                # Service monitors
│   │   ├── httpMonitor.js       # HTTP/HTTPS checks
│   │   └── databaseMonitor.js   # Database checks
│   └── services/
│       └── apiClient.js         # Backend API client
├── data/
│   ├── .gitkeep
│   └── buffer.json              # Offline buffer (generated)
├── install.sh                   # Installation script
├── .env.example                 # Environment template
├── package.json
└── README.md
```

### Running Tests

```bash
# Install dev dependencies
npm install

# Run in development mode
npm run dev

# Test individual collectors
node -e "import('./src/collectors/systemMetrics.js').then(m => m.collectSystemMetrics().then(console.log))"
```

---

## Security Considerations

1. **API Key Security:**
   - API key stored in `.env` (owned by monitor user, mode 600)
   - Never commit `.env` to version control
   - Rotate keys periodically

2. **Network Security:**
   - Always use HTTPS for backend URL
   - Agent validates SSL certificates by default

3. **System Access:**
   - Agent runs as non-root `monitor` user
   - Requires Docker socket access for container monitoring
   - Requires journalctl access for log collection

4. **Data Privacy:**
   - Logs truncated to 1000 characters
   - No sensitive data collected by default
   - Customize `systemLogs.js` to filter sensitive log patterns

---

## Future Improvements

- [ ] Auto-fetch services list from backend API
- [ ] Process monitoring (top processes, zombies)
- [ ] Network latency measurements
- [ ] Auto-discovery of running services
- [ ] Local CLI for agent status
- [ ] Compression of metrics before sending
- [ ] TLS mutual authentication
- [ ] Windows support

---

## Support

- **Documentation:** [DEPLOYMENT_SUCCESS.md](../DEPLOYMENT_SUCCESS.md)
- **Backend API:** https://monitoreo.victalejo.dev
- **GitHub:** https://github.com/victalejo/monitor-app

---

**Agent Version:** 1.0.0
**Last Updated:** 2025-11-09
**License:** MIT
