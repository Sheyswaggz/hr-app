/**
 * Migration: Create Employees Table
 * 
 * Creates the employees table with detailed employee information including
 * employment status, department, position, and manager relationships.
 * Includes proper constraints, indexes, and audit timestamps.
 * 
 * @module migrations/002_create_employees_table
 */

/**
 * Employee status enumeration values
 * @readonly
 * @enum {string}
 */
const EMPLOYEE_STATUS = Object.freeze({
  ACTIVE: 'active',
  ON_LEAVE: 'on_leave',
  TERMINATED: 'terminated',
});

/**
 * Migration metadata
 * @type {Object}
 */
const MIGRATION_METADATA = Object.freeze({
  version: '002',
  name: 'create_employees_table',
  description: 'Create employees table with detailed employee information and relationships',
  author: 'system',
  timestamp: new Date().toISOString(),
});

/**
 * Up migration: Create employees table and related objects
 * 
 * Creates:
 * - employee_status enum type
 * - employees table with all required columns
 * - foreign key constraints to users table
 * - self-referencing foreign key for manager relationship
 * - indexes on user_id, employee_number, manager_id, department
 * - trigger for updated_at timestamp
 * - check constraints for data validation
 * 
 * @param {import('node-pg-migrate').MigrationBuilder} pgm - Migration builder instance
 * @returns {Promise<void>}
 */
async function up(pgm) {
  const startTime = Date.now();
  
  console.log('[MIGRATION_002_UP] Starting employees table creation...');
  console.log('[MIGRATION_002_UP] Metadata:', JSON.stringify(MIGRATION_METADATA, null, 2));

  try {
    // Verify users table exists (dependency check)
    console.log('[MIGRATION_002_UP] Verifying users table exists...');
    pgm.sql(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'users'
        ) THEN
          RAISE EXCEPTION 'Users table does not exist. Run migration 001 first.';
        END IF;
      END $$;
    `);
    console.log('[MIGRATION_002_UP] Users table verified successfully');

    // Create employee_status enum type
    console.log('[MIGRATION_002_UP] Creating employee_status enum type...');
    pgm.createType('employee_status', [
      EMPLOYEE_STATUS.ACTIVE,
      EMPLOYEE_STATUS.ON_LEAVE,
      EMPLOYEE_STATUS.TERMINATED,
    ]);
    console.log('[MIGRATION_002_UP] employee_status enum type created successfully');

    // Create employees table
    console.log('[MIGRATION_002_UP] Creating employees table...');
    pgm.createTable('employees', {
      id: {
        type: 'uuid',
        primaryKey: true,
        default: pgm.func('gen_random_uuid()'),
        notNull: true,
        comment: 'Unique identifier for the employee',
      },
      user_id: {
        type: 'uuid',
        notNull: true,
        unique: true,
        comment: 'Foreign key reference to users table (one-to-one relationship)',
      },
      employee_number: {
        type: 'varchar(50)',
        notNull: true,
        unique: true,
        comment: 'Unique employee identification number',
      },
      department: {
        type: 'varchar(100)',
        notNull: true,
        comment: 'Department name where employee works',
      },
      position: {
        type: 'varchar(100)',
        notNull: true,
        comment: 'Job title or position',
      },
      hire_date: {
        type: 'date',
        notNull: true,
        comment: 'Date when employee was hired',
      },
      manager_id: {
        type: 'uuid',
        notNull: false,
        comment: 'Self-referencing foreign key to employees table (manager relationship)',
      },
      status: {
        type: 'employee_status',
        notNull: true,
        default: EMPLOYEE_STATUS.ACTIVE,
        comment: 'Current employment status',
      },
      created_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('NOW()'),
        comment: 'Timestamp when the employee record was created (UTC)',
      },
      updated_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('NOW()'),
        comment: 'Timestamp when the employee record was last updated (UTC)',
      },
    }, {
      comment: 'Employees table storing detailed employee information and relationships',
      ifNotExists: true,
    });
    console.log('[MIGRATION_002_UP] employees table created successfully');

    // Add foreign key constraint to users table
    console.log('[MIGRATION_002_UP] Adding foreign key constraint to users table...');
    pgm.addConstraint('employees', 'fk_employees_user_id', {
      foreignKeys: {
        columns: 'user_id',
        references: 'users(id)',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
    });
    console.log('[MIGRATION_002_UP] Foreign key constraint to users table added successfully');

    // Add self-referencing foreign key constraint for manager relationship
    console.log('[MIGRATION_002_UP] Adding self-referencing foreign key constraint for manager...');
    pgm.addConstraint('employees', 'fk_employees_manager_id', {
      foreignKeys: {
        columns: 'manager_id',
        references: 'employees(id)',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
    });
    console.log('[MIGRATION_002_UP] Self-referencing foreign key constraint added successfully');

    // Create index on user_id for fast lookups
    console.log('[MIGRATION_002_UP] Creating index on user_id column...');
    pgm.createIndex('employees', 'user_id', {
      name: 'idx_employees_user_id',
      unique: true,
      ifNotExists: true,
      method: 'btree',
    });
    console.log('[MIGRATION_002_UP] Index idx_employees_user_id created successfully');

    // Create index on employee_number for fast lookups
    console.log('[MIGRATION_002_UP] Creating index on employee_number column...');
    pgm.createIndex('employees', 'employee_number', {
      name: 'idx_employees_employee_number',
      unique: true,
      ifNotExists: true,
      method: 'btree',
    });
    console.log('[MIGRATION_002_UP] Index idx_employees_employee_number created successfully');

    // Create index on manager_id for hierarchical queries
    console.log('[MIGRATION_002_UP] Creating index on manager_id column...');
    pgm.createIndex('employees', 'manager_id', {
      name: 'idx_employees_manager_id',
      ifNotExists: true,
      method: 'btree',
      where: 'manager_id IS NOT NULL',
    });
    console.log('[MIGRATION_002_UP] Index idx_employees_manager_id created successfully');

    // Create index on department for filtering and reporting
    console.log('[MIGRATION_002_UP] Creating index on department column...');
    pgm.createIndex('employees', 'department', {
      name: 'idx_employees_department',
      ifNotExists: true,
      method: 'btree',
    });
    console.log('[MIGRATION_002_UP] Index idx_employees_department created successfully');

    // Create composite index on status and department for active employee queries
    console.log('[MIGRATION_002_UP] Creating composite index on status and department...');
    pgm.createIndex('employees', ['status', 'department'], {
      name: 'idx_employees_status_department',
      ifNotExists: true,
      method: 'btree',
      where: "status = 'active'",
    });
    console.log('[MIGRATION_002_UP] Index idx_employees_status_department created successfully');

    // Create index on hire_date for tenure calculations and reporting
    console.log('[MIGRATION_002_UP] Creating index on hire_date column...');
    pgm.createIndex('employees', 'hire_date', {
      name: 'idx_employees_hire_date',
      ifNotExists: true,
      method: 'btree',
    });
    console.log('[MIGRATION_002_UP] Index idx_employees_hire_date created successfully');

    // Create trigger on employees table for updated_at
    console.log('[MIGRATION_002_UP] Creating trigger on employees table...');
    pgm.createTrigger('employees', 'update_employees_updated_at', {
      when: 'BEFORE',
      operation: 'UPDATE',
      function: 'update_updated_at_column',
      level: 'ROW',
    });
    console.log('[MIGRATION_002_UP] Trigger update_employees_updated_at created successfully');

    // Add constraint to ensure employee_number is not empty
    console.log('[MIGRATION_002_UP] Adding employee_number format constraint...');
    pgm.addConstraint('employees', 'employees_employee_number_format_check', {
      check: "LENGTH(TRIM(employee_number)) > 0",
    });
    console.log('[MIGRATION_002_UP] Employee number format constraint added successfully');

    // Add constraint to ensure department is not empty
    console.log('[MIGRATION_002_UP] Adding department format constraint...');
    pgm.addConstraint('employees', 'employees_department_format_check', {
      check: "LENGTH(TRIM(department)) > 0",
    });
    console.log('[MIGRATION_002_UP] Department format constraint added successfully');

    // Add constraint to ensure position is not empty
    console.log('[MIGRATION_002_UP] Adding position format constraint...');
    pgm.addConstraint('employees', 'employees_position_format_check', {
      check: "LENGTH(TRIM(position)) > 0",
    });
    console.log('[MIGRATION_002_UP] Position format constraint added successfully');

    // Add constraint to ensure hire_date is not in the future
    console.log('[MIGRATION_002_UP] Adding hire_date validation constraint...');
    pgm.addConstraint('employees', 'employees_hire_date_check', {
      check: "hire_date <= CURRENT_DATE",
    });
    console.log('[MIGRATION_002_UP] Hire date validation constraint added successfully');

    // Add constraint to prevent self-referencing manager (employee cannot be their own manager)
    console.log('[MIGRATION_002_UP] Adding self-reference prevention constraint...');
    pgm.addConstraint('employees', 'employees_no_self_manager_check', {
      check: "manager_id IS NULL OR manager_id != id",
    });
    console.log('[MIGRATION_002_UP] Self-reference prevention constraint added successfully');

    const duration = Date.now() - startTime;
    console.log(`[MIGRATION_002_UP] Migration completed successfully in ${duration}ms`);
    console.log('[MIGRATION_002_UP] Summary:', {
      table: 'employees',
      columns: 10,
      indexes: 6,
      constraints: 7,
      foreign_keys: 2,
      triggers: 1,
      duration_ms: duration,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[MIGRATION_002_UP] FATAL: Migration failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
    throw new Error(
      `[MIGRATION_002_UP] Failed to create employees table: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Down migration: Drop employees table and related objects
 * 
 * Drops (in reverse order of creation):
 * - Constraints
 * - Trigger on employees table
 * - Indexes
 * - Foreign key constraints
 * - employees table
 * - employee_status enum type
 * 
 * @param {import('node-pg-migrate').MigrationBuilder} pgm - Migration builder instance
 * @returns {Promise<void>}
 */
async function down(pgm) {
  const startTime = Date.now();
  
  console.log('[MIGRATION_002_DOWN] Starting employees table rollback...');
  console.log('[MIGRATION_002_DOWN] Metadata:', JSON.stringify(MIGRATION_METADATA, null, 2));

  try {
    // Drop trigger first
    console.log('[MIGRATION_002_DOWN] Dropping trigger update_employees_updated_at...');
    pgm.dropTrigger('employees', 'update_employees_updated_at', {
      ifExists: true,
      cascade: true,
    });
    console.log('[MIGRATION_002_DOWN] Trigger dropped successfully');

    // Drop indexes (not strictly necessary as they'll be dropped with table, but explicit is better)
    console.log('[MIGRATION_002_DOWN] Dropping indexes...');
    pgm.dropIndex('employees', 'user_id', {
      name: 'idx_employees_user_id',
      ifExists: true,
    });
    pgm.dropIndex('employees', 'employee_number', {
      name: 'idx_employees_employee_number',
      ifExists: true,
    });
    pgm.dropIndex('employees', 'manager_id', {
      name: 'idx_employees_manager_id',
      ifExists: true,
    });
    pgm.dropIndex('employees', 'department', {
      name: 'idx_employees_department',
      ifExists: true,
    });
    pgm.dropIndex('employees', ['status', 'department'], {
      name: 'idx_employees_status_department',
      ifExists: true,
    });
    pgm.dropIndex('employees', 'hire_date', {
      name: 'idx_employees_hire_date',
      ifExists: true,
    });
    console.log('[MIGRATION_002_DOWN] Indexes dropped successfully');

    // Drop constraints
    console.log('[MIGRATION_002_DOWN] Dropping constraints...');
    pgm.dropConstraint('employees', 'employees_no_self_manager_check', {
      ifExists: true,
    });
    pgm.dropConstraint('employees', 'employees_hire_date_check', {
      ifExists: true,
    });
    pgm.dropConstraint('employees', 'employees_position_format_check', {
      ifExists: true,
    });
    pgm.dropConstraint('employees', 'employees_department_format_check', {
      ifExists: true,
    });
    pgm.dropConstraint('employees', 'employees_employee_number_format_check', {
      ifExists: true,
    });
    console.log('[MIGRATION_002_DOWN] Constraints dropped successfully');

    // Drop foreign key constraints
    console.log('[MIGRATION_002_DOWN] Dropping foreign key constraints...');
    pgm.dropConstraint('employees', 'fk_employees_manager_id', {
      ifExists: true,
      cascade: true,
    });
    pgm.dropConstraint('employees', 'fk_employees_user_id', {
      ifExists: true,
      cascade: true,
    });
    console.log('[MIGRATION_002_DOWN] Foreign key constraints dropped successfully');

    // Drop employees table
    console.log('[MIGRATION_002_DOWN] Dropping employees table...');
    pgm.dropTable('employees', {
      ifExists: true,
      cascade: true,
    });
    console.log('[MIGRATION_002_DOWN] employees table dropped successfully');

    // Drop employee_status enum type
    console.log('[MIGRATION_002_DOWN] Dropping employee_status enum type...');
    pgm.dropType('employee_status', {
      ifExists: true,
      cascade: true,
    });
    console.log('[MIGRATION_002_DOWN] employee_status enum type dropped successfully');

    const duration = Date.now() - startTime;
    console.log(`[MIGRATION_002_DOWN] Rollback completed successfully in ${duration}ms`);
    console.log('[MIGRATION_002_DOWN] Summary:', {
      table: 'employees',
      operation: 'dropped',
      duration_ms: duration,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[MIGRATION_002_DOWN] FATAL: Rollback failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
    throw new Error(
      `[MIGRATION_002_DOWN] Failed to drop employees table: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Validate migration environment
 * 
 * @returns {boolean} True if environment is valid
 */
function validateEnvironment() {
  const requiredEnvVars = ['DATABASE_URL', 'DB_HOST', 'DB_NAME'];
  const hasRequiredVars = requiredEnvVars.some(
    (varName) => process.env[varName] !== undefined
  );

  if (!hasRequiredVars) {
    console.warn(
      '[MIGRATION_002] WARNING: No database configuration found in environment. ' +
      'Ensure DATABASE_URL or DB_* variables are set.'
    );
  }

  return true;
}

// Validate environment on module load
validateEnvironment();

// Export migration functions
module.exports = {
  up,
  down,
  EMPLOYEE_STATUS,
  MIGRATION_METADATA,
};

// Named exports for ES module compatibility
exports.up = up;
exports.down = down;
exports.EMPLOYEE_STATUS = EMPLOYEE_STATUS;
exports.MIGRATION_METADATA = MIGRATION_METADATA;