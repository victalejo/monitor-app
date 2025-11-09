import { query } from '../config/database.js';

class AlertRule {
  static async findAll(serverId = null) {
    if (serverId) {
      const result = await query(
        'SELECT * FROM alert_rules WHERE server_id = $1 ORDER BY created_at DESC',
        [serverId]
      );
      return result.rows;
    }
    const result = await query('SELECT * FROM alert_rules ORDER BY created_at DESC');
    return result.rows;
  }

  static async findById(id) {
    const result = await query('SELECT * FROM alert_rules WHERE id = $1', [id]);
    return result.rows[0];
  }

  static async findEnabled() {
    const result = await query('SELECT * FROM alert_rules WHERE enabled = true');
    return result.rows;
  }

  static async create(serverId, name, metricType, condition, threshold, duration = 60) {
    const result = await query(
      `INSERT INTO alert_rules (server_id, name, metric_type, condition, threshold, duration, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING *`,
      [serverId, name, metricType, condition, threshold, duration]
    );
    return result.rows[0];
  }

  static async update(id, data) {
    const { name, metricType, condition, threshold, duration, enabled } = data;
    const result = await query(
      `UPDATE alert_rules
       SET name = COALESCE($1, name),
           metric_type = COALESCE($2, metric_type),
           condition = COALESCE($3, condition),
           threshold = COALESCE($4, threshold),
           duration = COALESCE($5, duration),
           enabled = COALESCE($6, enabled),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [name, metricType, condition, threshold, duration, enabled, id]
    );
    return result.rows[0];
  }

  static async toggle(id, enabled) {
    const result = await query(
      'UPDATE alert_rules SET enabled = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [enabled, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await query('DELETE FROM alert_rules WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }

  static evaluateCondition(condition, currentValue, threshold) {
    switch (condition) {
      case 'gt':
        return currentValue > threshold;
      case 'gte':
        return currentValue >= threshold;
      case 'lt':
        return currentValue < threshold;
      case 'lte':
        return currentValue <= threshold;
      case 'eq':
        return currentValue === threshold;
      default:
        return false;
    }
  }
}

export default AlertRule;
