import Metric from '../models/Metric.js';
import Server from '../models/Server.js';
import Service from '../models/Service.js';

export const reportMetrics = async (req, res) => {
  try {
    const { server } = req; // From authenticateAgent middleware
    const { metrics } = req.body;

    if (!metrics || !Array.isArray(metrics)) {
      return res.status(400).json({ error: 'Metrics array is required' });
    }

    // Save metrics in batch
    await Metric.createBatch(server.id, metrics);

    // Update server last_seen
    await Server.updateLastSeen(server.id);

    res.json({ success: true, message: 'Metrics received successfully' });
  } catch (error) {
    console.error('Report metrics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const reportServiceStatus = async (req, res) => {
  try {
    const { server } = req;
    const { services } = req.body;

    if (!services || !Array.isArray(services)) {
      return res.status(400).json({ error: 'Services array is required' });
    }

    // Update service statuses and record checks
    for (const serviceData of services) {
      const { serviceId, status, responseTime, statusCode, errorMessage } = serviceData;

      if (serviceId) {
        await Service.updateStatus(serviceId, status);
        await Service.recordCheck(serviceId, status, responseTime, statusCode, errorMessage);
      }
    }

    res.json({ success: true, message: 'Service statuses received successfully' });
  } catch (error) {
    console.error('Report service status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const reportLogs = async (req, res) => {
  try {
    const { server } = req;
    const { logs } = req.body;

    if (!logs || !Array.isArray(logs)) {
      return res.status(400).json({ error: 'Logs array is required' });
    }

    // Import query function
    const { query } = await import('../config/database.js');

    // Insert logs in batch
    for (const log of logs) {
      const { level, source, message, metadata } = log;
      await query(
        'INSERT INTO logs (time, server_id, log_level, source, message, metadata) VALUES (CURRENT_TIMESTAMP, $1, $2, $3, $4, $5)',
        [server.id, level, source, message, metadata]
      );
    }

    res.json({ success: true, message: 'Logs received successfully' });
  } catch (error) {
    console.error('Report logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const heartbeat = async (req, res) => {
  try {
    const { server } = req;

    // Update server last_seen and status
    await Server.updateLastSeen(server.id);

    res.json({ success: true, message: 'Heartbeat received', serverId: server.id });
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
