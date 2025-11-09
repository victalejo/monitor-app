import dotenv from 'dotenv';
import cron from 'node-cron';
import { collectSystemMetrics } from './collectors/systemMetrics.js';
import { collectDockerMetrics } from './collectors/dockerMetrics.js';
import ApiClient from './services/apiClient.js';

// Load environment variables
dotenv.config();

const config = {
  backendUrl: process.env.BACKEND_URL || 'http://localhost:3000',
  apiKey: process.env.API_KEY,
  collectInterval: parseInt(process.env.COLLECT_INTERVAL || '60'), // seconds
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30'), // seconds
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
║   Interval:   ${config.collectInterval}s                 ║
║   Heartbeat:  ${config.heartbeatInterval}s               ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// Initialize API client
const apiClient = new ApiClient(config);

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

// Schedule metric collection
const collectSchedule = `*/${config.collectInterval} * * * * *`;
cron.schedule(collectSchedule, collectAndSend);

// Schedule heartbeat
const heartbeatSchedule = `*/${config.heartbeatInterval} * * * * *`;
cron.schedule(heartbeatSchedule, sendHeartbeat);

// Initial collection on startup
setTimeout(async () => {
  await collectAndSend();
  await sendHeartbeat();
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
