require('dotenv').config();

const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Role = require('../models/Role');
const UserRole = require('../models/UserRole');

async function main() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Ensure system tenant exists
    let systemTenant = await Tenant.findOne({ where: { slug: 'system' } });
    if (!systemTenant) {
      console.log('📝 Creating system tenant...');
      systemTenant = await Tenant.create({ name: 'System', slug: 'system' });
      console.log('✅ System tenant created');
    } else {
      console.log('✅ System tenant exists:', systemTenant.id);
    }

    // Ensure Super Admin role exists (system role)
    let superRole = await Role.findOne({ where: { name: 'Super Admin', isSystemRole: true } });
    if (!superRole) {
      console.log('📝 Creating Super Admin role...');
      superRole = await Role.create({ name: 'Super Admin', description: 'System super administrator', isSystemRole: true, tenantId: null });
      console.log('✅ Created Super Admin role:', superRole.id);
    } else {
      console.log('✅ Super Admin role exists:', superRole.id);
    }

    const email = process.env.SUPER_ADMIN_EMAIL || 'alokhere3@gmail.com';
    const rawPassword = process.env.SUPER_ADMIN_PASSWORD || 'Alok@1234';

    let user = await User.findOne({ where: { email } });
    if (!user) {
      console.log(`📝 Creating super admin user (${email})...`);
      const hashed = await bcrypt.hash(rawPassword, 12);
      user = await User.create({ tenantId: systemTenant.id, email, passwordHash: hashed, mustChangePassword: false });
      console.log('✅ Created super admin user:', email);
    } else {
      console.log('ℹ️ Super admin user already exists:', email, ' (id:', user.id, ')');
    }

    // Assign UserRole (if not already). The DB `user_roles` table uses a string enum `role`,
    // so map the role name to the enum value (e.g. 'Super Admin' -> 'SUPER_ADMIN').
    const roleEnum = (superRole.name || 'SUPER_ADMIN').toUpperCase().replace(/\s+/g, '_');

    const existingUR = await sequelize.query(
      'SELECT id FROM user_roles WHERE userId = ? AND role = ? AND tenantId = ? LIMIT 1',
      { replacements: [user.id, roleEnum, systemTenant.id], type: sequelize.QueryTypes.SELECT }
    );

    if (!existingUR || existingUR.length === 0) {
      const { randomUUID } = require('crypto');
      const urId = randomUUID();
      await sequelize.query(
        'INSERT INTO user_roles (id, userId, role, tenantId) VALUES (?, ?, ?, ?)',
        { replacements: [urId, user.id, roleEnum, systemTenant.id] }
      );
      console.log('✅ Assigned Super Admin role to user (role enum:', roleEnum, ', id:', urId, ')');
    } else {
      console.log('ℹ️ User already has Super Admin role assigned');
    }

    console.log('\n✅ Super Admin setup completed');
    console.log('Credentials:');
    console.log('  Email:', email);
    console.log('  Password:', rawPassword);
    process.exit(0);
  } catch (err) {
    console.error('Failed to create super admin:', err && (err.message || err));
    process.exit(1);
  }
}

main();
