const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');
const User = require('../models/User');
const UserRole = require('../models/UserRole');
const Staff = require('../models/Staff');
const Student = require('../models/Student');
const Parent = require('../models/Parent');
const ParentStudent = require('../models/ParentStudent');
const { generateTempPassword } = require('../utils/passwordHelper');
const { sendError } = require('../utils/errorMapper');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../config/logger');

/**
 * Create staff with optional portal access
 * POST /api/v1/tenants/:tenantId/staff
 */
const createStaffWithUser = asyncHandler(async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { tenantId } = req.params;
        const {
            firstName,
            lastName,
            email,
            designation,
            department,
            employeeType,
            enablePortalAccess,
            role, // Role ENUM (TEACHER, STAFF, etc.)
            ...staffData
        } = req.body;

        // Validate tenantId matches user's tenant
        if (tenantId !== req.user.tenantId) {
            await transaction.rollback();
            return res.status(403).json({
                success: false,
                error: 'Cross-tenant access denied'
            });
        }

        // Validate email if portal access is enabled
        if (enablePortalAccess && !email) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                error: 'Email is required when enabling portal access'
            });
        }

        // Check if email already exists in tenant
        if (enablePortalAccess && email) {
            const existingUser = await User.findOne({
                where: { email, tenantId },
                transaction
            });
            if (existingUser) {
                await transaction.rollback();
                return res.status(409).json({
                    success: false,
                    error: 'Email already registered in this tenant',
                    code: 'EMAIL_TAKEN'
                });
            }
        }

        let userId = null;
        let tempPassword = null;

        // Create User if portal access is enabled
        if (enablePortalAccess && email) {
            tempPassword = generateTempPassword(12);
            const passwordHash = await bcrypt.hash(tempPassword, 14);

            const user = await User.create({
                tenantId,
                email,
                passwordHash,
                mustChangePassword: true,
                status: 'active'
            }, { transaction });

            userId = user.id;

            // Assign role if provided
            if (role) {
                // Find Role ID for the given role code (e.g. 'TEACHER')
                // Helper function or direct query needed here.
                // We'll trust the helper or do a direct lookup.
                const roleRecord = await sequelize.models.Role.findOne({
                    where: {
                        [sequelize.Sequelize.Op.or]: [
                            { code: role.toUpperCase().replace(/\s+/g, '_') },
                            { name: role } // Fallback
                        ],
                        [sequelize.Sequelize.Op.or]: [
                            { tenantId },
                            { isSystemRole: true }
                        ]
                    },
                    transaction
                });

                await UserRole.create({
                    userId: user.id,
                    tenantId,
                    roleId: roleRecord ? roleRecord.id : null,
                    role: role.toUpperCase().replace(/\s+/g, '_')
                }, { transaction });
            }
        }

        // Create Staff record
        const staff = await Staff.create({
            tenantId,
            userId,
            firstName,
            lastName,
            designation,
            department,
            employeeType,
            email: staffData.email || email,
            ...staffData
        }, { transaction });

        await transaction.commit();

        const response = {
            success: true,
            data: {
                staff: staff.toJSON(),
                credentials: enablePortalAccess && email ? {
                    email,
                    tempPassword,
                    mustChangePassword: true
                } : null
            }
        };

        res.status(201).json(response);
    } catch (err) {
        await transaction.rollback();
        logger.error('Error creating staff with user:', err);
        return sendError(res, err, 'Failed to create staff member');
    }
});

/**
 * Create student with parents and optional user accounts
 * POST /api/v1/tenants/:tenantId/admissions/create-with-users
 */
const createStudentWithParents = asyncHandler(async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { tenantId } = req.params;
        const {
            student,
            createStudentUser,
            parents = []
        } = req.body;

        // Validate tenantId matches user's tenant
        if (tenantId !== req.user.tenantId) {
            await transaction.rollback();
            return res.status(403).json({
                success: false,
                error: 'Cross-tenant access denied'
            });
        }

        // Create Student
        const studentRecord = await Student.create({
            tenantId,
            ...student
        }, { transaction });

        const credentials = [];

        // Process parents
        for (const parentData of parents) {
            const {
                name,
                email,
                phone,
                relation,
                createUser,
                isPrimary,
                ...parentFields
            } = parentData;

            // Check if parent exists by phone
            let parentRecord = await Parent.findOne({
                where: { tenantId, phone },
                transaction
            });

            if (!parentRecord) {
                // Create new parent
                let parentUserId = null;

                if (createUser && email) {
                    // Check if email already exists
                    const existingUser = await User.findOne({
                        where: { email, tenantId },
                        transaction
                    });

                    if (existingUser) {
                        parentUserId = existingUser.id;
                    } else {
                        // Create user for parent
                        const tempPassword = generateTempPassword(12);
                        const passwordHash = await bcrypt.hash(tempPassword, 14);

                        const user = await User.create({
                            tenantId,
                            email,
                            passwordHash,
                            mustChangePassword: true,
                            status: 'active'
                        }, { transaction });

                        parentUserId = user.id;

                        // Find PARENT role
                        const parentRole = await sequelize.models.Role.findOne({
                            where: {
                                code: 'PARENT',
                                [sequelize.Sequelize.Op.or]: [{ tenantId }, { isSystemRole: true }]
                            },
                            transaction
                        });

                        // Assign PARENT role
                        await UserRole.create({
                            userId: user.id,
                            tenantId,
                            roleId: parentRole ? parentRole.id : null,
                            role: 'PARENT'
                        }, { transaction });

                        credentials.push({
                            type: 'PARENT',
                            email,
                            tempPassword,
                            method: 'email'
                        });
                    }
                }

                parentRecord = await Parent.create({
                    tenantId,
                    userId: parentUserId,
                    name,
                    email,
                    phone,
                    relation,
                    ...parentFields
                }, { transaction });
            }

            // Create ParentStudent link
            await ParentStudent.create({
                tenantId,
                parentId: parentRecord.id,
                studentId: studentRecord.id,
                relation: relation || 'Other',
                isPrimary: isPrimary || false
            }, { transaction });
        }

        // Create Student User if requested
        if (createStudentUser && student.studentEmail) {
            // Check if email already exists
            const existingUser = await User.findOne({
                where: { email: student.studentEmail, tenantId },
                transaction
            });

            if (!existingUser) {
                const tempPassword = generateTempPassword(12);
                const passwordHash = await bcrypt.hash(tempPassword, 14);

                const user = await User.create({
                    tenantId,
                    email: student.studentEmail,
                    passwordHash,
                    mustChangePassword: true,
                    status: 'active'
                }, { transaction });

                // Update student with userId
                await studentRecord.update({ userId: user.id }, { transaction });

                // Find STUDENT role
                const studentRole = await sequelize.models.Role.findOne({
                    where: {
                        code: 'STUDENT',
                        [sequelize.Sequelize.Op.or]: [{ tenantId }, { isSystemRole: true }]
                    },
                    transaction
                });

                // Assign STUDENT role
                await UserRole.create({
                    userId: user.id,
                    tenantId,
                    roleId: studentRole ? studentRole.id : null,
                    role: 'STUDENT'
                }, { transaction });

                credentials.push({
                    type: 'STUDENT',
                    email: student.studentEmail,
                    tempPassword,
                    method: 'email'
                });
            }
        }

        await transaction.commit();

        res.status(201).json({
            success: true,
            data: {
                student: studentRecord.toJSON(),
                credentials
            }
        });
    } catch (err) {
        await transaction.rollback();
        logger.error('Error creating student with parents:', err);
        return sendError(res, err, 'Failed to create student and parents');
    }
});

module.exports = {
    createStaffWithUser,
    createStudentWithParents
};


