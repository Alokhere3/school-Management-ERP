/**
 * Mapping of Frontend Routes to Backend Permissions (Resource:Action)
 * Used to determine which routes a user can access/view based on their permissions.
 *
 * Format: routeKey: 'resource:action'
 * If a route requires multiple permissions, logic can be extended (currently 1:1 or 1:any).
 * If a route is public or always allowed for authenticated users, set to 'authenticated'.
 * If a route requires no permissions use 'public' (though usually handled by middleware).
 */

const ROUTE_PERMISSION_MAP = {
    // --- Dashboard ---
    adminDashboard: 'user_management:read', // Restricted to Admin, Principal, HR, Accountant
    parentDashboard: 'students:read', // Parents have read access to kids
    studentDashboard: 'lms:read', // Students use LMS
    teacherDashboard: 'attendance_students:update', // Teachers take attendance

    // --- User Management ---
    manageusers: 'user_management:read',
    rolesPermissions: 'user_management:read', // Specifically roles? Maybe 'user_management:create' or special perm? Using read for nav visibility.
    permissions: 'user_management:read',
    deleteRequest: 'user_management:delete',

    // --- Students ---
    studentGrid: 'students:read',
    studentList: 'students:read',
    studentDetail: 'students:read',
    addStudent: 'students:create',
    editStudent: 'students:update',
    studentPromotion: 'students:update', // Or admissions?
    studentTimeTable: 'timetable:read',
    studentLeaves: 'attendance_students:read',
    studentFees: 'fees:read',
    studentResult: 'exams:read',
    studentLibrary: 'library:read',

    // --- Teachers (Mapped to HR/Payroll or specific Staff modules) ---
    // Assuming 'hr_payroll' covers staff management as per matrix description ("HR Manager")
    teacherGrid: 'hr_payroll:read',
    teacherList: 'hr_payroll:read',
    teacherDetails: 'hr_payroll:read',
    addTeacher: 'hr_payroll:create',
    editTeacher: 'hr_payroll:update',
    teacherLibrary: 'library:read',
    teacherSalary: 'hr_payroll:read', // specifics might need 'fees' or 'finance'? Matrix says 'hr_payroll' is specific resource.
    teacherLeaves: 'attendance_staff:read',
    teachersRoutine: 'timetable:read',

    // --- Parents ---
    parentGrid: 'students:read', // Parents are usually accessed via students or user_mgmt. Let's say students:read allows viewing parent info? Or user_management?
    parentList: 'students:read',
    guardiansGrid: 'students:read',
    guardiansList: 'students:read',

    // --- Academic ---
    classes: 'school_config:read', // Or 'timetable'? 'school_config' has classes?
    classRoutine: 'timetable:read',
    classTimetable: 'timetable:read',
    classSubject: 'school_config:read', // Subjects usually config
    classSection: 'school_config:read',
    classSyllabus: 'lms:read',
    classHomeWork: 'lms:read',
    sheduleClasses: 'timetable:create',

    // --- Exams ---
    exam: 'exams:read',
    examSchedule: 'exams:read',
    examResult: 'exams:read',
    examAttendance: 'exams:read',
    grade: 'exams:read',

    // --- Fees ---
    feesGroup: 'fees:read',
    feesType: 'fees:read',
    feesMaster: 'fees:read',
    feesAssign: 'fees:create',
    collectFees: 'fees:create',
    feesReport: 'fees:read',

    // --- Library ---
    libraryBooks: 'library:read',
    libraryMembers: 'library:read',
    libraryIssueBook: 'library:create',
    libraryReturn: 'library:update',

    // --- Transport ---
    transportVehicle: 'transport:read',
    transportRoutes: 'transport:read',
    transportAssignVehicle: 'transport:create',

    // --- Hostel ---
    hostelList: 'hostel:read',
    hostelRoom: 'hostel:read',
    hostelType: 'hostel:read',

    // --- HR / Staff ---
    staff: 'hr_payroll:read',
    staffDetails: 'hr_payroll:read',
    addStaff: 'hr_payroll:create',
    editStaff: 'hr_payroll:update',
    departments: 'hr_payroll:read',
    designation: 'hr_payroll:read',
    payroll: 'hr_payroll:read',
    staffPayroll: 'hr_payroll:read',
    staffAttendance: 'attendance_staff:read',
    staffLeaves: 'attendance_staff:read',
    approveRequest: 'hr_payroll:update', // Leave approval?

    // --- Finance (Accounts) ---
    accountsIncome: 'fees:read', // or separate 'finance' module? Matrix has 'fees'. 'inventory'?
    accountsInvoices: 'fees:read',
    accountsTransactions: 'fees:read',
    expense: 'fees:read', // Matrix doesn't have explicit 'expenses', maybe 'fees' covers all finance or 'inventory'? 'fees' is best fit for now.
    invoice: 'fees:read',

    // --- Communication / Announcements ---
    events: 'communication:read',
    noticeBoard: 'communication:read',
    contactMessages: 'communication:read',

    // --- Settings ---
    schoolSettings: 'school_config:update',
    paymentGateways: 'school_config:update',
    smsSettings: 'school_config:update',
    emailSettings: 'school_config:update',
    rolesPermissions: 'user_management:update',
    backup: 'technical_ops:read',

    // --- Reports ---
    attendanceReport: 'analytics:read',
    classReport: 'analytics:read',
    studentReport: 'analytics:read',
    gradeReport: 'analytics:read',
    teacherReport: 'analytics:read',

    // --- CMS / Website ---
    // (Assuming 'communication' or 'school_config' covers public site content?)
    allBlogs: 'communication:read',

    // Application (Generic)
    chat: 'communication:read',
    email: 'communication:read',
    todo: 'authenticated', // Personal
    calendar: 'authenticated', // Personal/Global

    // Default fallback
    error404: 'public',
    error500: 'public',
    login: 'public',
    register: 'public'
};

module.exports = ROUTE_PERMISSION_MAP;
