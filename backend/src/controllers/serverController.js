import Server from '../models/Server.js';
import Metric from '../models/Metric.js';

export const getAllServers = async (req, res) => {
  try {
    const { companyId } = req.query;
    const servers = await Server.findAll(companyId || null);
    res.json({ success: true, servers });
  } catch (error) {
    console.error('Get servers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getServerById = async (req, res) => {
  try {
    const { id } = req.params;
    const server = await Server.findById(id);

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    // Get current metrics
    const currentMetrics = await Metric.getCurrent(id);

    res.json({ success: true, server: { ...server, currentMetrics } });
  } catch (error) {
    console.error('Get server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createServer = async (req, res) => {
  try {
    const { companyId, name, hostname, ipAddress, description } = req.body;

    if (!companyId || !name || !hostname || !ipAddress) {
      return res.status(400).json({
        error: 'Company ID, name, hostname, and IP address are required',
      });
    }

    const server = await Server.create(companyId, name, hostname, ipAddress, description);
    res.status(201).json({ success: true, server });
  } catch (error) {
    console.error('Create server error:', error);
    if (error.code === '23505') {
      // Unique constraint violation
      return res.status(409).json({ error: 'Server name already exists for this company' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateServer = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const server = await Server.update(id, data);

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    res.json({ success: true, server });
  } catch (error) {
    console.error('Update server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteServer = async (req, res) => {
  try {
    const { id } = req.params;
    const server = await Server.delete(id);

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    res.json({ success: true, message: 'Server deleted successfully' });
  } catch (error) {
    console.error('Delete server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const regenerateApiKey = async (req, res) => {
  try {
    const { id } = req.params;
    const server = await Server.regenerateApiKey(id);

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    res.json({ success: true, server });
  } catch (error) {
    console.error('Regenerate API key error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getServerMetrics = async (req, res) => {
  try {
    const { id } = req.params;
    const { metricType, interval, duration } = req.query;

    if (!metricType) {
      return res.status(400).json({ error: 'Metric type is required' });
    }

    const metrics = await Metric.getAggregated(
      id,
      metricType,
      interval || '1 hour',
      duration || '24 hours'
    );

    res.json({ success: true, metrics });
  } catch (error) {
    console.error('Get server metrics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
