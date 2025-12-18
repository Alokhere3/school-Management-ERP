'use strict';

/**
 * Migration: Add Performance Indexes
 * 
 * Adds indexes to improve query performance based on security and performance analysis.
 * These indexes optimize:
 * - User role lookups
 * - Student queries by tenant, user, teacher, parent
 * - Permission checks
 * - Class-based and date-based queries
 */

module.exports = {
    async up(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            // ========== STUDENTS TABLE INDEXES ==========
            console.log('Adding indexes to students table...');
            
            // Check if indexes exist before adding
            const [studentIndexes] = await queryInterface.sequelize.query(
                `SHOW INDEXES FROM students WHERE Key_name IN (
                    'students_tenantId_userId',
                    'students_tenantId_teacherId',
                    'students_tenantId_parentOf',
                    'students_tenantId_admissionClass',
                    'students_tenantId_onboardingCompleted',
                    'students_createdAt',
                    'students_status_createdAt'
                )`
            );
            
            const existingStudentIndexes = studentIndexes.map(idx => idx.Key_name);
            
            if (!existingStudentIndexes.includes('students_tenantId_userId')) {
                await queryInterface.addIndex('students', ['tenantId', 'userId'], {
                    name: 'students_tenantId_userId',
                    transaction
                });
                console.log('  ✓ Added index: students_tenantId_userId');
            }
            
            if (!existingStudentIndexes.includes('students_tenantId_teacherId')) {
                await queryInterface.addIndex('students', ['tenantId', 'teacherId'], {
                    name: 'students_tenantId_teacherId',
                    transaction
                });
                console.log('  ✓ Added index: students_tenantId_teacherId');
            }
            
            if (!existingStudentIndexes.includes('students_tenantId_parentOf')) {
                await queryInterface.addIndex('students', ['tenantId', 'parentOf'], {
                    name: 'students_tenantId_parentOf',
                    transaction
                });
                console.log('  ✓ Added index: students_tenantId_parentOf');
            }
            
            if (!existingStudentIndexes.includes('students_tenantId_admissionClass')) {
                await queryInterface.addIndex('students', ['tenantId', 'admissionClass'], {
                    name: 'students_tenantId_admissionClass',
                    transaction
                });
                console.log('  ✓ Added index: students_tenantId_admissionClass');
            }
            
            if (!existingStudentIndexes.includes('students_tenantId_onboardingCompleted')) {
                await queryInterface.addIndex('students', ['tenantId', 'onboardingCompleted'], {
                    name: 'students_tenantId_onboardingCompleted',
                    transaction
                });
                console.log('  ✓ Added index: students_tenantId_onboardingCompleted');
            }
            
            if (!existingStudentIndexes.includes('students_createdAt')) {
                await queryInterface.addIndex('students', ['createdAt'], {
                    name: 'students_createdAt',
                    transaction
                });
                console.log('  ✓ Added index: students_createdAt');
            }
            
            if (!existingStudentIndexes.includes('students_status_createdAt')) {
                await queryInterface.addIndex('students', ['status', 'createdAt'], {
                    name: 'students_status_createdAt',
                    transaction
                });
                console.log('  ✓ Added index: students_status_createdAt');
            }
            
            // ========== USERS TABLE INDEXES ==========
            console.log('Adding indexes to users table...');
            
            const [userIndexes] = await queryInterface.sequelize.query(
                `SHOW INDEXES FROM users WHERE Key_name IN (
                    'users_email',
                    'users_tenantId_email',
                    'users_tenantId_role'
                )`
            );
            
            const existingUserIndexes = userIndexes.map(idx => idx.Key_name);
            
            // Email index might already exist (unique constraint), but ensure it's there
            if (!existingUserIndexes.includes('users_email')) {
                await queryInterface.addIndex('users', ['email'], {
                    name: 'users_email',
                    transaction
                });
                console.log('  ✓ Added index: users_email');
            }
            
            if (!existingUserIndexes.includes('users_tenantId_email')) {
                await queryInterface.addIndex('users', ['tenantId', 'email'], {
                    name: 'users_tenantId_email',
                    transaction
                });
                console.log('  ✓ Added index: users_tenantId_email');
            }
            
            if (!existingUserIndexes.includes('users_tenantId_role')) {
                await queryInterface.addIndex('users', ['tenantId', 'role'], {
                    name: 'users_tenantId_role',
                    transaction
                });
                console.log('  ✓ Added index: users_tenantId_role');
            }
            
            // ========== USER_ROLES TABLE INDEXES ==========
            console.log('Adding indexes to user_roles table...');
            
            const [userRoleIndexes] = await queryInterface.sequelize.query(
                `SHOW INDEXES FROM user_roles WHERE Key_name IN (
                    'user_roles_userId_tenantId',
                    'user_roles_roleId',
                    'user_roles_userId_roleId_tenantId'
                )`
            );
            
            const existingUserRoleIndexes = userRoleIndexes.map(idx => idx.Key_name);
            
            if (!existingUserRoleIndexes.includes('user_roles_userId_tenantId')) {
                await queryInterface.addIndex('user_roles', ['userId', 'tenantId'], {
                    name: 'user_roles_userId_tenantId',
                    transaction
                });
                console.log('  ✓ Added index: user_roles_userId_tenantId');
            }
            
            if (!existingUserRoleIndexes.includes('user_roles_roleId')) {
                await queryInterface.addIndex('user_roles', ['roleId'], {
                    name: 'user_roles_roleId',
                    transaction
                });
                console.log('  ✓ Added index: user_roles_roleId');
            }
            
            // Unique constraint for userId + roleId + tenantId
            if (!existingUserRoleIndexes.includes('user_roles_userId_roleId_tenantId')) {
                await queryInterface.addIndex('user_roles', ['userId', 'roleId', 'tenantId'], {
                    name: 'user_roles_userId_roleId_tenantId',
                    unique: true,
                    transaction
                });
                console.log('  ✓ Added unique index: user_roles_userId_roleId_tenantId');
            }
            
            // ========== ROLE_PERMISSIONS TABLE INDEXES ==========
            console.log('Adding indexes to role_permissions table...');
            
            const [rolePermissionIndexes] = await queryInterface.sequelize.query(
                `SHOW INDEXES FROM role_permissions WHERE Key_name IN (
                    'role_permissions_roleId',
                    'role_permissions_permissionId'
                )`
            );
            
            const existingRolePermissionIndexes = rolePermissionIndexes.map(idx => idx.Key_name);
            
            // roleId index might already exist (from unique constraint), but ensure it's there
            if (!existingRolePermissionIndexes.includes('role_permissions_roleId')) {
                await queryInterface.addIndex('role_permissions', ['roleId'], {
                    name: 'role_permissions_roleId',
                    transaction
                });
                console.log('  ✓ Added index: role_permissions_roleId');
            }
            
            if (!existingRolePermissionIndexes.includes('role_permissions_permissionId')) {
                await queryInterface.addIndex('role_permissions', ['permissionId'], {
                    name: 'role_permissions_permissionId',
                    transaction
                });
                console.log('  ✓ Added index: role_permissions_permissionId');
            }
            
            await transaction.commit();
            console.log('✅ All performance indexes added successfully');
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Error adding indexes:', error.message);
            throw error;
        }
    },

    async down(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            console.log('Removing performance indexes...');
            
            // Remove indexes in reverse order
            const indexesToRemove = [
                // Students
                'students_status_createdAt',
                'students_createdAt',
                'students_tenantId_onboardingCompleted',
                'students_tenantId_admissionClass',
                'students_tenantId_parentOf',
                'students_tenantId_teacherId',
                'students_tenantId_userId',
                // Users
                'users_tenantId_role',
                'users_tenantId_email',
                // User Roles
                'user_roles_userId_roleId_tenantId',
                'user_roles_roleId',
                'user_roles_userId_tenantId',
                // Role Permissions
                'role_permissions_permissionId',
                'role_permissions_roleId'
            ];
            
            for (const indexName of indexesToRemove) {
                try {
                    const [tableName] = indexName.split('_');
                    await queryInterface.removeIndex(tableName, indexName, { transaction });
                    console.log(`  ✓ Removed index: ${indexName}`);
                } catch (err) {
                    // Index might not exist, continue
                    console.log(`  - Index ${indexName} not found, skipping`);
                }
            }
            
            await transaction.commit();
            console.log('✅ All performance indexes removed');
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Error removing indexes:', error.message);
            throw error;
        }
    }
};

