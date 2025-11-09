import { query } from '../config/database.js';
import bcrypt from 'bcryptjs';

class User {
  static async findAll() {
    const result = await query('SELECT id, username, email, created_at, updated_at FROM users');
    return result.rows;
  }

  static async findById(id) {
    const result = await query(
      'SELECT id, username, email, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async findByUsername(username) {
    const result = await query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0];
  }

  static async create(username, password, email = null) {
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await query(
      'INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
      [username, passwordHash, email]
    );
    return result.rows[0];
  }

  static async update(id, data) {
    const { email } = data;
    const result = await query(
      `UPDATE users
       SET email = COALESCE($1, email),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, username, email, created_at, updated_at`,
      [email, id]
    );
    return result.rows[0];
  }

  static async updatePassword(id, newPassword) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    const result = await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, username, email',
      [passwordHash, id]
    );
    return result.rows[0];
  }

  static async verifyPassword(username, password) {
    const user = await this.findByUsername(username);
    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return null;
    }

    // Return user without password hash
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  static async delete(id) {
    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id, username', [id]);
    return result.rows[0];
  }
}

export default User;
