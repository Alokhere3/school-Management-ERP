const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Role = require('../models/Role');
const UserRole = require('../models/UserRole');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Staff = require('../models/Staff');
const Parent = require('../models/Parent');
const Class = require('../models/Class');
const Exam = require('../models/Exam');
const ParentStudent = require('../models/ParentStudent');
const { sequelize } = require('../config/database');
const logger = require('../config/logger');

async function listTenants() {
    return Tenant.findAll();
}

async function createTenant(payload) {
    return Tenant.create(payload);
}

async function getTenantById(id) {
    return Tenant.findByPk(id);
}

async function updateTenant(id, updates) {
    const t = await Tenant.findByPk(id);
    if (!t) return null;
    return t.update(updates);
}

/**
 * Delete tenant and all related data (cascading delete)
 * CRITICAL: Must delete in correct order to respect foreign key constraints
 * @param {string} id - Tenant ID
 * @returns {Object} Deletion result with counts of deleted records
 */
async function deleteTenant(id) {
    const transaction = await sequelize.transaction();
    
    try {
        const tenant = await Tenant.findByPk(id, { transaction });
        if (!tenant) return null;

        logger.info(`Starting cascading delete for tenant ${id}`);

        // Track deletion counts
        const deletionCounts = {
            tenantId: id,
            tenantName: tenant.name,
            parentStudents: 0,
            exams: 0,
            students: 0,
            teachers: 0,
            staff: 0,
            parents: 0,
            classes: 0,
            userRoles: 0,
            users: 0,
            roles: 0,
            tenant: 1
        };

        // Delete in order of dependencies (leaf nodes first)
        // 1. Delete ParentStudent (references Student, Parent)
        deletionCounts.parentStudents = await ParentStudent.destroy({ where: { tenantId: id }, transaction });
        logger.debug(`Deleted ${deletionCounts.parentStudents} parent-student mappings for tenant ${id}`);

        // 2. Delete Exam (references Class)
        deletionCounts.exams = await Exam.destroy({ where: { tenantId: id }, transaction });
        logger.debug(`Deleted ${deletionCounts.exams} exams for tenant ${id}`);

        // 3. Delete Students
        deletionCounts.students = await Student.destroy({ where: { tenantId: id }, transaction });
        logger.debug(`Deleted ${deletionCounts.students} students for tenant ${id}`);

        // 4. Delete Teachers
        deletionCounts.teachers = await Teacher.destroy({ where: { tenantId: id }, transaction });
        logger.debug(`Deleted ${deletionCounts.teachers} teachers for tenant ${id}`);

        // 5. Delete Staff
        deletionCounts.staff = await Staff.destroy({ where: { tenantId: id }, transaction });
        logger.debug(`Deleted ${deletionCounts.staff} staff for tenant ${id}`);

        // 6. Delete Parents
        deletionCounts.parents = await Parent.destroy({ where: { tenantId: id }, transaction });
        logger.debug(`Deleted ${deletionCounts.parents} parents for tenant ${id}`);

        // 7. Delete Classes
        deletionCounts.classes = await Class.destroy({ where: { tenantId: id }, transaction });
        logger.debug(`Deleted ${deletionCounts.classes} classes for tenant ${id}`);

        // 8. Delete UserRoles (references User, Role)
        deletionCounts.userRoles = await UserRole.destroy({ where: { tenantId: id }, transaction });
        logger.debug(`Deleted ${deletionCounts.userRoles} user roles for tenant ${id}`);

        // 9. Delete Users
        deletionCounts.users = await User.destroy({ where: { tenantId: id }, transaction });
        logger.debug(`Deleted ${deletionCounts.users} users for tenant ${id}`);

        // 10. Delete Roles (tenant-scoped roles)
        deletionCounts.roles = await Role.destroy({ where: { tenantId: id }, transaction });
        logger.debug(`Deleted ${deletionCounts.roles} roles for tenant ${id}`);

        // 11. Finally, delete the Tenant
        await tenant.destroy({ transaction });
        logger.info(`Successfully deleted tenant ${id} and all related data. Summary: ${JSON.stringify(deletionCounts)}`);

        await transaction.commit();
        return deletionCounts;
    } catch (error) {
        await transaction.rollback();
        logger.error(`Failed to delete tenant ${id}: ${error.message}`);
        throw error;
    }
}

module.exports = {
    listTenants,
    createTenant,
    getTenantById,
    updateTenant,
    deleteTenant
};
