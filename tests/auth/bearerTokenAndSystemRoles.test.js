const jwt = require('jsonwebtoken');

describe('Bearer Token and System-Role Authorization - Unit Tests', () => {
    const JWT_SECRET = 'test-secret-key-12345';

    describe('Bearer Token Normalization', () => {
        it('should normalize Bearer token with roles array', () => {
            const tokenPayload = {
                userId: 'user-1',
                tenantId: 'tenant-1',
                roles: ['SUPER_ADMIN', 'TEACHER'],
                type: 'access'
            };
            const token = jwt.sign(tokenPayload, JWT_SECRET);

            const decoded = jwt.verify(token, JWT_SECRET);
            const rolesFromToken = decoded.roles || (decoded.role ? (Array.isArray(decoded.role) ? decoded.role : [decoded.role]) : []);

            expect(Array.isArray(rolesFromToken)).toBe(true);
            expect(rolesFromToken).toEqual(['SUPER_ADMIN', 'TEACHER']);
        });

        it('should normalize Bearer token with single role string (backward compatibility)', () => {
            const tokenPayload = {
                userId: 'user-1',
                tenantId: 'tenant-1',
                role: 'SUPER_ADMIN',
                type: 'access'
            };
            const token = jwt.sign(tokenPayload, JWT_SECRET);

            const decoded = jwt.verify(token, JWT_SECRET);
            const rolesFromToken = decoded.roles || (decoded.role ? (Array.isArray(decoded.role) ? decoded.role : [decoded.role]) : []);

            expect(Array.isArray(rolesFromToken)).toBe(true);
            expect(rolesFromToken).toEqual(['SUPER_ADMIN']);
        });

        it('should compute primary role from roles array', () => {
            const tokenPayload = {
                userId: 'user-1',
                tenantId: 'tenant-1',
                roles: ['TEACHER', 'PARENT'],
                type: 'access'
            };
            const token = jwt.sign(tokenPayload, JWT_SECRET);

            const decoded = jwt.verify(token, JWT_SECRET);
            const rolesFromToken = decoded.roles || (decoded.role ? (Array.isArray(decoded.role) ? decoded.role : [decoded.role]) : []);
            const primaryRole = (Array.isArray(rolesFromToken) && rolesFromToken.length > 0) ? rolesFromToken[0] : (decoded.role || null);

            expect(primaryRole).toBe('TEACHER');
        });

        it('should handle empty roles array gracefully', () => {
            const tokenPayload = {
                userId: 'user-1',
                tenantId: 'tenant-1',
                roles: [],
                type: 'access'
            };
            const token = jwt.sign(tokenPayload, JWT_SECRET);

            const decoded = jwt.verify(token, JWT_SECRET);
            const rolesFromToken = decoded.roles || (decoded.role ? (Array.isArray(decoded.role) ? decoded.role : [decoded.role]) : []);
            const primaryRole = (Array.isArray(rolesFromToken) && rolesFromToken.length > 0) ? rolesFromToken[0] : (decoded.role || null);

            expect(Array.isArray(rolesFromToken)).toBe(true);
            expect(rolesFromToken.length).toBe(0);
            expect(primaryRole).toBeNull();
        });
    });

    describe('Role Normalization (Enum to Human-Readable)', () => {
        it('should convert SUPER_ADMIN enum to "Super admin" name', () => {
            const roleEnum = 'SUPER_ADMIN';
            const formatted = roleEnum.charAt(0) + roleEnum.slice(1).toLowerCase().replace(/_/g, ' ');

            // Note: formatting preserves first letter, lowercases rest, replaces underscores with spaces
            expect(formatted).toBe('Super admin');
        });

        it('should convert SCHOOL_ADMIN enum to "School admin" name', () => {
            const roleEnum = 'SCHOOL_ADMIN';
            const formatted = roleEnum.charAt(0) + roleEnum.slice(1).toLowerCase().replace(/_/g, ' ');

            expect(formatted).toBe('School admin');
        });

        it('should handle multiple role enums correctly', () => {
            const roleEnums = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT'];
            const formatted = roleEnums.map(r => r.charAt(0) + r.slice(1).toLowerCase().replace(/_/g, ' '));

            expect(formatted).toEqual(['Super admin', 'School admin', 'Teacher', 'Student']);
        });
    });

    describe('System-Role Detection (Super Admin)', () => {
        it('should identify Super Admin from various role formats', () => {
            const testCases = ['SUPER_ADMIN', 'super_admin', 'Super Admin', 'SUPERADMIN', 'superadmin'];

            const _normalize = v => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');

            const results = testCases.map(role => {
                const normalized = _normalize(role);
                return normalized === 'superadmin';
            });

            expect(results).toEqual([true, true, true, true, true]);
        });

        it('should not identify non-Super Admin roles as Super Admin', () => {
            const testCases = ['TEACHER', 'STUDENT', 'PARENT', 'SCHOOL_ADMIN'];
            const _normalize = v => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');

            const results = testCases.map(role => {
                const normalized = _normalize(role);
                return normalized === 'superadmin';
            });

            expect(results).toEqual([false, false, false, false]);
        });

        it('should detect Super Admin permission level from token roles array', () => {
            const _normalize = v => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');

            // Case 1: roles array with SUPER_ADMIN
            const roles1 = ['SUPER_ADMIN', 'TEACHER'];
            const isSuperAdmin1 = roles1.some(r => _normalize(r) === 'superadmin');
            expect(isSuperAdmin1).toBe(true);

            // Case 2: roles array without SUPER_ADMIN
            const roles2 = ['TEACHER', 'STUDENT'];
            const isSuperAdmin2 = roles2.some(r => _normalize(r) === 'superadmin');
            expect(isSuperAdmin2).toBe(false);

            // Case 3: empty roles array
            const roles3 = [];
            const isSuperAdmin3 = roles3.some(r => _normalize(r) === 'superadmin');
            expect(isSuperAdmin3).toBe(false);
        });
    });

    describe('Permission Level Hierarchy', () => {
        it('should determine max permission level from multiple permissions', () => {
            const levels = ['none', 'read', 'limited', 'full'];

            const rolePermissions = [
                { level: 'read' },
                { level: 'limited' },
                { level: 'full' }
            ];

            let maxLevel = 'none';
            rolePermissions.forEach(rp => {
                const currentIndex = levels.indexOf(rp.level || 'none');
                const maxIndex = levels.indexOf(maxLevel);
                if (currentIndex > maxIndex) {
                    maxLevel = rp.level;
                }
            });

            expect(maxLevel).toBe('full');
        });

        it('should compute lowest permission level when only limited access exists', () => {
            const levels = ['none', 'read', 'limited', 'full'];

            const rolePermissions = [
                { level: 'limited' },
                { level: 'read' }
            ];

            let maxLevel = 'none';
            rolePermissions.forEach(rp => {
                const currentIndex = levels.indexOf(rp.level || 'none');
                const maxIndex = levels.indexOf(maxLevel);
                if (currentIndex > maxIndex) {
                    maxLevel = rp.level;
                }
            });

            expect(maxLevel).toBe('limited');
        });

        it('should return none when no permissions match', () => {
            const levels = ['none', 'read', 'limited', 'full'];
            const rolePermissions = []; // No permissions

            let maxLevel = 'none';
            rolePermissions.forEach(rp => {
                const currentIndex = levels.indexOf(rp.level || 'none');
                const maxIndex = levels.indexOf(maxLevel);
                if (currentIndex > maxIndex) {
                    maxLevel = rp.level;
                }
            });

            expect(maxLevel).toBe('none');
        });
    });

    describe('System-Scoped Role Query Logic', () => {
        it('should construct query to include both tenant-scoped and system-scoped roles', () => {
            const userId = 'user-1';
            const tenantId = 'tenant-1';
            const { Op } = require('sequelize');

            // This should be how the query is constructed
            const whereClause = {
                userId,
                [Op.or]: [{ tenantId }, { tenantId: null }]
            };

            // Verify structure: userId + Op.or symbol with array of conditions
            expect(whereClause.userId).toBe('user-1');
            expect(Array.isArray(whereClause[Op.or])).toBe(true);
            expect(whereClause[Op.or].length).toBe(2);
        });

        it('should match both tenant-specific and system-wide Super Admin roles', () => {
            const userRolesSample = [
                { userId: 'user-1', tenantId: 'tenant-1', role: 'TEACHER' },
                { userId: 'user-1', tenantId: null, role: 'SUPER_ADMIN' }
            ];

            const superAdminRole = userRolesSample.find(ur => ur.role === 'SUPER_ADMIN');
            const isSuperAdmin = superAdminRole !== undefined;

            expect(isSuperAdmin).toBe(true);
            expect(superAdminRole.tenantId).toBeNull();
        });
    });
});

