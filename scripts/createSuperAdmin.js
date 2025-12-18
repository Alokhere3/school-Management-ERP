const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Role = require('../models/Role');
const UserRole = require('../models/UserRole');

async function main() {
  try {
    // Ensure DB connection
    await sequelize.authenticate();

    // Ensure system tenant exists
    let systemTenant = await Tenant.findOne({ where: { slug: 'system' } });
    if (!systemTenant) {
      systemTenant = await Tenant.create({ name: 'System', slug: 'system' });
      console.log('✅ System tenant created:', systemTenant.id);
    } else {
      console.log('ℹ️ System tenant exists:', systemTenant.id);
    }

    // Ensure Super Admin role exists (system role)
    let superRole = await Role.findOne({ where: { name: 'Super Admin' } });
    if (!superRole) {
      superRole = await Role.create({ name: 'Super Admin', description: 'System super administrator', isSystemRole: true, tenantId: null });
      console.log('✅ Created Super Admin role:', superRole.id);
    } else {
      console.log('ℹ️ Super Admin role exists:', superRole.id);
    }

    const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@gmail.com';
    const rawPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin@123';

    let user = await User.findOne({ where: { email } });
    if (!user) {
      const hashed = await bcrypt.hash(rawPassword, 12);
      user = await User.create({ tenantId: systemTenant.id, email, password: hashed, role: 'admin' });
      console.log('✅ Created super admin user:', email);
    } else {
      console.log('ℹ️ Super admin user already exists:', email);
    }

    // Assign UserRole (if not already)
    const existingUR = await UserRole.findOne({ where: { userId: user.id, roleId: superRole.id, tenantId: systemTenant.id } });
    if (!existingUR) {
      await UserRole.create({ userId: user.id, roleId: superRole.id, tenantId: systemTenant.id });
      console.log('✅ Assigned Super Admin role to user');
    } else {
      console.log('ℹ️ User already has Super Admin role assigned');
    }

    console.log('✅ Super Admin setup completed');
    process.exit(0);
  } catch (err) {
    console.error('Failed to create super admin:', err && err.message);
    process.exit(1);
  }
}

main();
