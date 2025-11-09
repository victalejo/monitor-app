import { query } from '../config/database.js';

class Metric {
  static async create(serverId, metricType, value, metadata = null) {
    const result = await query(
      'INSERT INTO metrics (time, server_id, metric_type, value, metadata) VALUES (CURRENT_TIMESTAMP, $1, $2, $3, $4) RETURNING *',
      [serverId, metricType, value, metadata]
    );
    return result.rows[0];
  }

  static async createBatch(serverId, metrics) {
    // metrics is an array of { metricType, value, metadata }
    const values = metrics.map((m) => [serverId, m.metricType, m.value, m.metadata]);

    // Build multi-row insert
    const placeholders = values
      .map((_, i) => {
        const base = i * 4;
        return `(CURRENT_TIMESTAMP, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
      })
      .join(', ');

    const flatValues = values.flat();

    const result = await query(
      `INSERT INTO metrics (time, server_id, metric_type, value, metadata) VALUES ${placeholders}`,
      flatValues
    );
    return result.rowCount;
  }

  static async getLatest(serverId, metricType, limit = 100) {
    const result = await query(
      `SELECT time, value, metadata
       FROM metrics
       WHERE server_id = $1 AND metric_type = $2
       ORDER BY time DESC
       LIMIT $3`,
      [serverId, metricType, limit]
    );
    return result.rows;
  }

  static async getTimeRange(serverId, metricType, startTime, endTime) {
    const result = await query(
      `SELECT time, value, metadata
       FROM metrics
       WHERE server_id = $1 AND metric_type = $2 AND time BETWEEN $3 AND $4
       ORDER BY time ASC`,
      [serverId, metricType, startTime, endTime]
    );
    return result.rows;
  }

  static async getAggregated(serverId, metricType, interval = '1 hour', duration = '24 hours') {
    const result = await query(
      `SELECT
         time_bucket($1, time) AS bucket,
         AVG(value) as avg_value,
         MAX(value) as max_value,
         MIN(value) as min_value
       FROM metrics
       WHERE server_id = $2 AND metric_type = $3 AND time > NOW() - INTERVAL '${duration}'
       GROUP BY bucket
       ORDER BY bucket ASC`,
      [interval, serverId, metricType]
    );
    return result.rows;
  }

  static async getCurrent(serverId) {
    // Get the most recent value for each metric type
    const result = await query(
      `SELECT DISTINCT ON (metric_type)
         metric_type,
         value,
         time,
         metadata
       FROM metrics
       WHERE server_id = $1
       ORDER BY metric_type, time DESC`,
      [serverId]
    );
    return result.rows;
  }

  static async deleteOld(serverId, olderThan) {
    const result = await query(
      'DELETE FROM metrics WHERE server_id = $1 AND time < $2',
      [serverId, olderThan]
    );
    return result.rowCount;
  }
}

export default Metric;
