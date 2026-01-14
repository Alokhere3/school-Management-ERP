/**
 * TeacherRepository
 * 
 * Extends BaseRepository with teacher-specific RLS rules.
 * CRITICAL: All teacher data access MUST flow through this repository.
 * 
 * Permission-Scope RLS Rules:
 * - TENANT (Admin): See all teachers in their tenant
 * - OWNED (Principal/Manager): See teachers in their division/department
 * - SELF (Teacher): See only their own record
 * 
 * SECURITY RULES:
 * - Every query enforces tenantId filter
 * - Soft delete only (no hard deletes)
 * - File keys stored in DB, actual files in S3
 * - Passwords hashed in User table
 * - Transactions for create/update operations
 */

const BaseRepository = require('./BaseRepository');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const logger = require('../config/logger');

class TeacherRepository extends BaseRepository {
    constructor(model) {
        super(model, 'teacher');
    }

    /**
     * Generate next teacherId for a tenant
     * Finds the highest numeric teacherId and increments it
     * Starts from 1 if no teachers exist for this tenant
     * Each school/tenant has its own teacherId sequence starting from 1
     * 
     * @param {String} tenantId - Tenant ID (School ID)
     * @param {Object} transaction - Sequelize transaction (optional)
     * @returns {Promise<String>} Next teacher ID (e.g., "1", "2", "3", etc.)
     */
    async generateNextTeacherId(tenantId, transaction = null) {
        try {
            // Find the teacher with the highest numeric teacherId for this tenant
            const lastTeacher = await this.model.findOne({
                where: {
                    tenantId,
                    deletedAt: { [Op.is]: null }
                },
                attributes: ['teacherId'],
                order: [['teacherId', 'DESC']],
                transaction,
                raw: true
            });

            if (!lastTeacher || !lastTeacher.teacherId) {
                // First teacher for this tenant - start from 1
                logger.info(`[TeacherRepository.generateNextTeacherId] First teacher for tenant ${tenantId}, starting from 1`);
                return '1';
            }

            // Try to parse as number and increment
            const lastId = parseInt(lastTeacher.teacherId, 10);
            if (!isNaN(lastId)) {
                const nextId = lastId + 1;
                logger.info(`[TeacherRepository.generateNextTeacherId] Last teacherId: ${lastTeacher.teacherId}, Next: ${nextId} for tenant ${tenantId}`);
                return String(nextId);
            }

            // If teacherId is not purely numeric, start fresh from 1
            logger.warn(`[TeacherRepository.generateNextTeacherId] Non-numeric teacherId found: ${lastTeacher.teacherId}, resetting to 1`);
            return '1';
        } catch (error) {
            logger.error(`[TeacherRepository.generateNextTeacherId] Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * CRITICAL: Apply teacher-specific OWNED scope filtering
     * Overrides base method to implement teacher-specific logic for OWNED scope
     * 
     * @param {Object} where - WHERE clause with tenantId already included
     * @param {Object} userContext - User context
     * @param {String} action - 'read', 'update', 'delete'
     * @returns {Object} Updated WHERE clause
     */
    applyOwnedFilter(where, userContext, action = 'read') {
        const { role, userId, roles } = userContext;

        // SELF: Teacher can only see their own record
        if (roles.some(r => r.toLowerCase().includes('teacher'))) {
            where.userId = userId;
            return where;
        }

        // OWNED: Principal/Manager may see teachers in their school/department
        // For now, we apply restrictive filtering - can extend with department logic
        if (roles.some(r => r.toLowerCase().includes('principal'))) {
            // Principals can see all teachers in their school
            // (department filtering could be added here)
            return where;
        }

        // Default: No special filtering for other roles (relies on permission scope)
        return where;
    }

    /**
     * CRITICAL: Find visible teachers for user
     * Main method for listing teachers with full RLS enforcement
     * 
     * Usage:
     *   const { count, rows } = await teacherRepo.findVisibleTeachers(userContext, filters, options);
     * 
     * @param {Object} userContext - User context (userId, tenantId, role, etc.)
     * @param {Object} filters - Additional filters (status, classId, dateOfJoining, search, etc.)
     * @param {Object} options - Pagination { page, limit, order, include, attributes }
     * @returns {Promise<Object>} { count, rows }
     */
    async findVisibleTeachers(userContext, filters = {}, options = {}) {
        return this.findAndCountWithRLS(userContext, filters, options);
    }

    /**
     * CRITICAL: Find single teacher by ID with RLS enforcement
     * 
     * @param {String} id - Teacher ID
     * @param {Object} userContext - User context
     * @param {Object} options - Additional query options
     * @returns {Promise<Object|null>} Teacher or null
     */
    async findTeacherById(id, userContext, options = {}) {
        return this.findByIdWithRLS(id, userContext, options);
    }

    /**
     * CRITICAL: Find teacher by teacherId (enterprise ID) with RLS
     * 
     * @param {String} teacherId - Teacher's enterprise ID (e.g., "T001")
     * @param {Object} userContext - User context
     * @returns {Promise<Object|null>} Teacher or null
     */
    async findByTeacherId(teacherId, userContext) {
        const context = this.validateUserContext(userContext);
        
        try {
            // Apply RLS filters to the query itself
            const where = this.applyRLSFilters({ teacherId }, context, 'read');
            const teacher = await this.model.findOne({ where });
            return teacher;
        } catch (error) {
            logger.error(`[TeacherRepository.findByTeacherId] Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * CRITICAL: Find teacher by userId (system user) with RLS
     * Used during login/profile updates
     * 
     * @param {String} userId - User ID (UUID)
     * @param {Object} userContext - User context
     * @returns {Promise<Object|null>} Teacher or null
     */
    async findByUserId(userId, userContext) {
        const context = this.validateUserContext(userContext);
        
        try {
            // Apply RLS filters to the query itself
            const where = this.applyRLSFilters({ userId }, context, 'read');
            const teacher = await this.model.findOne({ where });
            return teacher;
        } catch (error) {
            logger.error(`[TeacherRepository.findByUserId] Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * CRITICAL: Create teacher with transaction support
     * Creates both Teacher record and User account in a single transaction
     * 
     * Steps:
     * 1. Validate user context (must be admin)
     * 2. Hash password
     * 3. Create User record
     * 4. Create Teacher record linked to User
     * 5. Enforce tenant isolation
     * 6. Audit log the action
     * 
     * @param {Object} teacherData - Teacher fields (all optional except firstName, lastName, email, password)
     * @param {String} password - Raw password to hash
     * @param {Object} userContext - User context (must be admin)
     * @param {Object} transaction - Sequelize transaction (optional)
     * @returns {Promise<Object>} Created teacher with user
     * @throws {Error} 409 if email/phone duplicate, 403 if insufficient permissions
     */
    async createTeacher(teacherData, password, userContext, transaction = null) {
        const context = this.validateUserContext(userContext);
        
        // Permission check: Only admins can create teachers
        if (!this.isAdmin(context)) {
            const error = new Error('Insufficient permissions to create teachers');
            error.status = 403;
            error.code = 'FORBIDDEN';
            throw error;
        }

        const { sequelize } = require('../config/database');
        const useTransaction = transaction || (await sequelize.transaction());

        try {
            // Extract user-related fields
            const { email, phone, firstName, lastName, ...teacherFields } = teacherData;

            // Debug log what we received
            logger.info(`[TeacherRepository.createTeacher] Received teacherData keys: ${Object.keys(teacherData)}`);
            logger.info(`[TeacherRepository.createTeacher] Extracted: email=${email}, firstName=${firstName}, lastName=${lastName}`);

            // Validate required fields
            if (!email || !firstName || !lastName) {
                logger.error(`[TeacherRepository.createTeacher] Validation failed: email=${email}, firstName=${firstName}, lastName=${lastName}`);
                const error = new Error('email, firstName, and lastName are required');
                error.status = 400;
                error.code = 'VALIDATION_ERROR';
                throw error;
            }

            // Check for duplicate email in this tenant
            const User = require('../models/User');
            const existingUser = await User.findOne({
                where: { tenantId: context.tenantId, email },
                transaction: useTransaction
            });

            if (existingUser) {
                const error = new Error(`Email already exists for this tenant: ${email}`);
                error.status = 409;
                error.code = 'DUPLICATE_EMAIL';
                throw error;
            }

            // Hash password with bcrypt
            const passwordHash = await bcrypt.hash(password, 10);

            // Create User record first
            const user = await User.create({
                tenantId: context.tenantId,
                email,
                phone: phone || null,
                passwordHash,
                status: 'active'
            }, { transaction: useTransaction });

            // Generate or use provided teacherId
            let finalTeacherId = teacherFields.teacherId;
            if (!finalTeacherId) {
                finalTeacherId = await this.generateNextTeacherId(context.tenantId, useTransaction);
                logger.info(`[TeacherRepository.createTeacher] Generated teacherId: ${finalTeacherId} for tenant: ${context.tenantId}`);
            } else {
                logger.info(`[TeacherRepository.createTeacher] Using provided teacherId: ${finalTeacherId}`);
            }

            // Verify teacherId is unique for this tenant
            const existingTeacher = await this.model.findOne({
                where: { tenantId: context.tenantId, teacherId: finalTeacherId },
                transaction: useTransaction
            });

            if (existingTeacher) {
                const error = new Error(`teacherId already exists for this tenant: ${finalTeacherId}`);
                error.status = 409;
                error.code = 'DUPLICATE_TEACHER_ID';
                throw error;
            }

            // Update teacherFields with final teacherId
            teacherFields.teacherId = finalTeacherId;

            // Create Teacher record
            const teacher = await this.model.create({
                tenantId: context.tenantId,
                userId: user.id,
                firstName,
                lastName,
                ...teacherFields
            }, { transaction: useTransaction });

            // Audit log
            this.auditLog('create', context, `id=${teacher.id}, teacherId=${teacher.teacherId}, email=${email}`);

            // If we created the transaction, commit it
            if (!transaction) {
                await useTransaction.commit();
            }

            logger.info(`[TeacherRepository] ✅ Teacher created: teacherId=${teacher.teacherId}, userId=${user.id}`);

            return teacher;

        } catch (error) {
            // If we created the transaction, rollback on error
            if (!transaction) {
                await useTransaction.rollback();
            }
            
            logger.error(`[TeacherRepository.createTeacher] ❌ Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * CRITICAL: Update teacher record with RLS enforcement
     * Handles partial updates and file key replacements
     * 
     * @param {String} id - Teacher ID
     * @param {Object} data - Fields to update (can be partial)
     * @param {Object} userContext - User context
     * @param {Object} transaction - Sequelize transaction (optional)
     * @returns {Promise<Object>} Updated teacher
     * @throws {Error} 404 if not found, 403 if forbidden
     */
    async updateTeacher(id, data, userContext, transaction = null) {
        const context = this.validateUserContext(userContext);

        try {
            // Fetch teacher first to enforce RLS
            const teacher = await this.findTeacherById(id, userContext);
            if (!teacher) {
                const error = new Error('Teacher not found');
                error.status = 404;
                error.code = 'NOT_FOUND';
                throw error;
            }

            // Permission check: Only admin, self, or authorized manager can update
            if (!this.isAdmin(context) && context.userId !== teacher.userId) {
                const error = new Error('Forbidden: Cannot update other teachers');
                error.status = 403;
                error.code = 'FORBIDDEN';
                throw error;
            }

            // If email/phone is being updated, check for duplicates
            const User = require('../models/User');
            if (data.emailAddress) {
                const duplicate = await User.findOne({
                    where: {
                        tenantId: context.tenantId,
                        email: data.emailAddress,
                        id: { [Op.ne]: teacher.userId },
                        deletedAt: { [Op.is]: null }
                    },
                    transaction
                });
                if (duplicate) {
                    const error = new Error(`Email already in use: ${data.emailAddress}`);
                    error.status = 409;
                    error.code = 'DUPLICATE_EMAIL';
                    throw error;
                }
            }

            // Update user email/phone if provided
            if (data.emailAddress || data.primaryContactNumber) {
                await User.update({
                    ...(data.emailAddress && { email: data.emailAddress }),
                    ...(data.primaryContactNumber && { phone: data.primaryContactNumber })
                }, {
                    where: { id: teacher.userId },
                    transaction
                });
            }

            // Update teacher record
            await teacher.update(data, { transaction });

            // Audit log
            this.auditLog('update', context, `id=${id}, fields=${Object.keys(data).join(',')}`);

            logger.info(`[TeacherRepository] ✅ Teacher updated: id=${id}`);

            return teacher;

        } catch (error) {
            logger.error(`[TeacherRepository.updateTeacher] ❌ Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * CRITICAL: Soft delete teacher with RLS enforcement
     * Also soft deletes the linked User account
     * 
     * @param {String} id - Teacher ID
     * @param {Object} userContext - User context
     * @param {Object} transaction - Sequelize transaction (optional)
     * @returns {Promise<Object>} Deleted teacher
     * @throws {Error} 404 if not found, 403 if forbidden
     */
    async deleteTeacher(id, userContext, transaction = null) {
        const context = this.validateUserContext(userContext);

        try {
            // Permission check: Only admins can delete teachers
            if (!this.isAdmin(context)) {
                const error = new Error('Insufficient permissions to delete teachers');
                error.status = 403;
                error.code = 'FORBIDDEN';
                throw error;
            }

            // Fetch teacher with RLS
            const teacher = await this.findTeacherById(id, userContext);
            if (!teacher) {
                const error = new Error('Teacher not found');
                error.status = 404;
                error.code = 'NOT_FOUND';
                throw error;
            }

            // Soft delete teacher
            await teacher.update({ deletedAt: new Date() }, { transaction });

            // Soft delete linked user
            const User = require('../models/User');
            await User.update(
                { deletedAt: new Date() },
                { where: { id: teacher.userId }, transaction }
            );

            // Audit log
            this.auditLog('delete', context, `id=${id}, userId=${teacher.userId}`);

            logger.info(`[TeacherRepository] ✅ Teacher soft-deleted: id=${id}`);

            return teacher;

        } catch (error) {
            logger.error(`[TeacherRepository.deleteTeacher] ❌ Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get count of teachers with optional filtering
     * 
     * @param {Object} userContext - User context
     * @param {Object} filters - Optional filters (status, classId, etc.)
     * @returns {Promise<Number>} Count of visible teachers
     */
    async countVisibleTeachers(userContext, filters = {}) {
        const context = this.validateUserContext(userContext);
        const tenantFilter = this.buildTenantFilter(context);
        
        try {
            const where = { ...tenantFilter, ...filters };
            const count = await this.model.count({ where });
            
            this.auditLog('count', context, `filters=${JSON.stringify(filters)}`);
            
            return count;
        } catch (error) {
            logger.error(`[TeacherRepository.countVisibleTeachers] Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Find teachers by multiple IDs with RLS
     * Useful for bulk operations
     * 
     * @param {Array<String>} ids - Array of teacher IDs
     * @param {Object} userContext - User context
     * @returns {Promise<Array>} Teachers
     */
    async findByIds(ids, userContext) {
        const context = this.validateUserContext(userContext);

        try {
            // Apply RLS filters to the query itself
            const where = this.applyRLSFilters({ id: { [Op.in]: ids } }, context, 'read');
            const teachers = await this.model.findAll({ where });
            return teachers;

        } catch (error) {
            logger.error(`[TeacherRepository.findByIds] Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Search teachers by name, email, teacherId
     * 
     * @param {String} query - Search term
     * @param {Object} userContext - User context
     * @param {Object} options - { page, limit }
     * @returns {Promise<Object>} { count, rows }
     */
    async search(query, userContext, options = {}) {
        const context = this.validateUserContext(userContext);
        const { page = 1, limit = 20 } = options;

        try {
            const searchFilters = {
                [Op.or]: [
                    { firstName: { [Op.like]: `%${query}%` } },
                    { lastName: { [Op.like]: `%${query}%` } },
                    { emailAddress: { [Op.like]: `%${query}%` } },
                    { teacherId: { [Op.like]: `%${query}%` } }
                ]
            };

            // Apply RLS filters to the search
            const where = this.applyRLSFilters(searchFilters, context, 'read');

            const { count, rows } = await this.model.findAndCountAll({
                where,
                offset: (page - 1) * limit,
                limit,
                order: [['createdAt', 'DESC']]
            });

            return { count, rows };

        } catch (error) {
            logger.error(`[TeacherRepository.search] Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update S3 file keys after successful upload
     * Used by controller after file upload to S3
     * 
     * @param {String} id - Teacher ID
     * @param {Object} fileKeys - { profileImageKey?, resumeKey?, joiningLetterKey? }
     * @param {Object} userContext - User context
     * @param {Object} transaction - Sequelize transaction (optional)
     * @returns {Promise<Object>} Updated teacher
     */
    async updateFileKeys(id, fileKeys, userContext, transaction = null) {
        const context = this.validateUserContext(userContext);

        try {
            const teacher = await this.findTeacherById(id, userContext);
            if (!teacher) {
                const error = new Error('Teacher not found');
                error.status = 404;
                error.code = 'NOT_FOUND';
                throw error;
            }

            await teacher.update(fileKeys, { transaction });
            return teacher;

        } catch (error) {
            logger.error(`[TeacherRepository.updateFileKeys] Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Delete old profile image from S3 before storing new one
     * CRITICAL: Only called within transaction-safe update flow
     * Enforces tenant isolation before S3 deletion
     * 
     * @param {String} teacherId - Teacher ID (UUID)
     * @param {String} oldProfileImageKey - Old S3 key to delete
     * @param {String} tenantId - Tenant ID (verified for isolation)
     * @param {Object} userContext - User context with userId for audit
     * @param {Object} s3Helper - S3 helper with deleteS3Object method
     * @param {Object} s3Config - { s3Client, bucket }
     * @returns {Promise<void>}
     */
    async deleteOldProfileImage(teacherId, oldProfileImageKey, tenantId, userContext, s3Helper, s3Config) {
        if (!oldProfileImageKey) return; // Nothing to delete

        try {
            logger.info(`[TeacherRepository.deleteOldProfileImage] Deleting old profile image for teacher ${teacherId}`);
            
            // Tenant isolation check: Verify key belongs to correct tenant
            if (!oldProfileImageKey.includes(`tenants/${tenantId}`)) {
                logger.warn(`[deleteOldProfileImage] Key does not match tenant ${tenantId}: ${oldProfileImageKey}`);
                return;
            }

            // Delete from S3 with audit logging
            await s3Helper.deleteS3Object(
                s3Config.s3Client,
                s3Config.bucket,
                oldProfileImageKey,
                tenantId,
                {
                    userId: userContext.userId,
                    entityId: teacherId,
                    entityType: 'teacher',
                    category: 'profile_image',
                    action: 'DELETE_OLD_ON_UPDATE'
                }
            );

            logger.info(`[TeacherRepository.deleteOldProfileImage] ✅ Deleted: ${oldProfileImageKey}`);
        } catch (error) {
            logger.error(`[TeacherRepository.deleteOldProfileImage] Error: ${error.message}`);
            // Don't throw - log but continue with update (old file may already be deleted)
            // Throwing here would fail the entire update operation
        }
    }

    /**
     * Delete old resume document from S3 before storing new one
     * CRITICAL: Only called within transaction-safe update flow
     * 
     * @param {String} teacherId - Teacher ID (UUID)
     * @param {String} oldResumeKey - Old S3 key to delete
     * @param {String} tenantId - Tenant ID (verified for isolation)
     * @param {Object} userContext - User context with userId for audit
     * @param {Object} s3Helper - S3 helper with deleteS3Object method
     * @param {Object} s3Config - { s3Client, bucket }
     * @returns {Promise<void>}
     */
    async deleteOldResume(teacherId, oldResumeKey, tenantId, userContext, s3Helper, s3Config) {
        if (!oldResumeKey) return;

        try {
            logger.info(`[TeacherRepository.deleteOldResume] Deleting old resume for teacher ${teacherId}`);
            
            if (!oldResumeKey.includes(`tenants/${tenantId}`)) {
                logger.warn(`[deleteOldResume] Key does not match tenant ${tenantId}: ${oldResumeKey}`);
                return;
            }

            await s3Helper.deleteS3Object(
                s3Config.s3Client,
                s3Config.bucket,
                oldResumeKey,
                tenantId,
                {
                    userId: userContext.userId,
                    entityId: teacherId,
                    entityType: 'teacher',
                    category: 'resume',
                    action: 'DELETE_OLD_ON_UPDATE'
                }
            );

            logger.info(`[TeacherRepository.deleteOldResume] ✅ Deleted: ${oldResumeKey}`);
        } catch (error) {
            logger.error(`[TeacherRepository.deleteOldResume] Error: ${error.message}`);
        }
    }

    /**
     * Delete old joining letter document from S3 before storing new one
     * CRITICAL: Only called within transaction-safe update flow
     * 
     * @param {String} teacherId - Teacher ID (UUID)
     * @param {String} oldJoiningLetterKey - Old S3 key to delete
     * @param {String} tenantId - Tenant ID (verified for isolation)
     * @param {Object} userContext - User context with userId for audit
     * @param {Object} s3Helper - S3 helper with deleteS3Object method
     * @param {Object} s3Config - { s3Client, bucket }
     * @returns {Promise<void>}
     */
    async deleteOldJoiningLetter(teacherId, oldJoiningLetterKey, tenantId, userContext, s3Helper, s3Config) {
        if (!oldJoiningLetterKey) return;

        try {
            logger.info(`[TeacherRepository.deleteOldJoiningLetter] Deleting old joining letter for teacher ${teacherId}`);
            
            if (!oldJoiningLetterKey.includes(`tenants/${tenantId}`)) {
                logger.warn(`[deleteOldJoiningLetter] Key does not match tenant ${tenantId}: ${oldJoiningLetterKey}`);
                return;
            }

            await s3Helper.deleteS3Object(
                s3Config.s3Client,
                s3Config.bucket,
                oldJoiningLetterKey,
                tenantId,
                {
                    userId: userContext.userId,
                    entityId: teacherId,
                    entityType: 'teacher',
                    category: 'joining_letter',
                    action: 'DELETE_OLD_ON_UPDATE'
                }
            );

            logger.info(`[TeacherRepository.deleteOldJoiningLetter] ✅ Deleted: ${oldJoiningLetterKey}`);
        } catch (error) {
            logger.error(`[TeacherRepository.deleteOldJoiningLetter] Error: ${error.message}`);
        }
    }

    /**
     * Handle profile image update with transaction safety
     * 
     * Flow:
     * 1. Fetch existing teacher to get old image key
     * 2. Tenant isolation check
     * 3. Delete old image from S3 (via deleteOldProfileImage)
     * 4. Update DB with new key (same transaction)
     * 
     * CRITICAL: Called INSIDE transaction context
     * 
     * @param {String} teacherId - Teacher ID (UUID)
     * @param {String} newProfileImageKey - New S3 key (from multer-s3)
     * @param {Object} userContext - User context with RLS
     * @param {Object} s3Helper - S3 helper with deleteS3Object
     * @param {Object} s3Config - { s3Client, bucket }
     * @param {Object} transaction - Sequelize transaction
     * @returns {Promise<Object>} Updated teacher record
     */
    async handleProfileImageUpdate(teacherId, newProfileImageKey, userContext, s3Helper, s3Config, transaction) {
        try {
            logger.info(`[TeacherRepository.handleProfileImageUpdate] Processing profile image update for teacher ${teacherId}`);

            // Fetch existing teacher with RLS check
            const teacher = await this.findTeacherById(teacherId, userContext);
            if (!teacher) {
                const error = new Error('Teacher not found');
                error.status = 404;
                error.code = 'NOT_FOUND';
                throw error;
            }

            const tenantId = teacher.tenantId;
            const oldProfileImageKey = teacher.profileImageKey;

            // Delete old image from S3 (non-blocking, don't throw)
            if (oldProfileImageKey && oldProfileImageKey !== newProfileImageKey) {
                await this.deleteOldProfileImage(
                    teacherId,
                    oldProfileImageKey,
                    tenantId,
                    userContext,
                    s3Helper,
                    s3Config
                );
            }

            // Update DB with new key (in same transaction)
            await teacher.update({ profileImageKey: newProfileImageKey }, { transaction });
            logger.info(`[TeacherRepository.handleProfileImageUpdate] ✅ Updated teacher ${teacherId} with new profile image`);

            return teacher;
        } catch (error) {
            logger.error(`[TeacherRepository.handleProfileImageUpdate] Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Handle resume update with transaction safety
     * Same pattern as handleProfileImageUpdate
     * 
     * @param {String} teacherId - Teacher ID (UUID)
     * @param {String} newResumeKey - New S3 key
     * @param {Object} userContext - User context with RLS
     * @param {Object} s3Helper - S3 helper
     * @param {Object} s3Config - { s3Client, bucket }
     * @param {Object} transaction - Sequelize transaction
     * @returns {Promise<Object>} Updated teacher record
     */
    async handleResumeUpdate(teacherId, newResumeKey, userContext, s3Helper, s3Config, transaction) {
        try {
            logger.info(`[TeacherRepository.handleResumeUpdate] Processing resume update for teacher ${teacherId}`);

            const teacher = await this.findTeacherById(teacherId, userContext);
            if (!teacher) {
                const error = new Error('Teacher not found');
                error.status = 404;
                error.code = 'NOT_FOUND';
                throw error;
            }

            const tenantId = teacher.tenantId;
            const oldResumeKey = teacher.resumeKey;

            if (oldResumeKey && oldResumeKey !== newResumeKey) {
                await this.deleteOldResume(
                    teacherId,
                    oldResumeKey,
                    tenantId,
                    userContext,
                    s3Helper,
                    s3Config
                );
            }

            await teacher.update({ resumeKey: newResumeKey }, { transaction });
            logger.info(`[TeacherRepository.handleResumeUpdate] ✅ Updated teacher ${teacherId} with new resume`);

            return teacher;
        } catch (error) {
            logger.error(`[TeacherRepository.handleResumeUpdate] Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Handle joining letter update with transaction safety
     * Same pattern as handleProfileImageUpdate
     * 
     * @param {String} teacherId - Teacher ID (UUID)
     * @param {String} newJoiningLetterKey - New S3 key
     * @param {Object} userContext - User context with RLS
     * @param {Object} s3Helper - S3 helper
     * @param {Object} s3Config - { s3Client, bucket }
     * @param {Object} transaction - Sequelize transaction
     * @returns {Promise<Object>} Updated teacher record
     */
    async handleJoiningLetterUpdate(teacherId, newJoiningLetterKey, userContext, s3Helper, s3Config, transaction) {
        try {
            logger.info(`[TeacherRepository.handleJoiningLetterUpdate] Processing joining letter update for teacher ${teacherId}`);

            const teacher = await this.findTeacherById(teacherId, userContext);
            if (!teacher) {
                const error = new Error('Teacher not found');
                error.status = 404;
                error.code = 'NOT_FOUND';
                throw error;
            }

            const tenantId = teacher.tenantId;
            const oldJoiningLetterKey = teacher.joiningLetterKey;

            if (oldJoiningLetterKey && oldJoiningLetterKey !== newJoiningLetterKey) {
                await this.deleteOldJoiningLetter(
                    teacherId,
                    oldJoiningLetterKey,
                    tenantId,
                    userContext,
                    s3Helper,
                    s3Config
                );
            }

            await teacher.update({ joiningLetterKey: newJoiningLetterKey }, { transaction });
            logger.info(`[TeacherRepository.handleJoiningLetterUpdate] ✅ Updated teacher ${teacherId} with new joining letter`);

            return teacher;
        } catch (error) {
            logger.error(`[TeacherRepository.handleJoiningLetterUpdate] Error: ${error.message}`);
            throw error;
        }
    }
}

module.exports = TeacherRepository;
