import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

// Import configurations
import pool from './config/database.js';
import redis from './config/redis.js';

// Import routes
import authRoutes from './routes/auth.js';
import companyRoutes from './routes/companies.js';
import serverRoutes from './routes/servers.js';
import agentRoutes from './routes/agent.js';

// Import WebSocket server
import MonitorWebSocketServer from './websocket/websocketServer.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Create HTTP server
const server = http.createServer(app);

// Middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later',
});
app.use('/api/', limiter);

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/agent', agentRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Initialize WebSocket server
const wsServer = new MonitorWebSocketServer(server);
console.log('✓ WebSocket server initialized');

// Start server
server.listen(PORT, HOST, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Monitor Backend Server Started                      ║
║                                                           ║
║   HTTP Server: http://${HOST}:${PORT}                    ║
║   WebSocket:   ws://${HOST}:${PORT}                      ║
║   Environment: ${process.env.NODE_ENV || 'development'}  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('\n🛑 Shutting down gracefully...');

  server.close(() => {
    console.log('✓ HTTP server closed');
  });

  await pool.end();
  console.log('✓ Database connections closed');

  await redis.quit();
  console.log('✓ Redis connection closed');

  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

export { app, wsServer };
