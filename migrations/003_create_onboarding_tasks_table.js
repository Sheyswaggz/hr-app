/**
 * Migration: Create Onboarding Tasks Table
 * 
 * Creates the onboarding_tasks table for tracking new employee onboarding
 * progress. Includes task assignments, due dates, status tracking, and
 * document management. Implements proper constraints, indexes, and audit
 * timestamps for comprehensive onboarding workflow management.
 * 
 * @module migrations/003_create_onboarding_tasks_table
 */

/**
 * Onboarding task status enumeration values
 * @readonly
 * @enum {string}
 */
const ONBOARDING_TASK_STATUS = Object.freeze({
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
});

/**
 * Migration metadata
 * @type {Object}
 */
const MIGRATION_METADATA = Object.freeze({
  version: '003',
  name: 'create_onboarding_tasks_table',
  description: 'Create onboarding_tasks table for tracking new employee onboarding progress',
  author: 'system',
  timestamp: new Date().toISOString(),
});

/**
 * Up migration: Create onboarding_tasks table and related objects
 * 
 * Creates:
 * - onboarding_task_status enum type
 * - onboarding_tasks table with all required columns
 * - foreign key constraints to employees and users tables
 * - indexes on employee_id, status, due_date for query optimization
 * - trigger for updated_at timestamp
 * - check constraints for data validation
 * 
 * @param {import('node-pg-migrate').MigrationBuilder} pgm - Migration builder instance
 * @returns {Promise<void>}
 */
async function up(pgm) {
  const startTime = Date.now();
  
  console.log('[MIGRATION_003_UP] Starting onboarding_tasks table creation...');
  console.log('[MIGRATION_003_UP] Metadata:', JSON.stringify(MIGRATION_METADATA, null, 2));

  try {
    // Verify employees table exists (dependency check)
    console.log('[MIGRATION_003_UP] Verifying employees table exists...');
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
    console.log('[MIGRATION_003_UP] Employees table verified successfully');

    // Verify users table exists (dependency check)
    console.log('[MIGRATION_003_UP] Verifying users table exists...');
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
    console.log('[MIGRATION_003_UP] Users table verified successfully');

    // Create onboarding_task_status enum type
    console.log('[MIGRATION_003_UP] Creating onboarding_task_status enum type...');
    pgm.createType('onboarding_task_status', [
      ONBOARDING_TASK_STATUS.PENDING,
      ONBOARDING_TASK_STATUS.IN_PROGRESS,
      ONBOARDING_TASK_STATUS.COMPLETED,
    ]);
    console.log('[MIGRATION_003_UP] onboarding_task_status enum type created successfully');

    // Create onboarding_tasks table
    console.log('[MIGRATION_003_UP] Creating onboarding_tasks table...');
    pgm.createTable('onboarding_tasks', {
      id: {
        type: 'uuid',
        primaryKey: true,
        default: pgm.func('gen_random_uuid()'),
        notNull: true,
        comment: 'Unique identifier for the onboarding task',
      },
      employee_id: {
        type: 'uuid',
        notNull: true,
        comment: 'Foreign key reference to employees table (employee being onboarded)',
      },
      task_title: {
        type: 'varchar(255)',
        notNull: true,
        comment: 'Title or name of the onboarding task',
      },
      task_description: {
        type: 'text',
        notNull: false,
        comment: 'Detailed description of the onboarding task requirements',
      },
      assigned_by: {
        type: 'uuid',
        notNull: true,
        comment: 'Foreign key reference to users table (user who assigned the task)',
      },
      due_date: {
        type: 'date',
        notNull: true,
        comment: 'Date by which the task should be completed',
      },
      status: {
        type: 'onboarding_task_status',
        notNull: true,
        default: ONBOARDING_TASK_STATUS.PENDING,
        comment: 'Current status of the onboarding task',
      },
      completed_at: {
        type: 'timestamptz',
        notNull: false,
        comment: 'Timestamp when the task was marked as completed (UTC)',
      },
      document_url: {
        type: 'varchar(2048)',
        notNull: false,
        comment: 'URL to associated document or resource for the task',
      },
      created_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('NOW()'),
        comment: 'Timestamp when the onboarding task was created (UTC)',
      },
      updated_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('NOW()'),
        comment: 'Timestamp when the onboarding task was last updated (UTC)',
      },
    }, {
      comment: 'Onboarding tasks table for tracking new employee onboarding progress and assignments',
      ifNotExists: true,
    });
    console.log('[MIGRATION_003_UP] onboarding_tasks table created successfully');

    // Add foreign key constraint to employees table
    console.log('[MIGRATION_003_UP] Adding foreign key constraint to employees table...');
    pgm.addConstraint('onboarding_tasks', 'fk_onboarding_tasks_employee_id', {
      foreignKeys: {
        columns: 'employee_id',
        references: 'employees(id)',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
    });
    console.log('[MIGRATION_003_UP] Foreign key constraint to employees table added successfully');

    // Add foreign key constraint to users table for assigned_by
    console.log('[MIGRATION_003_UP] Adding foreign key constraint to users table for assigned_by...');
    pgm.addConstraint('onboarding_tasks', 'fk_onboarding_tasks_assigned_by', {
      foreignKeys: {
        columns: 'assigned_by',
        references: 'users(id)',
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
    });
    console.log('[MIGRATION_003_UP] Foreign key constraint to users table added successfully');

    // Create index on employee_id for fast lookups by employee
    console.log('[MIGRATION_003_UP] Creating index on employee_id column...');
    pgm.createIndex('onboarding_tasks', 'employee_id', {
      name: 'idx_onboarding_tasks_employee_id',
      ifNotExists: true,
      method: 'btree',
    });
    console.log('[MIGRATION_003_UP] Index idx_onboarding_tasks_employee_id created successfully');

    // Create index on status for filtering tasks by status
    console.log('[MIGRATION_003_UP] Creating index on status column...');
    pgm.createIndex('onboarding_tasks', 'status', {
      name: 'idx_onboarding_tasks_status',
      ifNotExists: true,
      method: 'btree',
    });
    console.log('[MIGRATION_003_UP] Index idx_onboarding_tasks_status created successfully');

    // Create index on due_date for sorting and filtering by due date
    console.log('[MIGRATION_003_UP] Creating index on due_date column...');
    pgm.createIndex('onboarding_tasks', 'due_date', {
      name: 'idx_onboarding_tasks_due_date',
      ifNotExists: true,
      method: 'btree',
    });
    console.log('[MIGRATION_003_UP] Index idx_onboarding_tasks_due_date created successfully');

    // Create composite index on employee_id and status for common queries
    console.log('[MIGRATION_003_UP] Creating composite index on employee_id and status...');
    pgm.createIndex('onboarding_tasks', ['employee_id', 'status'], {
      name: 'idx_onboarding_tasks_employee_status',
      ifNotExists: true,
      method: 'btree',
    });
    console.log('[MIGRATION_003_UP] Index idx_onboarding_tasks_employee_status created successfully');

    // Create composite index on status and due_date for pending/overdue task queries
    console.log('[MIGRATION_003_UP] Creating composite index on status and due_date...');
    pgm.createIndex('onboarding_tasks', ['status', 'due_date'], {
      name: 'idx_onboarding_tasks_status_due_date',
      ifNotExists: true,
      method: 'btree',
      where: "status IN ('pending', 'in_progress')",
    });
    console.log('[MIGRATION_003_UP] Index idx_onboarding_tasks_status_due_date created successfully');

    // Create index on assigned_by for tracking tasks assigned by specific users
    console.log('[MIGRATION_003_UP] Creating index on assigned_by column...');
    pgm.createIndex('onboarding_tasks', 'assigned_by', {
      name: 'idx_onboarding_tasks_assigned_by',
      ifNotExists: true,
      method: 'btree',
    });
    console.log('[MIGRATION_003_UP] Index idx_onboarding_tasks_assigned_by created successfully');

    // Create trigger on onboarding_tasks table for updated_at
    console.log('[MIGRATION_003_UP] Creating trigger on onboarding_tasks table...');
    pgm.createTrigger('onboarding_tasks', 'update_onboarding_tasks_updated_at', {
      when: 'BEFORE',
      operation: 'UPDATE',
      function: 'update_updated_at_column',
      level: 'ROW',
    });
    console.log('[MIGRATION_003_UP] Trigger update_onboarding_tasks_updated_at created successfully');

    // Add constraint to ensure task_title is not empty
    console.log('[MIGRATION_003_UP] Adding task_title format constraint...');
    pgm.addConstraint('onboarding_tasks', 'onboarding_tasks_task_title_format_check', {
      check: "LENGTH(TRIM(task_title)) > 0",
    });
    console.log('[MIGRATION_003_UP] Task title format constraint added successfully');

    // Add constraint to ensure due_date is not in the past when creating new tasks
    console.log('[MIGRATION_003_UP] Adding due_date validation constraint...');
    pgm.addConstraint('onboarding_tasks', 'onboarding_tasks_due_date_check', {
      check: "due_date >= CURRENT_DATE - INTERVAL '30 days'",
    });
    console.log('[MIGRATION_003_UP] Due date validation constraint added successfully');

    // Add constraint to ensure completed_at is set only when status is completed
    console.log('[MIGRATION_003_UP] Adding completed_at consistency constraint...');
    pgm.addConstraint('onboarding_tasks', 'onboarding_tasks_completed_at_check', {
      check: "(status = 'completed' AND completed_at IS NOT NULL) OR (status != 'completed' AND completed_at IS NULL)",
    });
    console.log('[MIGRATION_003_UP] Completed_at consistency constraint added successfully');

    // Add constraint to ensure completed_at is not before created_at
    console.log('[MIGRATION_003_UP] Adding completed_at temporal constraint...');
    pgm.addConstraint('onboarding_tasks', 'onboarding_tasks_completed_at_temporal_check', {
      check: "completed_at IS NULL OR completed_at >= created_at",
    });
    console.log('[MIGRATION_003_UP] Completed_at temporal constraint added successfully');

    // Add constraint to ensure document_url format is valid if provided
    console.log('[MIGRATION_003_UP] Adding document_url format constraint...');
    pgm.addConstraint('onboarding_tasks', 'onboarding_tasks_document_url_format_check', {
      check: "document_url IS NULL OR (LENGTH(TRIM(document_url)) > 0 AND document_url ~* '^https?://')",
    });
    console.log('[MIGRATION_003_UP] Document URL format constraint added successfully');

    const duration = Date.now() - startTime;
    console.log(`[MIGRATION_003_UP] Migration completed successfully in ${duration}ms`);
    console.log('[MIGRATION_003_UP] Summary:', {
      table: 'onboarding_tasks',
      columns: 11,
      indexes: 6,
      constraints: 7,
      foreign_keys: 2,
      triggers: 1,
      duration_ms: duration,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[MIGRATION_003_UP] FATAL: Migration failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
    throw new Error(
      `[MIGRATION_003_UP] Failed to create onboarding_tasks table: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Down migration: Drop onboarding_tasks table and related objects
 * 
 * Drops (in reverse order of creation):
 * - Constraints
 * - Trigger on onboarding_tasks table
 * - Indexes
 * - Foreign key constraints
 * - onboarding_tasks table
 * - onboarding_task_status enum type
 * 
 * @param {import('node-pg-migrate').MigrationBuilder} pgm - Migration builder instance
 * @returns {Promise<void>}
 */
async function down(pgm) {
  const startTime = Date.now();
  
  console.log('[MIGRATION_003_DOWN] Starting onboarding_tasks table rollback...');
  console.log('[MIGRATION_003_DOWN] Metadata:', JSON.stringify(MIGRATION_METADATA, null, 2));

  try {
    // Drop trigger first
    console.log('[MIGRATION_003_DOWN] Dropping trigger update_onboarding_tasks_updated_at...');
    pgm.dropTrigger('onboarding_tasks', 'update_onboarding_tasks_updated_at', {
      ifExists: true,
      cascade: true,
    });
    console.log('[MIGRATION_003_DOWN] Trigger dropped successfully');

    // Drop indexes
    console.log('[MIGRATION_003_DOWN] Dropping indexes...');
    pgm.dropIndex('onboarding_tasks', 'employee_id', {
      name: 'idx_onboarding_tasks_employee_id',
      ifExists: true,
    });
    pgm.dropIndex('onboarding_tasks', 'status', {
      name: 'idx_onboarding_tasks_status',
      ifExists: true,
    });
    pgm.dropIndex('onboarding_tasks', 'due_date', {
      name: 'idx_onboarding_tasks_due_date',
      ifExists: true,
    });
    pgm.dropIndex('onboarding_tasks', ['employee_id', 'status'], {
      name: 'idx_onboarding_tasks_employee_status',
      ifExists: true,
    });
    pgm.dropIndex('onboarding_tasks', ['status', 'due_date'], {
      name: 'idx_onboarding_tasks_status_due_date',
      ifExists: true,
    });
    pgm.dropIndex('onboarding_tasks', 'assigned_by', {
      name: 'idx_onboarding_tasks_assigned_by',
      ifExists: true,
    });
    console.log('[MIGRATION_003_DOWN] Indexes dropped successfully');

    // Drop constraints
    console.log('[MIGRATION_003_DOWN] Dropping constraints...');
    pgm.dropConstraint('onboarding_tasks', 'onboarding_tasks_document_url_format_check', {
      ifExists: true,
    });
    pgm.dropConstraint('onboarding_tasks', 'onboarding_tasks_completed_at_temporal_check', {
      ifExists: true,
    });
    pgm.dropConstraint('onboarding_tasks', 'onboarding_tasks_completed_at_check', {
      ifExists: true,
    });
    pgm.dropConstraint('onboarding_tasks', 'onboarding_tasks_due_date_check', {
      ifExists: true,
    });
    pgm.dropConstraint('onboarding_tasks', 'onboarding_tasks_task_title_format_check', {
      ifExists: true,
    });
    console.log('[MIGRATION_003_DOWN] Constraints dropped successfully');

    // Drop foreign key constraints
    console.log('[MIGRATION_003_DOWN] Dropping foreign key constraints...');
    pgm.dropConstraint('onboarding_tasks', 'fk_onboarding_tasks_assigned_by', {
      ifExists: true,
      cascade: true,
    });
    pgm.dropConstraint('onboarding_tasks', 'fk_onboarding_tasks_employee_id', {
      ifExists: true,
      cascade: true,
    });
    console.log('[MIGRATION_003_DOWN] Foreign key constraints dropped successfully');

    // Drop onboarding_tasks table
    console.log('[MIGRATION_003_DOWN] Dropping onboarding_tasks table...');
    pgm.dropTable('onboarding_tasks', {
      ifExists: true,
      cascade: true,
    });
    console.log('[MIGRATION_003_DOWN] onboarding_tasks table dropped successfully');

    // Drop onboarding_task_status enum type
    console.log('[MIGRATION_003_DOWN] Dropping onboarding_task_status enum type...');
    pgm.dropType('onboarding_task_status', {
      ifExists: true,
      cascade: true,
    });
    console.log('[MIGRATION_003_DOWN] onboarding_task_status enum type dropped successfully');

    const duration = Date.now() - startTime;
    console.log(`[MIGRATION_003_DOWN] Rollback completed successfully in ${duration}ms`);
    console.log('[MIGRATION_003_DOWN] Summary:', {
      table: 'onboarding_tasks',
      operation: 'dropped',
      duration_ms: duration,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[MIGRATION_003_DOWN] FATAL: Rollback failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
    throw new Error(
      `[MIGRATION_003_DOWN] Failed to drop onboarding_tasks table: ${error instanceof Error ? error.message : String(error)}`
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
      '[MIGRATION_003] WARNING: No database configuration found in environment. ' +
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
  ONBOARDING_TASK_STATUS,
  MIGRATION_METADATA,
};

// Named exports for ES module compatibility
exports.up = up;
exports.down = down;
exports.ONBOARDING_TASK_STATUS = ONBOARDING_TASK_STATUS;
exports.MIGRATION_METADATA = MIGRATION_METADATA;