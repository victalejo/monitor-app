import { query } from '../config/database.js';

class Service {
  static async findAll(serverId = null) {
    if (serverId) {
      const result = await query(
        'SELECT * FROM services WHERE server_id = $1 ORDER BY created_at DESC',
        [serverId]
      );
      return result.rows;
    }
    const result = await query('SELECT * FROM services ORDER BY created_at DESC');
    return result.rows;
  }

  static async findById(id) {
    const result = await query('SELECT * FROM services WHERE id = $1', [id]);
    return result.rows[0];
  }

  static async create(data) {
    const {
      serverId,
      serviceType,
      name,
      endpoint,
      expectedStatusCode = 200,
      checkInterval = 60,
      timeout = 10,
    } = data;

    const result = await query(
      `INSERT INTO services
       (server_id, service_type, name, endpoint, expected_status_code, check_interval, timeout, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'unknown')
       RETURNING *`,
      [serverId, serviceType, name, endpoint, expectedStatusCode, checkInterval, timeout]
    );
    return result.rows[0];
  }

  static async update(id, data) {
    const { name, endpoint, expectedStatusCode, checkInterval, timeout } = data;
    const result = await query(
      `UPDATE services
       SET name = COALESCE($1, name),
           endpoint = COALESCE($2, endpoint),
           expected_status_code = COALESCE($3, expected_status_code),
           check_interval = COALESCE($4, check_interval),
           timeout = COALESCE($5, timeout),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [name, endpoint, expectedStatusCode, checkInterval, timeout, id]
    );
    return result.rows[0];
  }

  static async updateStatus(id, status, lastChecked = new Date()) {
    const result = await query(
      'UPDATE services SET status = $1, last_checked = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [status, lastChecked, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await query('DELETE FROM services WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }

  static async recordCheck(serviceId, status, responseTime = null, statusCode = null, errorMessage = null) {
    const result = await query(
      `INSERT INTO service_checks (time, service_id, status, response_time, status_code, error_message)
       VALUES (CURRENT_TIMESTAMP, $1, $2, $3, $4, $5)
       RETURNING *`,
      [serviceId, status, responseTime, statusCode, errorMessage]
    );
    return result.rows[0];
  }

  static async getCheckHistory(serviceId, limit = 100) {
    const result = await query(
      `SELECT * FROM service_checks
       WHERE service_id = $1
       ORDER BY time DESC
       LIMIT $2`,
      [serviceId, limit]
    );
    return result.rows;
  }

  static async getUptime(serviceId, duration = '24 hours') {
    const result = await query(
      `SELECT
         COUNT(*) as total_checks,
         SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as successful_checks,
         ROUND(
           (SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END)::NUMERIC / COUNT(*)::NUMERIC) * 100,
           2
         ) as uptime_percentage
       FROM service_checks
       WHERE service_id = $1 AND time > NOW() - INTERVAL '${duration}'`,
      [serviceId]
    );
    return result.rows[0];
  }
}

export default Service;
