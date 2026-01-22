/**
 * RepositoryFactory
 * 
 * Central factory for all repository instances.
 * Ensures consistency and provides dependency injection.
 * 
 * Usage in controllers:
 *   const repos = new RepositoryFactory();
 *   const students = await repos.student.findVisibleStudents(userContext, filters, options);
 *   const staff = await repos.staff.findVisibleStaff(userContext, filters, options);
 */

const StudentRepository = require('./StudentRepository');
const StaffRepository = require('./StaffRepository');
const UserRepository = require('./UserRepository');
const ClassRepository = require('./ClassRepository');
const TeacherRepository = require('./TeacherRepository');
const StudentSiblingRepository = require('./StudentSiblingRepository');

const Student = require('../models/Student');
const Staff = require('../models/Staff');
const User = require('../models/User');
const Class = require('../models/Class');
const Teacher = require('../models/Teacher');
const StudentSibling = require('../models/StudentSibling');

class RepositoryFactory {
    constructor() {
        // Initialize repositories on demand
        this._studentRepo = null;
        this._staffRepo = null;
        this._userRepo = null;
        this._classRepo = null;
        this._teacherRepo = null;
        this._studentSiblingRepo = null;
    }

    /**
     * Get StudentRepository instance
     * 
     * @returns {StudentRepository}
     */
    get student() {
        if (!this._studentRepo) {
            this._studentRepo = new StudentRepository(Student);
        }
        return this._studentRepo;
    }

    /**
     * Get StaffRepository instance
     * 
     * @returns {StaffRepository}
     */
    get staff() {
        if (!this._staffRepo) {
            this._staffRepo = new StaffRepository(Staff);
        }
        return this._staffRepo;
    }

    /**
     * Get UserRepository instance
     * 
     * @returns {UserRepository}
     */
    get user() {
        if (!this._userRepo) {
            this._userRepo = new UserRepository(User);
        }
        return this._userRepo;
    }

    /**
     * Get ClassRepository instance
     * 
     * @returns {ClassRepository}
     */
    get class() {
        if (!this._classRepo) {
            this._classRepo = new ClassRepository(Class);
        }
        return this._classRepo;
    }

    /**
     * Get TeacherRepository instance
     * 
     * @returns {TeacherRepository}
     */
    get teacher() {
        if (!this._teacherRepo) {
            this._teacherRepo = new TeacherRepository(Teacher);
        }
        return this._teacherRepo;
    }

    /**
     * Get StudentSiblingRepository instance
     * 
     * @returns {StudentSiblingRepository}
     */
    get studentSibling() {
        if (!this._studentSiblingRepo) {
            this._studentSiblingRepo = new StudentSiblingRepository(StudentSibling);
        }
        return this._studentSiblingRepo;
    }

    /**
     * Get all repositories at once
     * 
     * @returns {Object} Object with all repository instances
     */
    getAll() {
        return {
            student: this.student,
            staff: this.staff,
            user: this.user,
            class: this.class,
            teacher: this.teacher,
            studentSibling: this.studentSibling
        };
    }

    /**
     * Create a new instance for testing or specific contexts
     * 
     * @param {String} repositoryName - Name of repository (student, staff, user, class, teacher, studentSibling)
     * @param {Object} model - Sequelize model to use
     * @returns {BaseRepository} New repository instance
     */
    static create(repositoryName, model) {
        switch (repositoryName.toLowerCase()) {
            case 'student':
                return new StudentRepository(model);
            case 'staff':
                return new StaffRepository(model);
            case 'user':
                return new UserRepository(model);
            case 'class':
                return new ClassRepository(model);
            case 'teacher':
                return new TeacherRepository(model);
            case 'studentsibling':
                return new StudentSiblingRepository(model);
            default:
                throw new Error(`Unknown repository: ${repositoryName}`);
        }
    }
}

module.exports = RepositoryFactory;
