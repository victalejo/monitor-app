import { query } from '../config/database.js';

class Incident {
  static async findAll(filters = {}) {
    let sql = 'SELECT * FROM incidents WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (filters.serverId) {
      sql += ` AND server_id = $${paramIndex}`;
      params.push(filters.serverId);
      paramIndex++;
    }

    if (filters.status) {
      sql += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.severity) {
      sql += ` AND severity = $${paramIndex}`;
      params.push(filters.severity);
      paramIndex++;
    }

    sql += ' ORDER BY triggered_at DESC';

    if (filters.limit) {
      sql += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
    }

    const result = await query(sql, params);
    return result.rows;
  }

  static async findById(id) {
    const result = await query('SELECT * FROM incidents WHERE id = $1', [id]);
    return result.rows[0];
  }

  static async findOpen(serverId = null) {
    if (serverId) {
      const result = await query(
        "SELECT * FROM incidents WHERE status = 'open' AND server_id = $1 ORDER BY triggered_at DESC",
        [serverId]
      );
      return result.rows;
    }
    const result = await query(
      "SELECT * FROM incidents WHERE status = 'open' ORDER BY triggered_at DESC"
    );
    return result.rows;
  }

  static async create(data) {
    const {
      alertRuleId = null,
      serverId,
      serviceId = null,
      incidentType,
      severity = 'warning',
      title,
      description = null,
      metadata = null,
    } = data;

    const result = await query(
      `INSERT INTO incidents
       (alert_rule_id, server_id, service_id, incident_type, severity, title, description, status, triggered_at, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', CURRENT_TIMESTAMP, $8)
       RETURNING *`,
      [alertRuleId, serverId, serviceId, incidentType, severity, title, description, metadata]
    );
    return result.rows[0];
  }

  static async acknowledge(id) {
    const result = await query(
      "UPDATE incidents SET status = 'acknowledged', acknowledged_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
      [id]
    );
    return result.rows[0];
  }

  static async resolve(id) {
    const result = await query(
      "UPDATE incidents SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
      [id]
    );
    return result.rows[0];
  }

  static async updateStatus(id, status) {
    const result = await query('UPDATE incidents SET status = $1 WHERE id = $2 RETURNING *', [
      status,
      id,
    ]);
    return result.rows[0];
  }

  static async getStats(serverId = null, duration = '7 days') {
    let sql = `
      SELECT
        COUNT(*) as total_incidents,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_incidents,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_incidents,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_incidents
      FROM incidents
      WHERE triggered_at > NOW() - INTERVAL '${duration}'
    `;

    const params = [];
    if (serverId) {
      sql += ' AND server_id = $1';
      params.push(serverId);
    }

    const result = await query(sql, params);
    return result.rows[0];
  }

  static async deleteOld(olderThan) {
    const result = await query(
      "DELETE FROM incidents WHERE status = 'resolved' AND resolved_at < $1",
      [olderThan]
    );
    return result.rowCount;
  }
}

export default Incident;
