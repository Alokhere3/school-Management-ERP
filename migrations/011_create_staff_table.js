'use strict';

/**
 * Migration: Create Staff Table
 * 
 * Creates the staff table with all fields from the staff management form.
 * Staff members are employees of the school (non-teaching staff like HR, Admin, etc.)
 */

module.exports = {
    async up(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            await queryInterface.createTable('staff', {
                id: {
                    type: Sequelize.UUID,
                    defaultValue: Sequelize.UUIDV4,
                    primaryKey: true
                },
                tenantId: {
                    type: Sequelize.UUID,
                    allowNull: false,
                    references: {
                        model: 'tenants',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE'
                },
                userId: {
                    type: Sequelize.UUID,
                    allowNull: true,
                    references: {
                        model: 'users',
                        key: 'id'
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL'
                },
                
                // Personal Information
                firstName: {
                    type: Sequelize.STRING(100),
                    allowNull: false
                },
                lastName: {
                    type: Sequelize.STRING(100),
                    allowNull: false
                },
                photoUrl: Sequelize.STRING(500),
                photoKey: Sequelize.STRING(500),
                role: Sequelize.STRING(100),
                department: Sequelize.STRING(100),
                designation: Sequelize.STRING(100),
                gender: {
                    type: Sequelize.ENUM('Male', 'Female', 'Other'),
                    allowNull: true
                },
                primaryContactNumber: Sequelize.STRING(20),
                email: {
                    type: Sequelize.STRING(255),
                    allowNull: true
                },
                bloodGroup: Sequelize.STRING(10),
                maritalStatus: {
                    type: Sequelize.ENUM('Single', 'Married'),
                    allowNull: true
                },
                fathersName: Sequelize.STRING(255),
                mothersName: Sequelize.STRING(255),
                dateOfBirth: Sequelize.DATEONLY,
                dateOfJoining: Sequelize.DATEONLY,
                languageKnown: {
                    type: Sequelize.JSON,
                    allowNull: true
                },
                qualification: Sequelize.STRING(255),
                workExperience: Sequelize.STRING(255),
                note: Sequelize.TEXT,
                address: Sequelize.TEXT,
                permanentAddress: Sequelize.TEXT,
                
                // Payroll
                epfNo: Sequelize.STRING(50),
                basicSalary: {
                    type: Sequelize.DECIMAL(10, 2),
                    allowNull: true
                },
                contractType: {
                    type: Sequelize.ENUM('Permanent', 'Temporary'),
                    allowNull: true
                },
                workShift: {
                    type: Sequelize.ENUM('Morning', 'Afternoon', 'Night'),
                    allowNull: true
                },
                workLocation: Sequelize.STRING(255),
                
                // Leaves
                medicalLeaves: {
                    type: Sequelize.INTEGER,
                    defaultValue: 0
                },
                casualLeaves: {
                    type: Sequelize.INTEGER,
                    defaultValue: 0
                },
                maternityLeaves: {
                    type: Sequelize.INTEGER,
                    defaultValue: 0
                },
                sickLeaves: {
                    type: Sequelize.INTEGER,
                    defaultValue: 0
                },
                
                // Bank Details
                accountName: Sequelize.STRING(255),
                accountNumber: Sequelize.STRING(50),
                bankName: Sequelize.STRING(255),
                ifscCode: Sequelize.STRING(20),
                branchName: Sequelize.STRING(255),
                
                // Transport
                transportEnabled: {
                    type: Sequelize.BOOLEAN,
                    defaultValue: false
                },
                transportRoute: Sequelize.STRING(255),
                vehicleNumber: Sequelize.STRING(50),
                pickupPoint: Sequelize.STRING(255),
                
                // Hostel
                hostelEnabled: {
                    type: Sequelize.BOOLEAN,
                    defaultValue: false
                },
                hostelName: Sequelize.STRING(255),
                roomNo: Sequelize.STRING(50),
                
                // Social Media
                facebookUrl: Sequelize.STRING(500),
                twitterUrl: Sequelize.STRING(500),
                linkedinUrl: Sequelize.STRING(500),
                instagramUrl: Sequelize.STRING(500),
                
                // Documents
                resumeUrl: Sequelize.STRING(500),
                resumeKey: Sequelize.STRING(500),
                joiningLetterUrl: Sequelize.STRING(500),
                joiningLetterKey: Sequelize.STRING(500),
                
                // Status
                status: {
                    type: Sequelize.ENUM('active', 'inactive', 'terminated'),
                    defaultValue: 'active'
                },
                
                createdAt: {
                    type: Sequelize.DATE,
                    allowNull: false,
                    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
                },
                updatedAt: {
                    type: Sequelize.DATE,
                    allowNull: false,
                    defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
                }
            }, { transaction });
            
            // Add indexes - check if they exist first
            const [existingIndexes] = await queryInterface.sequelize.query(
                `SHOW INDEXES FROM staff WHERE Key_name IN (
                    'staff_tenantId_status',
                    'staff_tenantId_department',
                    'staff_tenantId_role',
                    'staff_tenantId_designation',
                    'staff_userId',
                    'staff_email'
                )`
            );
            
            const existingIndexNames = existingIndexes.map(idx => idx.Key_name);
            
            if (!existingIndexNames.includes('staff_tenantId_status')) {
                await queryInterface.addIndex('staff', ['tenantId', 'status'], { 
                    name: 'staff_tenantId_status',
                    transaction 
                });
                console.log('  ✓ Added index: staff_tenantId_status');
            }
            
            if (!existingIndexNames.includes('staff_tenantId_department')) {
                await queryInterface.addIndex('staff', ['tenantId', 'department'], { 
                    name: 'staff_tenantId_department',
                    transaction 
                });
                console.log('  ✓ Added index: staff_tenantId_department');
            }
            
            if (!existingIndexNames.includes('staff_tenantId_role')) {
                await queryInterface.addIndex('staff', ['tenantId', 'role'], { 
                    name: 'staff_tenantId_role',
                    transaction 
                });
                console.log('  ✓ Added index: staff_tenantId_role');
            }
            
            if (!existingIndexNames.includes('staff_tenantId_designation')) {
                await queryInterface.addIndex('staff', ['tenantId', 'designation'], { 
                    name: 'staff_tenantId_designation',
                    transaction 
                });
                console.log('  ✓ Added index: staff_tenantId_designation');
            }
            
            if (!existingIndexNames.includes('staff_userId')) {
                await queryInterface.addIndex('staff', ['userId'], { 
                    name: 'staff_userId',
                    transaction 
                });
                console.log('  ✓ Added index: staff_userId');
            }
            
            if (!existingIndexNames.includes('staff_email')) {
                await queryInterface.addIndex('staff', ['email'], { 
                    name: 'staff_email',
                    transaction 
                });
                console.log('  ✓ Added index: staff_email');
            }
            
            await transaction.commit();
            console.log('✅ Staff table created successfully');
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Error creating staff table:', error.message);
            throw error;
        }
    },

    async down(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            await queryInterface.dropTable('staff', { transaction });
            await transaction.commit();
            console.log('✅ Staff table dropped successfully');
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Error dropping staff table:', error.message);
            throw error;
        }
    }
};

