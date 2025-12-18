/**
 * Model Associations & Exports
 * 
 * Sets up relationships between all Sequelize models
 */

const Tenant = require('./Tenant');
const User = require('./User');
const Student = require('./Student');
const Staff = require('./Staff');
const Parent = require('./Parent');
const ParentStudent = require('./ParentStudent');
const Role = require('./Role');
const Permission = require('./Permission');
const RolePermission = require('./RolePermission');
const UserRole = require('./UserRole');
const Attendance = require('./Attendance');
const Exam = require('./Exam');
const ExamMarks = require('./ExamMarks');
const StudentFee = require('./StudentFee');

// ===== User & Role Associations =====
User.hasMany(UserRole, { foreignKey: 'userId', as: 'userRoles' });
UserRole.belongsTo(User, { foreignKey: 'userId', as: 'user' });

UserRole.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Tenant.hasMany(UserRole, { foreignKey: 'tenantId', as: 'userRoles' });

// ===== Role & Permission Associations =====
Role.hasMany(RolePermission, { foreignKey: 'roleId', as: 'rolePermissions' });
RolePermission.belongsTo(Role, { foreignKey: 'roleId', as: 'role' });

Permission.hasMany(RolePermission, { foreignKey: 'permissionId', as: 'rolePermissions' });
RolePermission.belongsTo(Permission, { foreignKey: 'permissionId', as: 'permission' });

// ===== Tenant Associations =====
Tenant.hasMany(User, { foreignKey: 'tenantId', as: 'users' });
User.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(Student, { foreignKey: 'tenantId', as: 'students' });
Student.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(Staff, { foreignKey: 'tenantId', as: 'staff' });
Staff.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(Role, { foreignKey: 'tenantId', as: 'roles' });
Role.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

// ===== Student Associations =====
User.hasMany(Student, { foreignKey: 'userId', as: 'studentRecords' });
Student.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ===== Staff Associations =====
User.hasMany(Staff, { foreignKey: 'userId', as: 'staffRecords' });
Staff.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ===== Parent Associations =====
Tenant.hasMany(Parent, { foreignKey: 'tenantId', as: 'parents' });
Parent.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

User.hasMany(Parent, { foreignKey: 'userId', as: 'parentRecords' });
Parent.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ===== Parent-Student Linker Associations =====
Parent.hasMany(ParentStudent, { foreignKey: 'parentId', as: 'parentStudents' });
ParentStudent.belongsTo(Parent, { foreignKey: 'parentId', as: 'parent' });

Student.hasMany(ParentStudent, { foreignKey: 'studentId', as: 'parentStudents' });
ParentStudent.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });

Tenant.hasMany(ParentStudent, { foreignKey: 'tenantId', as: 'parentStudents' });
ParentStudent.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Student.hasMany(Attendance, { foreignKey: 'studentId', as: 'attendance' });
Attendance.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });

Student.hasMany(ExamMarks, { foreignKey: 'studentId', as: 'examMarks' });
ExamMarks.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });

Student.hasMany(StudentFee, { foreignKey: 'studentId', as: 'fees' });
StudentFee.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });

// ===== Exam Associations =====
Exam.hasMany(ExamMarks, { foreignKey: 'examId', as: 'marks' });
ExamMarks.belongsTo(Exam, { foreignKey: 'examId', as: 'exam' });

module.exports = {
    Tenant,
    User,
    Student,
    Staff,
    Parent,
    ParentStudent,
    Role,
    Permission,
    RolePermission,
    UserRole,
    Attendance,
    Exam,
    ExamMarks,
    StudentFee
};
