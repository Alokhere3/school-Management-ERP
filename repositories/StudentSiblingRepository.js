/**
 * StudentSiblingRepository
 * 
 * Manages sibling relationships with strict RLS enforcement
 * CRITICAL: All sibling data access MUST flow through this repository
 * 
 * Rules:
 * - All sibling IDs must belong to the same tenant
 * - Prevents self-linking (student cannot be their own sibling)
 * - Prevents duplicate links (A ↔ B cannot be created twice)
 * - Stores relationships bi-directionally (A → B, B → A)
 * - Soft delete safe (auto-excludes deleted siblings)
 */

const BaseRepository = require('./BaseRepository');
const { Op } = require('sequelize');

class StudentSiblingRepository extends BaseRepository {
    constructor(model) {
        super(model, 'studentSibling');
    }

    /**
     * Create bi-directional sibling relationships with full validation
     * 
     * @param {String} studentId - Primary student ID
     * @param {Array} siblingIds - Array of sibling student IDs
     * @param {Object} userContext - User context with tenantId validation
     * @param {Object} transaction - Sequelize transaction for atomicity
     * @returns {Promise<Array>} Created sibling relationship records
     * @throws {Error} If validation fails
     */
    async createSiblingRelationships(studentId, siblingIds, userContext, transaction) {
        const context = this.validateUserContext(userContext);
        console.log(`\n[DEBUG-SIBLING] createSiblingRelationships STARTING`);
        console.log(`[DEBUG-SIBLING] studentId:`, studentId);
        console.log(`[DEBUG-SIBLING] siblingIds (RAW):`, siblingIds);
        console.log(`[DEBUG-SIBLING] siblingIds type:`, typeof siblingIds);
        console.log(`[DEBUG-SIBLING] siblingIds is array:`, Array.isArray(siblingIds));
        
        this.auditLog('create', context, `studentId=${studentId}, count=${siblingIds ? (Array.isArray(siblingIds) ? siblingIds.length : siblingIds.toString().split(',').length) : 0}`);

        if (!studentId) {
            throw new Error('INVALID_INPUT: studentId is required');
        }

        // Handle both array and comma-separated string formats
        let siblingIdsArray = siblingIds;
        if (typeof siblingIds === 'string') {
            console.log(`[DEBUG-SIBLING] Converting string to array...`);
            siblingIdsArray = siblingIds.split(',').map(id => id.trim()).filter(id => id.length > 0);
            console.log(`[DEBUG-SIBLING] After conversion:`, siblingIdsArray);
        }

        if (!Array.isArray(siblingIdsArray) || siblingIdsArray.length === 0) {
            console.log(`[DEBUG-SIBLING] No siblings to link, returning empty array`);
            return []; // No siblings to link
        }

        // Validate no self-linking
        const selfLinked = siblingIdsArray.includes(studentId);
        if (selfLinked) {
            throw new Error('VALIDATION_ERROR: Student cannot be their own sibling');
        }

        // Remove duplicates from siblingIds array
        const uniqueSiblingIds = [...new Set(siblingIdsArray)];
        console.log(`[DEBUG-SIBLING] Unique sibling IDs after dedup:`, uniqueSiblingIds);

        // Fetch Student model to validate all siblings belong to same tenant
        const Student = require('../models/Student');
        
        // Verify all sibling IDs belong to the same tenant
        console.log(`[DEBUG-SIBLING] Verifying ${uniqueSiblingIds.length} siblings exist in tenant ${context.tenantId}...`);
        const siblings = await Student.findAll({
            where: {
                id: { [Op.in]: uniqueSiblingIds },
                tenantId: context.tenantId,
                status: 'active' // Only link to active students
            },
            attributes: ['id'],
            raw: true,
            transaction
        });
        console.log(`[DEBUG-SIBLING] Found ${siblings.length} valid siblings`);

        if (siblings.length !== uniqueSiblingIds.length) {
            console.error(`[DEBUG-SIBLING] VALIDATION FAILED: Expected ${uniqueSiblingIds.length}, found ${siblings.length}`);
            throw new Error('INVALID_TENANT: Some sibling IDs do not belong to this tenant or are inactive');
        }

        // Prepare bi-directional links
        // A ↔ B means: A→B and B→A
        const linksToCreate = [];
        for (const siblingId of uniqueSiblingIds) {
            // Check if link already exists to prevent duplicates
            console.log(`[DEBUG-SIBLING] Checking for existing link: ${studentId} → ${siblingId}`);
            const existingLink = await this.model.findOne({
                where: {
                    tenantId: context.tenantId,
                    studentId: studentId,
                    siblingStudentId: siblingId
                },
                transaction
            });

            if (!existingLink) {
                console.log(`[DEBUG-SIBLING] Link does not exist, will create`);
                linksToCreate.push({
                    tenantId: context.tenantId,
                    studentId: studentId,
                    siblingStudentId: siblingId
                });
            } else {
                console.log(`[DEBUG-SIBLING] Link already exists, skipping`);
            }
        }

        // Create primary direction links (student → sibling)
        console.log(`[DEBUG-SIBLING] Creating ${linksToCreate.length} primary direction links...`);
        console.log(`[DEBUG-SIBLING] Links to create:`, linksToCreate);
        const createdLinks = await this.model.bulkCreate(linksToCreate, { transaction });
        console.log(`[DEBUG-SIBLING] Primary direction links created:`, createdLinks.length);

        // Create reverse direction links (sibling → student) for bi-directionality
        const reverseLinks = [];
        for (const link of createdLinks) {
            console.log(`[DEBUG-SIBLING] Creating reverse link: ${link.siblingStudentId} → ${link.studentId}`);
            // Check if reverse link already exists
            const existingReverse = await this.model.findOne({
                where: {
                    tenantId: context.tenantId,
                    studentId: link.siblingStudentId,
                    siblingStudentId: link.studentId
                },
                transaction
            });

            if (!existingReverse) {
                reverseLinks.push({
                    tenantId: context.tenantId,
                    studentId: link.siblingStudentId,
                    siblingStudentId: link.studentId
                });
            }
        }

        console.log(`[DEBUG-SIBLING] Creating ${reverseLinks.length} reverse direction links...`);
        console.log(`[DEBUG-SIBLING] Reverse links to create:`, reverseLinks);
        if (reverseLinks.length > 0) {
            const createdReverseLinks = await this.model.bulkCreate(reverseLinks, { transaction });
            console.log(`[DEBUG-SIBLING] Reverse direction links created:`, createdReverseLinks.length);
        }

        const totalCreated = createdLinks.length + reverseLinks.length;
        console.log(`[DEBUG-SIBLING] TOTAL LINKS CREATED: ${totalCreated}`);
        console.log(`[DEBUG-SIBLING] createSiblingRelationships COMPLETED\n`);
        
        return [...createdLinks, ...reverseLinks];
    }

    /**
     * Get siblings of a student with full RLS enforcement
     * Returns sibling records with full student details via join
     * 
     * @param {String} studentId - Student ID
     * @param {Object} userContext - User context
     * @param {Object} options - Query options (attributes, include, etc.)
     * @returns {Promise<Array>} Array of sibling student records
     */
    async getSiblingsForStudent(studentId, userContext, options = {}) {
        const context = this.validateUserContext(userContext);
        this.auditLog('read', context, `studentId=${studentId}`);

        if (!studentId) {
            throw new Error('INVALID_INPUT: studentId is required');
        }

        const Student = require('../models/Student');

        // Find all sibling links for this student
        const siblingLinks = await this.model.findAll({
            where: {
                tenantId: context.tenantId,
                studentId: studentId
            },
            attributes: ['siblingStudentId'],
            raw: true
        });

        if (siblingLinks.length === 0) {
            return [];
        }

        const siblingIds = siblingLinks.map(link => link.siblingStudentId);

        // Fetch full sibling student records with RLS
        const siblings = await Student.findAll({
            where: {
                id: { [Op.in]: siblingIds },
                tenantId: context.tenantId,
                status: 'active' // Only return active siblings
            },
            attributes: options.attributes || undefined,
            raw: options.raw !== false, // Default to raw format
            order: options.order || [['firstName', 'ASC']]
        });

        return siblings;
    }

    /**
     * Remove sibling relationship (both directions)
     * 
     * @param {String} studentId - Student ID
     * @param {String} siblingId - Sibling ID to remove
     * @param {Object} userContext - User context
     * @param {Object} transaction - Sequelize transaction
     * @returns {Promise<Number>} Number of deleted relationships
     */
    async removeSiblingRelationship(studentId, siblingId, userContext, transaction) {
        const context = this.validateUserContext(userContext);
        this.auditLog('delete', context, `studentId=${studentId}, siblingId=${siblingId}`);

        if (!studentId || !siblingId) {
            throw new Error('INVALID_INPUT: Both studentId and siblingId are required');
        }

        // Remove both directions
        const destroyed = await this.model.destroy({
            where: {
                tenantId: context.tenantId,
                [Op.or]: [
                    { studentId: studentId, siblingStudentId: siblingId },
                    { studentId: siblingId, siblingStudentId: studentId }
                ]
            },
            transaction
        });

        return destroyed;
    }

    /**
     * Remove all sibling relationships for a student
     * (Called when student is deleted)
     * 
     * @param {String} studentId - Student ID
     * @param {Object} userContext - User context
     * @param {Object} transaction - Sequelize transaction
     * @returns {Promise<Number>} Number of deleted relationships
     */
    async removeSiblingsForStudent(studentId, userContext, transaction) {
        const context = this.validateUserContext(userContext);
        this.auditLog('delete', context, `studentId=${studentId}`);

        if (!studentId) {
            throw new Error('INVALID_INPUT: studentId is required');
        }

        // Remove all relationships (both directions)
        const destroyed = await this.model.destroy({
            where: {
                tenantId: context.tenantId,
                [Op.or]: [
                    { studentId: studentId },
                    { siblingStudentId: studentId }
                ]
            },
            transaction
        });

        return destroyed;
    }

    /**
     * Check if two students are already linked as siblings
     * 
     * @param {String} studentId - Student ID
     * @param {String} siblingId - Sibling ID to check
     * @param {Object} userContext - User context
     * @returns {Promise<Boolean>} true if linked, false otherwise
     */
    async areSiblings(studentId, siblingId, userContext) {
        const context = this.validateUserContext(userContext);

        if (!studentId || !siblingId) {
            return false;
        }

        const link = await this.model.findOne({
            where: {
                tenantId: context.tenantId,
                studentId: studentId,
                siblingStudentId: siblingId
            },
            attributes: ['id'],
            raw: true
        });

        return link !== null;
    }

    /**
     * Get all sibling IDs for a student (simple array return)
     * Useful for API responses without full student data
     * 
     * @param {String} studentId - Student ID
     * @param {Object} userContext - User context
     * @returns {Promise<Array>} Array of sibling student IDs
     */
    async getSiblingIds(studentId, userContext) {
        const context = this.validateUserContext(userContext);

        if (!studentId) {
            return [];
        }

        const links = await this.model.findAll({
            where: {
                tenantId: context.tenantId,
                studentId: studentId
            },
            attributes: ['siblingStudentId'],
            raw: true
        });

        return links.map(link => link.siblingStudentId);
    }
}

module.exports = StudentSiblingRepository;
