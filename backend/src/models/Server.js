import { query } from '../config/database.js';
import crypto from 'crypto';

class Server {
  static async findAll(companyId = null) {
    if (companyId) {
      const result = await query(
        'SELECT * FROM servers WHERE company_id = $1 ORDER BY created_at DESC',
        [companyId]
      );
      return result.rows;
    }
    const result = await query('SELECT * FROM servers ORDER BY created_at DESC');
    return result.rows;
  }

  static async findById(id) {
    const result = await query('SELECT * FROM servers WHERE id = $1', [id]);
    return result.rows[0];
  }

  static async findByApiKey(apiKey) {
    const result = await query('SELECT * FROM servers WHERE api_key = $1', [apiKey]);
    return result.rows[0];
  }

  static async create(companyId, name, hostname, ipAddress, description = null) {
    // Generate unique API key for the server
    const apiKey = crypto.randomBytes(32).toString('hex');

    const result = await query(
      `INSERT INTO servers (company_id, name, hostname, ip_address, api_key, description, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'offline')
       RETURNING *`,
      [companyId, name, hostname, ipAddress, apiKey, description]
    );
    return result.rows[0];
  }

  static async update(id, data) {
    const { name, hostname, ipAddress, description, status } = data;
    const result = await query(
      `UPDATE servers
       SET name = COALESCE($1, name),
           hostname = COALESCE($2, hostname),
           ip_address = COALESCE($3, ip_address),
           description = COALESCE($4, description),
           status = COALESCE($5, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [name, hostname, ipAddress, description, status, id]
    );
    return result.rows[0];
  }

  static async updateStatus(id, status, lastSeen = new Date()) {
    const result = await query(
      'UPDATE servers SET status = $1, last_seen = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [status, lastSeen, id]
    );
    return result.rows[0];
  }

  static async updateLastSeen(id) {
    const result = await query(
      'UPDATE servers SET last_seen = CURRENT_TIMESTAMP, status = $1 WHERE id = $2 RETURNING *',
      ['online', id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await query('DELETE FROM servers WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }

  static async regenerateApiKey(id) {
    const apiKey = crypto.randomBytes(32).toString('hex');
    const result = await query(
      'UPDATE servers SET api_key = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [apiKey, id]
    );
    return result.rows[0];
  }

  static async getLatestMetrics(serverId, limit = 10) {
    const result = await query(
      `SELECT * FROM metrics
       WHERE server_id = $1
       ORDER BY time DESC
       LIMIT $2`,
      [serverId, limit]
    );
    return result.rows;
  }
}

export default Server;
