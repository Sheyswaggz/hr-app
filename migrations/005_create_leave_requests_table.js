/**
 * Migration: Create Leave Requests Table
 * 
 * Creates the leave_requests table for managing employee leave requests
 * including leave type, dates, approval workflow, and status tracking.
 * Includes proper constraints, indexes, and audit timestamps.
 * 
 * @module migrations/005_create_leave_requests_table
 */

/**
 * Leave type enumeration values
 * @readonly
 * @enum {string}
 */
const LEAVE_TYPE = Object.freeze({
  ANNUAL: 'annual',
  SICK: 'sick',
  UNPAID: 'unpaid',
  OTHER: 'other',
});

/**
 * Leave request status enumeration values
 * @readonly
 * @enum {string}
 */
const LEAVE_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

/**
 * Migration metadata
 * @type {Object}
 */
const MIGRATION_METADATA = Object.freeze({
  version: '005',
  name: 'create_leave_requests_table',
  description: 'Create leave_requests table for leave management with approval workflow',
  author: 'system',
  timestamp: new Date().toISOString(),
});

/**
 * Up migration: Create leave_requests table and related objects
 * 
 * Creates:
 * - leave_type enum type
 * - leave_status enum type
 * - leave_requests table with all required columns
 * - foreign key constraints to employees and users tables
 * - indexes on employee_id, status, start_date, end_date
 * - trigger for updated_at timestamp
 * - check constraints for data validation
 * 
 * @param {import('node-pg-migrate').MigrationBuilder} pgm - Migration builder instance
 * @returns {Promise<void>}
 */
async function up(pgm) {
  const startTime = Date.now();
  
  console.log('[MIGRATION_005_UP] Starting leave_requests table creation...');
  console.log('[MIGRATION_005_UP] Metadata:', JSON.stringify(MIGRATION_METADATA, null, 2));

  try {
    // Verify employees table exists (dependency check)
    console.log('[MIGRATION_005_UP] Verifying employees table exists...');
    pgm.sql(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'employees'
        ) THEN
          RAISE EXCEPTION 'Employees table does not exist. Run migration 002 first.';
        END IF;
      END $$;
    `);
    console.log('[MIGRATION_005_UP] Employees table verified successfully');

    // Verify users table exists (dependency check)
    console.log('[MIGRATION_005_UP] Verifying users table exists...');
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
    console.log('[MIGRATION_005_UP] Users table verified successfully');

    // Create leave_type enum type
    console.log('[MIGRATION_005_UP] Creating leave_type enum type...');
    pgm.createType('leave_type', [
      LEAVE_TYPE.ANNUAL,
      LEAVE_TYPE.SICK,
      LEAVE_TYPE.UNPAID,
      LEAVE_TYPE.OTHER,
    ]);
    console.log('[MIGRATION_005_UP] leave_type enum type created successfully');

    // Create leave_status enum type
    console.log('[MIGRATION_005_UP] Creating leave_status enum type...');
    pgm.createType('leave_status', [
      LEAVE_STATUS.PENDING,
      LEAVE_STATUS.APPROVED,
      LEAVE_STATUS.REJECTED,
    ]);
    console.log('[MIGRATION_005_UP] leave_status enum type created successfully');

    // Create leave_requests table
    console.log('[MIGRATION_005_UP] Creating leave_requests table...');
    pgm.createTable('leave_requests', {
      id: {
        type: 'uuid',
        primaryKey: true,
        default: pgm.func('gen_random_uuid()'),
        notNull: true,
        comment: 'Unique identifier for the leave request',
      },
      employee_id: {
        type: 'uuid',
        notNull: true,
        comment: 'Foreign key reference to employees table',
      },
      leave_type: {
        type: 'leave_type',
        notNull: true,
        comment: 'Type of leave being requested',
      },
      start_date: {
        type: 'date',
        notNull: true,
        comment: 'Start date of the leave period',
      },
      end_date: {
        type: 'date',
        notNull: true,
        comment: 'End date of the leave period',
      },
      days_count: {
        type: 'decimal(5,2)',
        notNull: true,
        comment: 'Number of days requested (supports half days)',
      },
      reason: {
        type: 'text',
        notNull: false,
        comment: 'Reason or description for the leave request',
      },
      status: {
        type: 'leave_status',
        notNull: true,
        default: LEAVE_STATUS.PENDING,
        comment: 'Current status of the leave request',
      },
      approved_by: {
        type: 'uuid',
        notNull: false,
        comment: 'Foreign key reference to users table (approver)',
      },
      approved_at: {
        type: 'timestamptz',
        notNull: false,
        comment: 'Timestamp when the leave request was approved or rejected (UTC)',
      },
      created_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('NOW()'),
        comment: 'Timestamp when the leave request was created (UTC)',
      },
      updated_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('NOW()'),
        comment: 'Timestamp when the leave request was last updated (UTC)',
      },
    }, {
      comment: 'Leave requests table storing employee leave applications and approval workflow',
      ifNotExists: true,
    });
    console.log('[MIGRATION_005_UP] leave_requests table created successfully');

    // Add foreign key constraint to employees table
    console.log('[MIGRATION_005_UP] Adding foreign key constraint to employees table...');
    pgm.addConstraint('leave_requests', 'fk_leave_requests_employee_id', {
      foreignKeys: {
        columns: 'employee_id',
        references: 'employees(id)',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
    });
    console.log('[MIGRATION_005_UP] Foreign key constraint to employees table added successfully');

    // Add foreign key constraint to users table for approver
    console.log('[MIGRATION_005_UP] Adding foreign key constraint to users table for approver...');
    pgm.addConstraint('leave_requests', 'fk_leave_requests_approved_by', {
      foreignKeys: {
        columns: 'approved_by',
        references: 'users(id)',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
    });
    console.log('[MIGRATION_005_UP] Foreign key constraint to users table added successfully');

    // Create index on employee_id for fast lookups by employee
    console.log('[MIGRATION_005_UP] Creating index on employee_id column...');
    pgm.createIndex('leave_requests', 'employee_id', {
      name: 'idx_leave_requests_employee_id',
      ifNotExists: true,
      method: 'btree',
    });
    console.log('[MIGRATION_005_UP] Index idx_leave_requests_employee_id created successfully');

    // Create index on status for filtering by status
    console.log('[MIGRATION_005_UP] Creating index on status column...');
    pgm.createIndex('leave_requests', 'status', {
      name: 'idx_leave_requests_status',
      ifNotExists: true,
      method: 'btree',
    });
    console.log('[MIGRATION_005_UP] Index idx_leave_requests_status created successfully');

    // Create index on start_date for date range queries
    console.log('[MIGRATION_005_UP] Creating index on start_date column...');
    pgm.createIndex('leave_requests', 'start_date', {
      name: 'idx_leave_requests_start_date',
      ifNotExists: true,
      method: 'btree',
    });
    console.log('[MIGRATION_005_UP] Index idx_leave_requests_start_date created successfully');

    // Create index on end_date for date range queries
    console.log('[MIGRATION_005_UP] Creating index on end_date column...');
    pgm.createIndex('leave_requests', 'end_date', {
      name: 'idx_leave_requests_end_date',
      ifNotExists: true,
      method: 'btree',
    });
    console.log('[MIGRATION_005_UP] Index idx_leave_requests_end_date created successfully');

    // Create composite index on employee_id and status for common queries
    console.log('[MIGRATION_005_UP] Creating composite index on employee_id and status...');
    pgm.createIndex('leave_requests', ['employee_id', 'status'], {
      name: 'idx_leave_requests_employee_status',
      ifNotExists: true,
      method: 'btree',
    });
    console.log('[MIGRATION_005_UP] Index idx_leave_requests_employee_status created successfully');

    // Create composite index on start_date and end_date for date range queries
    console.log('[MIGRATION_005_UP] Creating composite index on start_date and end_date...');
    pgm.createIndex('leave_requests', ['start_date', 'end_date'], {
      name: 'idx_leave_requests_date_range',
      ifNotExists: true,
      method: 'btree',
    });
    console.log('[MIGRATION_005_UP] Index idx_leave_requests_date_range created successfully');

    // Create index on approved_by for approver queries
    console.log('[MIGRATION_005_UP] Creating index on approved_by column...');
    pgm.createIndex('leave_requests', 'approved_by', {
      name: 'idx_leave_requests_approved_by',
      ifNotExists: true,
      method: 'btree',
      where: 'approved_by IS NOT NULL',
    });
    console.log('[MIGRATION_005_UP] Index idx_leave_requests_approved_by created successfully');

    // Create trigger on leave_requests table for updated_at
    console.log('[MIGRATION_005_UP] Creating trigger on leave_requests table...');
    pgm.createTrigger('leave_requests', 'update_leave_requests_updated_at', {
      when: 'BEFORE',
      operation: 'UPDATE',
      function: 'update_updated_at_column',
      level: 'ROW',
    });
    console.log('[MIGRATION_005_UP] Trigger update_leave_requests_updated_at created successfully');

    // Add constraint to ensure end_date is after or equal to start_date
    console.log('[MIGRATION_005_UP] Adding date range validation constraint...');
    pgm.addConstraint('leave_requests', 'leave_requests_date_range_check', {
      check: "end_date >= start_date",
    });
    console.log('[MIGRATION_005_UP] Date range validation constraint added successfully');

    // Add constraint to ensure days_count is positive
    console.log('[MIGRATION_005_UP] Adding days_count validation constraint...');
    pgm.addConstraint('leave_requests', 'leave_requests_days_count_check', {
      check: "days_count > 0",
    });
    console.log('[MIGRATION_005_UP] Days count validation constraint added successfully');

    // Add constraint to ensure days_count is reasonable (max 365 days)
    console.log('[MIGRATION_005_UP] Adding days_count maximum constraint...');
    pgm.addConstraint('leave_requests', 'leave_requests_days_count_max_check', {
      check: "days_count <= 365",
    });
    console.log('[MIGRATION_005_UP] Days count maximum constraint added successfully');

    // Add constraint to ensure approved_by is set when status is approved or rejected
    console.log('[MIGRATION_005_UP] Adding approval workflow constraint...');
    pgm.addConstraint('leave_requests', 'leave_requests_approval_check', {
      check: "(status = 'pending' OR (status IN ('approved', 'rejected') AND approved_by IS NOT NULL))",
    });
    console.log('[MIGRATION_005_UP] Approval workflow constraint added successfully');

    // Add constraint to ensure approved_at is set when status is approved or rejected
    console.log('[MIGRATION_005_UP] Adding approval timestamp constraint...');
    pgm.addConstraint('leave_requests', 'leave_requests_approved_at_check', {
      check: "(status = 'pending' OR (status IN ('approved', 'rejected') AND approved_at IS NOT NULL))",
    });
    console.log('[MIGRATION_005_UP] Approval timestamp constraint added successfully');

    // Add constraint to ensure start_date is not in the past (for new requests)
    console.log('[MIGRATION_005_UP] Adding start_date validation constraint...');
    pgm.sql(`
      ALTER TABLE leave_requests 
      ADD CONSTRAINT leave_requests_start_date_check 
      CHECK (
        start_date >= CURRENT_DATE OR 
        created_at < CURRENT_TIMESTAMP - INTERVAL '1 day'
      );
    `);
    console.log('[MIGRATION_005_UP] Start date validation constraint added successfully');

    // Add constraint to ensure reason is not empty when provided
    console.log('[MIGRATION_005_UP] Adding reason format constraint...');
    pgm.addConstraint('leave_requests', 'leave_requests_reason_format_check', {
      check: "reason IS NULL OR LENGTH(TRIM(reason)) > 0",
    });
    console.log('[MIGRATION_005_UP] Reason format constraint added successfully');

    const duration = Date.now() - startTime;
    console.log(`[MIGRATION_005_UP] Migration completed successfully in ${duration}ms`);
    console.log('[MIGRATION_005_UP] Summary:', {
      table: 'leave_requests',
      columns: 11,
      indexes: 7,
      constraints: 8,
      foreign_keys: 2,
      triggers: 1,
      enum_types: 2,
      duration_ms: duration,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[MIGRATION_005_UP] FATAL: Migration failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
    throw new Error(
      `[MIGRATION_005_UP] Failed to create leave_requests table: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Down migration: Drop leave_requests table and related objects
 * 
 * Drops (in reverse order of creation):
 * - Constraints
 * - Trigger on leave_requests table
 * - Indexes
 * - Foreign key constraints
 * - leave_requests table
 * - leave_status enum type
 * - leave_type enum type
 * 
 * @param {import('node-pg-migrate').MigrationBuilder} pgm - Migration builder instance
 * @returns {Promise<void>}
 */
async function down(pgm) {
  const startTime = Date.now();
  
  console.log('[MIGRATION_005_DOWN] Starting leave_requests table rollback...');
  console.log('[MIGRATION_005_DOWN] Metadata:', JSON.stringify(MIGRATION_METADATA, null, 2));

  try {
    // Drop trigger first
    console.log('[MIGRATION_005_DOWN] Dropping trigger update_leave_requests_updated_at...');
    pgm.dropTrigger('leave_requests', 'update_leave_requests_updated_at', {
      ifExists: true,
      cascade: true,
    });
    console.log('[MIGRATION_005_DOWN] Trigger dropped successfully');

    // Drop indexes
    console.log('[MIGRATION_005_DOWN] Dropping indexes...');
    pgm.dropIndex('leave_requests', 'employee_id', {
      name: 'idx_leave_requests_employee_id',
      ifExists: true,
    });
    pgm.dropIndex('leave_requests', 'status', {
      name: 'idx_leave_requests_status',
      ifExists: true,
    });
    pgm.dropIndex('leave_requests', 'start_date', {
      name: 'idx_leave_requests_start_date',
      ifExists: true,
    });
    pgm.dropIndex('leave_requests', 'end_date', {
      name: 'idx_leave_requests_end_date',
      ifExists: true,
    });
    pgm.dropIndex('leave_requests', ['employee_id', 'status'], {
      name: 'idx_leave_requests_employee_status',
      ifExists: true,
    });
    pgm.dropIndex('leave_requests', ['start_date', 'end_date'], {
      name: 'idx_leave_requests_date_range',
      ifExists: true,
    });
    pgm.dropIndex('leave_requests', 'approved_by', {
      name: 'idx_leave_requests_approved_by',
      ifExists: true,
    });
    console.log('[MIGRATION_005_DOWN] Indexes dropped successfully');

    // Drop constraints
    console.log('[MIGRATION_005_DOWN] Dropping constraints...');
    pgm.dropConstraint('leave_requests', 'leave_requests_reason_format_check', {
      ifExists: true,
    });
    pgm.dropConstraint('leave_requests', 'leave_requests_start_date_check', {
      ifExists: true,
    });
    pgm.dropConstraint('leave_requests', 'leave_requests_approved_at_check', {
      ifExists: true,
    });
    pgm.dropConstraint('leave_requests', 'leave_requests_approval_check', {
      ifExists: true,
    });
    pgm.dropConstraint('leave_requests', 'leave_requests_days_count_max_check', {
      ifExists: true,
    });
    pgm.dropConstraint('leave_requests', 'leave_requests_days_count_check', {
      ifExists: true,
    });
    pgm.dropConstraint('leave_requests', 'leave_requests_date_range_check', {
      ifExists: true,
    });
    console.log('[MIGRATION_005_DOWN] Constraints dropped successfully');

    // Drop foreign key constraints
    console.log('[MIGRATION_005_DOWN] Dropping foreign key constraints...');
    pgm.dropConstraint('leave_requests', 'fk_leave_requests_approved_by', {
      ifExists: true,
      cascade: true,
    });
    pgm.dropConstraint('leave_requests', 'fk_leave_requests_employee_id', {
      ifExists: true,
      cascade: true,
    });
    console.log('[MIGRATION_005_DOWN] Foreign key constraints dropped successfully');

    // Drop leave_requests table
    console.log('[MIGRATION_005_DOWN] Dropping leave_requests table...');
    pgm.dropTable('leave_requests', {
      ifExists: true,
      cascade: true,
    });
    console.log('[MIGRATION_005_DOWN] leave_requests table dropped successfully');

    // Drop leave_status enum type
    console.log('[MIGRATION_005_DOWN] Dropping leave_status enum type...');
    pgm.dropType('leave_status', {
      ifExists: true,
      cascade: true,
    });
    console.log('[MIGRATION_005_DOWN] leave_status enum type dropped successfully');

    // Drop leave_type enum type
    console.log('[MIGRATION_005_DOWN] Dropping leave_type enum type...');
    pgm.dropType('leave_type', {
      ifExists: true,
      cascade: true,
    });
    console.log('[MIGRATION_005_DOWN] leave_type enum type dropped successfully');

    const duration = Date.now() - startTime;
    console.log(`[MIGRATION_005_DOWN] Rollback completed successfully in ${duration}ms`);
    console.log('[MIGRATION_005_DOWN] Summary:', {
      table: 'leave_requests',
      operation: 'dropped',
      duration_ms: duration,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[MIGRATION_005_DOWN] FATAL: Rollback failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
    throw new Error(
      `[MIGRATION_005_DOWN] Failed to drop leave_requests table: ${error instanceof Error ? error.message : String(error)}`
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
      '[MIGRATION_005] WARNING: No database configuration found in environment. ' +
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
  LEAVE_TYPE,
  LEAVE_STATUS,
  MIGRATION_METADATA,
};

// Named exports for ES module compatibility
exports.up = up;
exports.down = down;
exports.LEAVE_TYPE = LEAVE_TYPE;
exports.LEAVE_STATUS = LEAVE_STATUS;
exports.MIGRATION_METADATA = MIGRATION_METADATA;