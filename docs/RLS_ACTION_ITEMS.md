# RLS Implementation - Action Items

## 🎯 Current Status: PHASE 1 COMPLETE ✅

### What's Complete
- ✅ BaseRepository with RLS enforcement
- ✅ StudentRepository (fully implemented)
- ✅ StaffRepository (fully implemented)
- ✅ UserRepository (fully implemented)
- ✅ ClassRepository (fully implemented)
- ✅ RepositoryFactory
- ✅ RLS Middleware
- ✅ studentController.js migration (example)
- ✅ server.js integration
- ✅ Comprehensive documentation

---

## 📋 PHASE 2: Controller Migration (CRITICAL)

Complete these to achieve full RLS coverage. Follow [RLS_MIGRATION_GUIDE.md](./RLS_MIGRATION_GUIDE.md) for each.

### High Priority (Data-Sensitive)

#### 1. staffController.js
**File**: `/controllers/staffController.js`
**Status**: ❌ Not Started
**Effort**: ~2 hours
**Risk**: HIGH (access control sensitive)

Tasks:
- [ ] Add `const { RepositoryFactory } = require('../repositories'); const repos = new RepositoryFactory();`
- [ ] Remove `applyRowLevelSecurity()` function
- [ ] Update `listStaff()` to use `repos.staff.findVisibleStaff(userContext, filters, options)`
- [ ] Update `getStaffById()` to use `repos.staff.findStaffById(id, userContext)`
- [ ] Update `createStaff()` to use `repos.staff.createStaff(data, userContext)`
- [ ] Update `updateStaff()` to use `repos.staff.updateStaff(id, updates, userContext)`
- [ ] Update `deleteStaff()` to use `repos.staff.deleteStaff(id, userContext)`
- [ ] Add proper error handling for INSUFFICIENT_PERMISSIONS
- [ ] Test with admin, HR manager, and staff roles

#### 2. userController.js
**File**: `/controllers/userController.js`
**Status**: ❌ Not Started
**Effort**: ~1.5 hours
**Risk**: HIGH (identity sensitive)

Tasks:
- [ ] Add repository factory
- [ ] Update all user listing/retrieval to use `repos.user.*` methods
- [ ] Ensure users can only see/modify their own records (except admins)
- [ ] Test cross-tenant isolation

#### 3. classController.js
**File**: `/controllers/classController.js`
**Status**: ❌ Not Started
**Effort**: ~1.5 hours
**Risk**: MEDIUM

Tasks:
- [ ] Add repository factory
- [ ] Update class methods to use `repos.class.*`
- [ ] Ensure teachers only see their classes
- [ ] Students only see their own class
- [ ] Test RLS rules

#### 4. permissionController.js
**File**: `/controllers/permissionController.js`
**Status**: ❌ Not Started
**Effort**: ~1 hour
**Risk**: MEDIUM

Tasks:
- [ ] Review permission access patterns
- [ ] Add RLS if needed (likely admin-only)
- [ ] Use repositories for any data access

#### 5. roleController.js
**File**: `/controllers/roleController.js`
**Status**: ❌ Not Started
**Effort**: ~1 hour
**Risk**: MEDIUM

Tasks:
- [ ] Review role access patterns
- [ ] Add RLS if needed (likely admin-only)
- [ ] Use repositories for any data access

### Medium Priority

#### 6. rolePermissionController.js
**File**: `/controllers/rolePermissionController.js`
**Status**: ❌ Not Started
**Effort**: ~1 hour

#### 7. tenantController.js
**File**: `/controllers/tenantController.js`
**Status**: ❌ Not Started
**Effort**: ~0.5 hours
**Note**: Should be admin-only access

#### 8. onboardingController.js
**File**: `/controllers/onboardingController.js`
**Status**: ❌ Not Started
**Effort**: ~0.5 hours

---

## 🧪 PHASE 3: Testing (CRITICAL)

### Unit Tests

Create `/tests/repositories/` directory with tests for:

```
tests/
  repositories/
    ├── BaseRepository.test.js
    ├── StudentRepository.test.js
    ├── StaffRepository.test.js
    ├── UserRepository.test.js
    └── ClassRepository.test.js
```

**Each test should verify**:
- ✅ Admin sees all data in tenant
- ✅ Teacher/Staff see only accessible data
- ✅ Parent sees only own children
- ✅ Student sees only own record
- ✅ Cross-tenant isolation is maintained
- ✅ Missing context throws error
- ✅ Invalid roles handled correctly

### Integration Tests

Create `/tests/integration/` with:

```
tests/
  integration/
    ├── RLS_cross_tenant.test.js
    ├── student_access_control.test.js
    ├── staff_access_control.test.js
    └── user_access_control.test.js
```

**Tests**:
- ✅ User from Tenant A cannot see Tenant B data
- ✅ Teacher sees only assigned students
- ✅ Parent sees only own children
- ✅ Student cannot modify own details
- ✅ Non-admins cannot see all users

### API Tests

Test with Postman/Jest:

```bash
# Test as admin (should get all students)
curl -H "Authorization: Bearer $ADMIN_TOKEN" /api/students

# Test as teacher (should get only own students)
curl -H "Authorization: Bearer $TEACHER_TOKEN" /api/students

# Test as parent (should get only own children)
curl -H "Authorization: Bearer $PARENT_TOKEN" /api/students

# Test as student (should get only own record)
curl -H "Authorization: Bearer $STUDENT_TOKEN" /api/students
```

---

## 📝 PHASE 4: Cleanup & Documentation

### Service Layer Deprecation

- [ ] Review `services/studentService.js` - Mark methods as deprecated
- [ ] Review `services/staffService.js` - Mark methods as deprecated
- [ ] Update any remaining direct model access to use repositories
- [ ] Create deprecation warnings in old service methods

### Update Tests

- [ ] Update controller tests to use repositories
- [ ] Update service tests to verify they're not bypassing RLS
- [ ] Add RLS-specific test cases
- [ ] Verify all tests pass with RLS enforced

### Performance Verification

- [ ] Run load tests to verify no performance regression
- [ ] Check query plans for index usage:
  ```sql
  EXPLAIN ANALYZE SELECT * FROM students 
  WHERE tenantId = 'X' AND teacherId = 'Y';
  ```
- [ ] Verify pagination works correctly
- [ ] Check database connection pooling

### Documentation Updates

- [ ] Update API.md with RLS guarantees
- [ ] Update DEPLOYMENT.md with security checklist
- [ ] Add RLS section to SECURITY.md
- [ ] Update README with RLS information
- [ ] Create runbook for RLS troubleshooting

---

## 🔍 PHASE 5: Security Verification

### Automated Checks

- [ ] Create linter rule: "Model access outside repository is forbidden"
- [ ] Add pre-commit hook to scan for direct model usage
- [ ] Enable compiler/linter warnings for unsafe patterns

### Manual Audit

- [ ] Code review all controllers for direct model access
- [ ] Verify every repository call includes userContext
- [ ] Check that no tenantId is manually specified
- [ ] Verify all RBAC rules match business requirements

### Security Testing

- [ ] Penetration test: Try to access other tenant's data
- [ ] Privilege escalation test: Try to view admin-only data
- [ ] Timing attack test: Check for differences in error responses
- [ ] SQL injection test: Verify Sequelize prevents injection

### Compliance Verification

- [ ] Verify audit logs capture all data access
- [ ] Check that sensitive fields are not logged
- [ ] Verify data retention policies
- [ ] Document compliance status

---

## 📊 Progress Tracking

### Completion Percentage

```
Phase 1: Repository Implementation    ✅ 100% DONE
Phase 2: Controller Migration         ⏳ 0% (Not started)
Phase 3: Testing                      ⏳ 0% (Not started)
Phase 4: Cleanup                      ⏳ 0% (Not started)
Phase 5: Security Verification        ⏳ 0% (Not started)

Overall: 20% Complete (6 of 30 weeks of work)
```

### Timeline Estimate

Assuming 1-2 developers:

| Phase | Duration | Start | End |
|-------|----------|-------|-----|
| Phase 1 | 1 week | ✅ Done | Jan 8 |
| Phase 2 | 2 weeks | Jan 9 | Jan 23 |
| Phase 3 | 1 week | Jan 23 | Jan 30 |
| Phase 4 | 1 week | Jan 30 | Feb 6 |
| Phase 5 | 1 week | Feb 6 | Feb 13 |

---

## 🚨 Risk Management

### Critical Risks

**Risk**: Incomplete migration leaves some controllers without RLS
**Mitigation**: Complete checklist verification before deployment

**Risk**: Tests don't catch cross-tenant data leakage
**Mitigation**: Automated tests with multiple tenants and roles

**Risk**: Performance degradation from repository layer
**Mitigation**: Load testing and query plan analysis

### Pre-Deployment Checklist

- [ ] All controllers migrated and using repositories
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Cross-tenant isolation verified
- [ ] Performance baseline met
- [ ] Security audit completed
- [ ] Code review approved
- [ ] Deployment plan documented
- [ ] Rollback procedure documented
- [ ] Team trained on RLS

---

## 📞 Getting Help

### Questions?
1. Check [RLS_IMPLEMENTATION.md](./RLS_IMPLEMENTATION.md) - Full technical details
2. Check [RLS_MIGRATION_GUIDE.md](./RLS_MIGRATION_GUIDE.md) - Step-by-step examples
3. Check [RLS_QUICK_REFERENCE.md](./RLS_QUICK_REFERENCE.md) - Quick lookup
4. Review [studentController.js](../controllers/studentController.js) - Reference implementation

### Issues?
1. Check error message in logs
2. Search for error code in documentation
3. Run diagnostics:
   ```javascript
   console.log('userContext:', req.userContext);
   console.log('has tenantId:', !!req.userContext?.tenantId);
   console.log('has userId:', !!req.userContext?.userId);
   ```

---

## 🎯 Success Criteria

- ✅ All controllers use repositories
- ✅ Zero direct model access in controllers
- ✅ 100% test coverage for RLS rules
- ✅ Cross-tenant isolation verified
- ✅ Performance benchmarks met
- ✅ Security audit passed
- ✅ Documentation complete
- ✅ Team trained
- ✅ Zero production incidents related to RLS

---

**Last Updated**: January 8, 2026  
**Next Review**: After completing first controller migration  
**Priority**: 🔴 CRITICAL - Blocks production deployment
