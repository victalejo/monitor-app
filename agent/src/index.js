import dotenv from 'dotenv';
import cron from 'node-cron';
import fs from 'fs/promises';
import path from 'path';
import { collectSystemMetrics } from './collectors/systemMetrics.js';
import { collectDockerMetrics } from './collectors/dockerMetrics.js';
import { collectSystemLogs } from './collectors/systemLogs.js';
import { collectDockerLogs } from './collectors/dockerLogs.js';
import { checkHttpServices } from './monitors/httpMonitor.js';
import { checkDatabaseServices } from './monitors/databaseMonitor.js';
import ApiClient from './services/apiClient.js';

// Load environment variables
dotenv.config();

const config = {
  backendUrl: process.env.BACKEND_URL || 'http://localhost:3000',
  apiKey: process.env.API_KEY,
  collectInterval: parseInt(process.env.COLLECT_INTERVAL || '60'), // seconds
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30'), // seconds
  logInterval: parseInt(process.env.LOG_INTERVAL || '300'), // seconds (5 min)
  serviceCheckInterval: parseInt(process.env.SERVICE_CHECK_INTERVAL || '60'), // seconds
};

// Validate configuration
if (!config.apiKey) {
  console.error('ERROR: API_KEY is required in .env file');
  process.exit(1);
}

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🔍 Monitor Agent Started                               ║
║                                                           ║
║   Backend:    ${config.backendUrl}                       ║
║   Metrics:    ${config.collectInterval}s                 ║
║   Services:   ${config.serviceCheckInterval}s            ║
║   Logs:       ${config.logInterval}s                     ║
║   Heartbeat:  ${config.heartbeatInterval}s               ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// Initialize API client
const apiClient = new ApiClient(config);

// Track services list (cached from backend)
let cachedServices = [];

// Create data directory if it doesn't exist
(async () => {
  const dataDir = path.join(process.cwd(), 'data');
  try {
    await fs.mkdir(dataDir, { recursive: true });
    console.log('✓ Data directory ready');
  } catch (error) {
    console.error('⚠️ Warning: Could not create data directory:', error.message);
  }
})();

// Collect and send metrics
async function collectAndSend() {
  try {
    console.log(`[${new Date().toISOString()}] Collecting metrics...`);

    const allMetrics = [];

    // Collect system metrics
    const systemMetrics = await collectSystemMetrics();
    allMetrics.push(...systemMetrics);

    // Collect Docker metrics
    const dockerData = await collectDockerMetrics();
    allMetrics.push(...dockerData.metrics);

    if (allMetrics.length > 0) {
      await apiClient.sendMetrics(allMetrics);
    }

    // Try to flush buffer if there are pending items
    await apiClient.flushBuffer();
  } catch (error) {
    console.error('Error in collect and send:', error);
  }
}

// Send heartbeat
async function sendHeartbeat() {
  try {
    const result = await apiClient.sendHeartbeat();
    if (result) {
      console.log(`[${new Date().toISOString()}] Heartbeat sent`);
    }
  } catch (error) {
    console.error('Error sending heartbeat:', error);
  }
}

// Collect and send logs
async function collectAndSendLogs() {
  try {
    console.log(`[${new Date().toISOString()}] Collecting logs...`);

    const allLogs = [];

    // Collect system logs
    const systemLogs = await collectSystemLogs(5, 100);
    allLogs.push(...systemLogs);

    // Collect Docker logs
    const dockerLogs = await collectDockerLogs(50);
    allLogs.push(...dockerLogs);

    if (allLogs.length > 0) {
      await apiClient.sendLogs(allLogs);
    }
  } catch (error) {
    console.error('Error collecting logs:', error);
  }
}

// Check services and send status
async function checkAndSendServiceStatus() {
  try {
    console.log(`[${new Date().toISOString()}] Checking services...`);

    // TODO: Fetch services list from backend API
    // For now, using cached list (would need backend endpoint to fetch services)

    if (cachedServices.length === 0) {
      // console.log('No services configured to monitor');
      return;
    }

    const allResults = [];

    // Separate services by type
    const httpServices = cachedServices.filter(s =>
      s.service_type === 'http' || s.service_type === 'https'
    );
    const dbServices = cachedServices.filter(s =>
      ['postgresql', 'mysql', 'mongodb'].includes(s.service_type)
    );

    // Check HTTP/HTTPS services
    if (httpServices.length > 0) {
      const httpResults = await checkHttpServices(httpServices);
      allResults.push(...httpResults);
    }

    // Check database services
    if (dbServices.length > 0) {
      const dbResults = await checkDatabaseServices(dbServices);
      allResults.push(...dbResults);
    }

    if (allResults.length > 0) {
      await apiClient.sendServiceStatus(allResults);
    }
  } catch (error) {
    console.error('Error checking services:', error);
  }
}

// Schedule metric collection
const collectSchedule = `*/${config.collectInterval} * * * * *`;
cron.schedule(collectSchedule, collectAndSend);

// Schedule heartbeat
const heartbeatSchedule = `*/${config.heartbeatInterval} * * * * *`;
cron.schedule(heartbeatSchedule, sendHeartbeat);

// Schedule log collection
const logSchedule = `*/${config.logInterval} * * * * *`;
cron.schedule(logSchedule, collectAndSendLogs);

// Schedule service checks
const serviceSchedule = `*/${config.serviceCheckInterval} * * * * *`;
cron.schedule(serviceSchedule, checkAndSendServiceStatus);

console.log('✓ All schedules configured');

// Initial collection on startup
setTimeout(async () => {
  await collectAndSend();
  await sendHeartbeat();
  await collectAndSendLogs();
  await checkAndSendServiceStatus();
}, 2000);

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('\n🛑 Shutting down agent...');

  // Final collection before shutdown
  await collectAndSend();

  console.log('✓ Agent stopped');
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
