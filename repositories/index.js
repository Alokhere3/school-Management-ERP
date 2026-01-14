/**
 * Repositories Index
 * 
 * Central export for all repositories and factory.
 */

const BaseRepository = require('./BaseRepository');
const StudentRepository = require('./StudentRepository');
const StaffRepository = require('./StaffRepository');
const UserRepository = require('./UserRepository');
const ClassRepository = require('./ClassRepository');
const RepositoryFactory = require('./RepositoryFactory');

module.exports = {
    BaseRepository,
    StudentRepository,
    StaffRepository,
    UserRepository,
    ClassRepository,
    RepositoryFactory
};
