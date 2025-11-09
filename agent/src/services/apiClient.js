import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

class ApiClient {
  constructor(config) {
    this.baseUrl = config.backendUrl;
    this.apiKey = config.apiKey;
    this.bufferFile = path.join(process.cwd(), 'data', 'buffer.json');

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      timeout: 10000,
    });

    this.buffer = [];
    this.loadBuffer();
  }

  async loadBuffer() {
    try {
      const data = await fs.readFile(this.bufferFile, 'utf-8');
      this.buffer = JSON.parse(data);
      console.log(`Loaded ${this.buffer.length} buffered items`);
    } catch (error) {
      // File doesn't exist or is invalid, start with empty buffer
      this.buffer = [];
    }
  }

  async saveBuffer() {
    try {
      await fs.mkdir(path.dirname(this.bufferFile), { recursive: true });
      await fs.writeFile(this.bufferFile, JSON.stringify(this.buffer));
    } catch (error) {
      console.error('Error saving buffer:', error);
    }
  }

  async sendMetrics(metrics) {
    try {
      const response = await this.client.post('/api/agent/metrics', { metrics });
      console.log(`✓ Sent ${metrics.length} metrics to backend`);
      return response.data;
    } catch (error) {
      console.error('Error sending metrics:', error.message);

      // Buffer metrics for later if request failed
      this.buffer.push({
        type: 'metrics',
        data: metrics,
        timestamp: new Date().toISOString(),
      });
      await this.saveBuffer();

      return null;
    }
  }

  async sendServiceStatus(services) {
    try {
      const response = await this.client.post('/api/agent/services', { services });
      console.log(`✓ Sent ${services.length} service statuses to backend`);
      return response.data;
    } catch (error) {
      console.error('Error sending service status:', error.message);

      this.buffer.push({
        type: 'services',
        data: services,
        timestamp: new Date().toISOString(),
      });
      await this.saveBuffer();

      return null;
    }
  }

  async sendLogs(logs) {
    try {
      const response = await this.client.post('/api/agent/logs', { logs });
      console.log(`✓ Sent ${logs.length} logs to backend`);
      return response.data;
    } catch (error) {
      console.error('Error sending logs:', error.message);

      this.buffer.push({
        type: 'logs',
        data: logs,
        timestamp: new Date().toISOString(),
      });
      await this.saveBuffer();

      return null;
    }
  }

  async sendHeartbeat() {
    try {
      const response = await this.client.post('/api/agent/heartbeat', {});
      return response.data;
    } catch (error) {
      console.error('Error sending heartbeat:', error.message);
      return null;
    }
  }

  async flushBuffer() {
    if (this.buffer.length === 0) {
      return;
    }

    console.log(`Attempting to flush ${this.buffer.length} buffered items...`);
    const itemsToFlush = [...this.buffer];
    this.buffer = [];

    for (const item of itemsToFlush) {
      let success = false;

      try {
        switch (item.type) {
          case 'metrics':
            await this.sendMetrics(item.data);
            success = true;
            break;
          case 'services':
            await this.sendServiceStatus(item.data);
            success = true;
            break;
          case 'logs':
            await this.sendLogs(item.data);
            success = true;
            break;
        }
      } catch (error) {
        console.error(`Error flushing ${item.type}:`, error.message);
      }

      // Re-buffer if failed
      if (!success) {
        this.buffer.push(item);
      }
    }

    await this.saveBuffer();

    if (this.buffer.length > 0) {
      console.log(`${this.buffer.length} items remain in buffer`);
    } else {
      console.log('✓ Buffer flushed successfully');
    }
  }
}

export default ApiClient;
