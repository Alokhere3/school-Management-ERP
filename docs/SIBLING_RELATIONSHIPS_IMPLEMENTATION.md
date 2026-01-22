/**
 * SIBLING RELATIONSHIP IMPLEMENTATION GUIDE
 * 
 * This document describes the multi-sibling implementation for School ERP.
 * Follows production-ready patterns with full RLS enforcement and transaction support.
 */

// ============================================================
// FRONTEND API REQUEST FORMAT
// ============================================================

/**
 * CREATE STUDENT WITH SIBLINGS
 * POST /api/students
 * 
 * Request body:
 * {
 *   "admissionNo": "STU001",
 *   "firstName": "John",
 *   "lastName": "Doe",
 *   "dateOfBirth": "2010-01-15",
 *   "classId": "class-uuid",
 *   "gender": "Male",
 *   "siblingIds": ["sibling-uuid-1", "sibling-uuid-2"],
 *   ... other student fields
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "student-uuid",
 *     "firstName": "John",
 *     "lastName": "Doe",
 *     "siblings": [
 *       {
 *         "id": "sibling-uuid-1",
 *         "firstName": "Jane",
 *         "lastName": "Doe",
 *         "admissionNo": "STU002",
 *         "photoUrl": "...",
 *         "classId": "class-uuid",
 *         "rollNumber": 5
 *       },
 *       ...
 *     ]
 *   }
 * }
 */

/**
 * UPDATE STUDENT SIBLINGS
 * PUT /api/students/:id
 * 
 * Request body:
 * {
 *   "firstName": "John",
 *   "siblingIds": ["sibling-uuid-1", "sibling-uuid-2"]
 *   ... other student fields
 * }
 * 
 * Notes:
 * - If siblingIds provided, replaces ALL existing sibling relationships
 * - If siblingIds not provided, siblings remain unchanged
 * - Empty array [] removes all siblings
 */

/**
 * GET STUDENT WITH SIBLINGS
 * GET /api/students/:id
 * 
 * Response includes:
 * {
 *   "id": "student-uuid",
 *   "firstName": "John",
 *   "siblings": [
 *     {
 *       "id": "sibling-uuid-1",
 *       "firstName": "Jane",
 *       "lastName": "Doe",
 *       "photoUrl": "...",
 *       "classId": "class-uuid",
 *       "rollNumber": 5
 *     }
 *   ]
 * }
 */

/**
 * DELETE STUDENT (auto-cleans siblings)
 * DELETE /api/students/:id
 * 
 * Automatically removes:
 * - All sibling links where student is studentId
 * - All sibling links where student is siblingStudentId
 * - Student record itself
 */

// ============================================================
// BACKEND IMPLEMENTATION DETAILS
// ============================================================

/**
 * DATABASE SCHEMA
 * 
 * student_siblings table (junction table):
 * ├─ id (UUID) - Primary key
 * ├─ tenantId (UUID) - Tenant isolation (FK: tenants.id)
 * ├─ studentId (UUID) - FK: students.id
 * ├─ siblingStudentId (UUID) - FK: students.id
 * ├─ createdAt (DATETIME) - Read-only timestamp
 * 
 * Indexes:
 * - idx_sibling_student_id: (tenantId, studentId) - For fetch by student
 * - idx_sibling_sibling_id: (tenantId, siblingStudentId) - For reverse lookups
 * - idx_sibling_composite: (tenantId, studentId, siblingStudentId) - Unique constraint
 * 
 * Storage Rules:
 * - NO denormalized sibling data in student table
 * - Junction table stores ONLY relationships
 * - Full sibling data fetched via efficient join query
 */

/**
 * REPOSITORY LAYER (StudentSiblingRepository)
 * 
 * Public Methods:
 * 
 * 1. createSiblingRelationships(studentId, siblingIds, userContext, transaction)
 *    - Validates all IDs belong to same tenant
 *    - Prevents self-linking
 *    - Prevents duplicates
 *    - Creates bi-directional links (A↔B means A→B and B→A)
 *    - Throws errors with specific codes for validation
 * 
 * 2. getSiblingsForStudent(studentId, userContext, options)
 *    - Returns full Student records (single efficient query)
 *    - Respects RLS (only students user can access)
 *    - Filters out soft-deleted students
 *    - Returns: Array of student objects
 * 
 * 3. removeSiblingRelationship(studentId, siblingId, userContext, transaction)
 *    - Removes both directions (A←→B)
 *    - Respects RLS
 * 
 * 4. removeSiblingsForStudent(studentId, userContext, transaction)
 *    - Removes all relationships for a student
 *    - Called on student deletion
 * 
 * 5. areSiblings(studentId, siblingId, userContext)
 *    - Quick boolean check if two students are linked
 * 
 * 6. getSiblingIds(studentId, userContext)
 *    - Returns just the IDs (lightweight)
 */

/**
 * STUDENT REPOSITORY EXTENSIONS
 * 
 * New Methods:
 * 
 * 1. findStudentWithSiblings(studentId, userContext)
 *    - Single efficient query fetching student + siblings via join
 *    - Respects RLS
 *    - Returns student object with nested siblings array
 *    - Used by controllers for GET and UPDATE operations
 */

/**
 * CONTROLLER LAYER (studentController.js)
 * 
 * Changes:
 * 
 * 1. createStudent()
 *    - Accepts siblingIds in request body
 *    - Uses transaction for atomic insert
 *    - Validates siblings on backend
 *    - Returns student WITH siblings in response
 * 
 * 2. updateStudent()
 *    - Accepts siblingIds in request body
 *    - If siblingIds provided, replaces ALL relationships
 *    - Uses transaction for atomic update
 *    - Returns student WITH siblings in response
 * 
 * 3. getStudentById()
 *    - Uses findStudentWithSiblings() for single query
 *    - Returns student WITH nested siblings array
 *    - Converts sibling photoKeys to photoUrls
 * 
 * 4. deleteStudent()
 *    - Uses transaction for atomic delete
 *    - Automatically cleans all sibling relationships
 *    - No manual cleanup needed
 */

/**
 * TRANSACTION HANDLING
 * 
 * Pattern:
 * const transaction = await sequelize.transaction();
 * try {
 *   // All repository calls include transaction parameter
 *   await repos.studentSibling.createSiblingRelationships(
 *     studentId, 
 *     siblingIds, 
 *     userContext, 
 *     transaction
 *   );
 *   await transaction.commit();
 * } catch (err) {
 *   await transaction.rollback();
 *   // return error
 * }
 * 
 * Benefits:
 * - Student creation and sibling linking are atomic
 * - If sibling validation fails, entire operation rolls back
 * - No partial updates
 */

/**
 * RLS ENFORCEMENT
 * 
 * All operations enforce:
 * 1. Tenant isolation - All queries filtered by userContext.tenantId
 * 2. Permission checks - Admin required for create/update/delete
 * 3. OWNED scope - Teachers/Parents see only accessible students
 * 4. Audit logging - All operations logged with user context
 * 
 * Validation:
 * - Sibling IDs must belong to same tenant
 * - Only active students can be siblings
 * - User must have permission to link students
 */

/**
 * PRODUCTION SAFETY CHECKS
 * 
 * ✓ No direct model access (queries flow through repositories)
 * ✓ Transactions prevent partial updates
 * ✓ Bi-directional links stay consistent (A→B always means B→A)
 * ✓ Duplicate prevention via unique constraint + validation
 * ✓ Self-linking prevented at application level
 * ✓ Tenant isolation enforced everywhere
 * ✓ RLS prevents cross-tenant access
 * ✓ Soft deletes handled (deleted siblings auto-excluded)
 * ✓ Cascade deletes clean up relationships
 * ✓ Photo proxy URLs work with siblings
 * ✓ Single efficient query for student + siblings (no N+1)
 * ✓ Audit logging on all operations
 */

/**
 * MIGRATION STEPS FOR DEPLOYMENT
 * 
 * 1. Run migration: 20260122-create-student-siblings.js
 *    - Creates student_siblings table
 *    - Creates indexes
 *    - Sets up FK constraints with CASCADE
 * 
 * 2. Code changes already applied:
 *    - Model: StudentSibling (models/StudentSibling.js)
 *    - Repository: StudentSiblingRepository (repositories/StudentSiblingRepository.js)
 *    - Factory: Updated RepositoryFactory
 *    - Controller: Updated studentController with sibling support
 *    - Models index: Added associations
 * 
 * 3. No data migration needed (new feature)
 * 4. Backward compatible (siblings optional)
 */

/**
 * COMMON ERRORS & SOLUTIONS
 * 
 * "VALIDATION_ERROR: Student cannot be their own sibling"
 * - Solution: Remove student's own ID from siblingIds array
 * 
 * "INVALID_TENANT: Some sibling IDs do not belong to this tenant"
 * - Solution: Verify all sibling IDs are valid and in same school
 * 
 * "INSUFFICIENT_PERMISSIONS"
 * - Solution: Only admins can create/update student relationships
 * 
 * "NOT_FOUND: Student not found or access denied"
 * - Solution: Verify student exists and user has access (RLS)
 */

module.exports = {};
