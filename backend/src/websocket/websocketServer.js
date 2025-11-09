import { WebSocketServer } from 'ws';
import { verifyToken } from '../utils/jwt.js';
import redis from '../config/redis.js';

class MonitorWebSocketServer {
  constructor(server) {
    this.wss = new WebSocketServer({ server });
    this.clients = new Map(); // userId -> Set of WebSocket connections

    this.setupWebSocketServer();
    this.setupRedisSubscription();
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws, req) => {
      console.log('New WebSocket connection attempt');

      // Authentication via query parameter
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        ws.close(1008, 'Authentication required');
        return;
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        ws.close(1008, 'Invalid token');
        return;
      }

      const userId = decoded.userId;
      ws.userId = userId;
      ws.isAlive = true;

      // Add to clients map
      if (!this.clients.has(userId)) {
        this.clients.set(userId, new Set());
      }
      this.clients.get(userId).add(ws);

      console.log(`WebSocket authenticated for user ${userId}`);

      // Handle pong responses
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Handle messages from client
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(ws, message);
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      });

      // Handle disconnect
      ws.on('close', () => {
        console.log(`WebSocket closed for user ${userId}`);
        const userConnections = this.clients.get(userId);
        if (userConnections) {
          userConnections.delete(ws);
          if (userConnections.size === 0) {
            this.clients.delete(userId);
          }
        }
      });

      // Send welcome message
      ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connected successfully' }));
    });

    // Heartbeat to detect broken connections
    const heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(heartbeatInterval);
    });
  }

  setupRedisSubscription() {
    // Subscribe to Redis pub/sub for real-time updates
    const subscriber = redis.duplicate();

    subscriber.subscribe('metrics:update', 'alerts:trigger', 'server:status', (err, count) => {
      if (err) {
        console.error('Redis subscribe error:', err);
        return;
      }
      console.log(`Subscribed to ${count} Redis channels`);
    });

    subscriber.on('message', (channel, message) => {
      try {
        const data = JSON.parse(message);
        this.broadcast(data);
      } catch (error) {
        console.error('Redis message parse error:', error);
      }
    });
  }

  handleClientMessage(ws, message) {
    const { type, payload } = message;

    switch (type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;

      case 'subscribe':
        // Client subscribes to specific server updates
        if (!ws.subscriptions) {
          ws.subscriptions = new Set();
        }
        if (payload.serverId) {
          ws.subscriptions.add(payload.serverId);
        }
        break;

      case 'unsubscribe':
        if (ws.subscriptions && payload.serverId) {
          ws.subscriptions.delete(payload.serverId);
        }
        break;

      default:
        console.log('Unknown message type:', type);
    }
  }

  broadcast(data) {
    const message = JSON.stringify(data);

    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        // OPEN state
        // Check if client is subscribed to this update
        if (data.serverId && client.subscriptions && !client.subscriptions.has(data.serverId)) {
          return; // Skip if not subscribed
        }
        client.send(message);
      }
    });
  }

  sendToUser(userId, data) {
    const userConnections = this.clients.get(userId);
    if (!userConnections) return;

    const message = JSON.stringify(data);
    userConnections.forEach((ws) => {
      if (ws.readyState === 1) {
        ws.send(message);
      }
    });
  }
}

export default MonitorWebSocketServer;
