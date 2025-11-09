import bcrypt from 'bcryptjs';

// Generate bcrypt hash for admin password
const password = 'admin123';
const salt = await bcrypt.genSalt(10);
const hash = await bcrypt.hash(password, salt);

console.log('Password:', password);
console.log('Hash:', hash);
console.log('\nUse this hash in init-db.sql for the admin user');
