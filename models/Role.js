const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Role = sequelize.define('Role', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    tenantId: {
        type: DataTypes.UUID,
        allowNull: true, // NULL = system/super-admin role
        references: {
            model: 'tenants',
            key: 'id'
        }
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        // Examples: "School Admin", "Teacher", "Super Admin", "Principal", etc.
    },
    code: {
        type: DataTypes.STRING(50),
        allowNull: false, // Must be populated during migration
        unique: true,
        validate: {
            notEmpty: true,
            isUppercase: true // Enforce uppercase convention
        }
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    isSystemRole: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        // true = Super Admin, Support Engineer (cross-tenant)
        // false = School Admin, Teacher, etc. (tenant-scoped)
    }
}, {
    tableName: 'roles',
    timestamps: true,
    indexes: [
        { fields: ['tenantId', 'name'], unique: true },
        { fields: ['isSystemRole', 'name'] }
    ],
    validate: {
        // DB-level safety: system roles must be global
        systemRoleMustBeGlobal() {
            if (this.isSystemRole && this.tenantId !== null) {
                throw new Error('System roles must not have a tenantId. System roles are global and shared across all tenants.');
            }
            // Inverse: tenant-scoped roles must NOT be marked as system roles
            if (!this.isSystemRole && this.tenantId === null) {
                throw new Error('Tenant-scoped roles (isSystemRole=false) must have a tenantId.');
            }
        },
        // Prevent code updates
        codeIsImmutable() {
            if (this.changed('code') && !this.isNewRecord) {
                throw new Error('Role code is immutable and cannot be changed.');
            }
        }
    }
});

module.exports = Role;
