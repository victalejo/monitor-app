import { query } from '../config/database.js';

class Company {
  static async findAll() {
    const result = await query('SELECT * FROM companies ORDER BY created_at DESC');
    return result.rows;
  }

  static async findById(id) {
    const result = await query('SELECT * FROM companies WHERE id = $1', [id]);
    return result.rows[0];
  }

  static async create(name, description = null) {
    const result = await query(
      'INSERT INTO companies (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    return result.rows[0];
  }

  static async update(id, name, description) {
    const result = await query(
      'UPDATE companies SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [name, description, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await query('DELETE FROM companies WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }

  static async getServerCount(companyId) {
    const result = await query(
      'SELECT COUNT(*) as count FROM servers WHERE company_id = $1',
      [companyId]
    );
    return parseInt(result.rows[0].count);
  }

  static async getStats(companyId) {
    const result = await query(
      `SELECT
        COUNT(*) as total_servers,
        SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online_servers,
        SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline_servers,
        SUM(CASE WHEN status = 'warning' THEN 1 ELSE 0 END) as warning_servers
      FROM servers
      WHERE company_id = $1`,
      [companyId]
    );
    return result.rows[0];
  }
}

export default Company;
