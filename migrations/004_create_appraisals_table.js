/**
 * Migration: Create Appraisals Table
 * 
 * Creates the appraisals table for performance review cycles with comprehensive
 * tracking of employee performance reviews, self-assessments, manager feedback,
 * ratings, and goals. Includes proper constraints, indexes, and audit timestamps.
 * 
 * @module migrations/004_create_appraisals_table
 */

/**
 * Appraisal status enumeration values
 * @readonly
 * @enum {string}
 */
const APPRAISAL_STATUS = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  COMPLETED: 'completed',
});

/**
 * Migration metadata
 * @type {Object}
 */
const MIGRATION_METADATA = Object.freeze({
  version: '004',
  name: 'create_appraisals_table',
  description: 'Create appraisals table for performance review cycles with ratings and goals',
  author: 'system',
  timestamp: new Date().toISOString(),
});

/**
 * Up migration: Create appraisals table and related objects
 * 
 * Creates:
 * - appraisal_status enum type
 * - appraisals table with all required columns
 * - foreign key constraints to employees and users tables
 * - indexes on employee_id, reviewer_id, status, review_period_end
 * - trigger for updated_at timestamp
 * - check constraints for data validation
 * 
 * @param {import('node-pg-migrate').MigrationBuilder} pgm - Migration builder instance
 * @returns {Promise<void>}
 */
async function up(pgm) {
  const startTime = Date.now();
  
  console.log('[MIGRATION_004_UP] Starting appraisals table creation...');
  console.log('[MIGRATION_004_UP] Metadata:', JSON.stringify(MIGRATION_METADATA, null, 2));

  try {
    // Verify employees table exists (dependency check)
    console.log('[MIGRATION_004_UP] Verifying employees table exists...');
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
    console.log('[MIGRATION_004_UP] Employees table verified successfully');

    // Verify users table exists (dependency check)
    console.log('[MIGRATION_004_UP] Verifying users table exists...');
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
    console.log('[MIGRATION_004_UP] Users table verified successfully');

    // Create appraisal_status enum type
    console.log('[MIGRATION_004_UP] Creating appraisal_status enum type...');
    pgm.createType('appraisal_status', [
      APPRAISAL_STATUS.DRAFT,
      APPRAISAL_STATUS.SUBMITTED,
      APPRAISAL_STATUS.COMPLETED,
    ]);
    console.log('[MIGRATION_004_UP] appraisal_status enum type created successfully');

    // Create appraisals table
    console.log('[MIGRATION_004_UP] Creating appraisals table...');
    pgm.createTable('appraisals', {
      id: {
        type: 'uuid',
        primaryKey: true,
        default: pgm.func('gen_random_uuid()'),
        notNull: true,
        comment: 'Unique identifier for the appraisal',
      },
      employee_id: {
        type: 'uuid',
        notNull: true,
        comment: 'Foreign key reference to employees table (employee being reviewed)',
      },
      reviewer_id: {
        type: 'uuid',
        notNull: true,
        comment: 'Foreign key reference to users table (manager conducting review)',
      },
      review_period_start: {
        type: 'date',
        notNull: true,
        comment: 'Start date of the review period',
      },
      review_period_end: {
        type: 'date',
        notNull: true,
        comment: 'End date of the review period',
      },
      self_assessment: {
        type: 'text',
        notNull: false,
        comment: 'Employee self-assessment text',
      },
      manager_feedback: {
        type: 'text',
        notNull: false,
        comment: 'Manager feedback and comments',
      },
      rating: {
        type: 'integer',
        notNull: false,
        comment: 'Performance rating on scale of 1-5',
      },
      goals: {
        type: 'jsonb',
        notNull: false,
        default: '[]',
        comment: 'Performance goals and objectives in JSON format',
      },
      status: {
        type: 'appraisal_status',
        notNull: true,
        default: APPRAISAL_STATUS.DRAFT,
        comment: 'Current status of the appraisal',
      },
      created_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('NOW()'),
        comment: 'Timestamp when the appraisal record was created (UTC)',
      },
      updated_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('NOW()'),
        comment: 'Timestamp when the appraisal record was last updated (UTC)',
      },
    }, {
      comment: 'Appraisals table storing performance review cycles, ratings, and goals',
      ifNotExists: true,
    });
    console.log('[MIGRATION_004_UP] appraisals table created successfully');

    // Add foreign key constraint to employees table
    console.log('[MIGRATION_004_UP] Adding foreign key constraint to employees table...');
    pgm.addConstraint('appraisals', 'fk_appraisals_employee_id', {
      foreignKeys: {
        columns: 'employee_id',
        references: 'employees(id)',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
    });
    console.log('[MIGRATION_004_UP] Foreign key constraint to employees table added successfully');

    // Add foreign key constraint to users table for reviewer
    console.log('[MIGRATION_004_UP] Adding foreign key constraint to users table for reviewer...');
    pgm.addConstraint('appraisals', 'fk_appraisals_reviewer_id', {
      foreignKeys: {
        columns: 'reviewer_id',
        references: 'users(id)',
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
    });
    console.log('[MIGRATION_004_UP] Foreign key constraint to users table added successfully');

    // Create index on employee_id for fast lookups
    console.log('[MIGRATION_004_UP] Creating index on employee_id column...');
    pgm.createIndex('appraisals', 'employee_id', {
      name: 'idx_appraisals_employee_id',
      ifNotExists: true,
      method: 'btree',
    });
    console.log('[MIGRATION_004_UP] Index idx_appraisals_employee_id created successfully');

    // Create index on reviewer_id for manager queries
    console.log('[MIGRATION_004_UP] Creating index on reviewer_id column...');
    pgm.createIndex('appraisals', 'reviewer_id', {
      name: 'idx_appraisals_reviewer_id',
      ifNotExists: true,
      method: 'btree',
    });
    console.log('[MIGRATION_004_UP] Index idx_appraisals_reviewer_id created successfully');

    // Create index on status for filtering by appraisal status
    console.log('[MIGRATION_004_UP] Creating index on status column...');
    pgm.createIndex('appraisals', 'status', {
      name: 'idx_appraisals_status',
      ifNotExists: true,
      method: 'btree',
    });
    console.log('[MIGRATION_004_UP] Index idx_appraisals_status created successfully');

    // Create index on review_period_end for time-based queries
    console.log('[MIGRATION_004_UP] Creating index on review_period_end column...');
    pgm.createIndex('appraisals', 'review_period_end', {
      name: 'idx_appraisals_review_period_end',
      ifNotExists: true,
      method: 'btree',
    });
    console.log('[MIGRATION_004_UP] Index idx_appraisals_review_period_end created successfully');

    // Create composite index on employee_id and review_period_end for employee review history
    console.log('[MIGRATION_004_UP] Creating composite index on employee_id and review_period_end...');
    pgm.createIndex('appraisals', ['employee_id', 'review_period_end'], {
      name: 'idx_appraisals_employee_period',
      ifNotExists: true,
      method: 'btree',
    });
    console.log('[MIGRATION_004_UP] Index idx_appraisals_employee_period created successfully');

    // Create composite index on status and review_period_end for pending reviews
    console.log('[MIGRATION_004_UP] Creating composite index on status and review_period_end...');
    pgm.createIndex('appraisals', ['status', 'review_period_end'], {
      name: 'idx_appraisals_status_period',
      ifNotExists: true,
      method: 'btree',
      where: "status IN ('draft', 'submitted')",
    });
    console.log('[MIGRATION_004_UP] Index idx_appraisals_status_period created successfully');

    // Create GIN index on goals JSONB column for efficient JSON queries
    console.log('[MIGRATION_004_UP] Creating GIN index on goals column...');
    pgm.createIndex('appraisals', 'goals', {
      name: 'idx_appraisals_goals_gin',
      ifNotExists: true,
      method: 'gin',
    });
    console.log('[MIGRATION_004_UP] Index idx_appraisals_goals_gin created successfully');

    // Create trigger on appraisals table for updated_at
    console.log('[MIGRATION_004_UP] Creating trigger on appraisals table...');
    pgm.createTrigger('appraisals', 'update_appraisals_updated_at', {
      when: 'BEFORE',
      operation: 'UPDATE',
      function: 'update_updated_at_column',
      level: 'ROW',
    });
    console.log('[MIGRATION_004_UP] Trigger update_appraisals_updated_at created successfully');

    // Add constraint to ensure review_period_end is after review_period_start
    console.log('[MIGRATION_004_UP] Adding review period validation constraint...');
    pgm.addConstraint('appraisals', 'appraisals_review_period_check', {
      check: 'review_period_end > review_period_start',
    });
    console.log('[MIGRATION_004_UP] Review period validation constraint added successfully');

    // Add constraint to ensure rating is between 1 and 5
    console.log('[MIGRATION_004_UP] Adding rating range constraint...');
    pgm.addConstraint('appraisals', 'appraisals_rating_range_check', {
      check: 'rating IS NULL OR (rating >= 1 AND rating <= 5)',
    });
    console.log('[MIGRATION_004_UP] Rating range constraint added successfully');

    // Add constraint to ensure review_period_start is not in the future
    console.log('[MIGRATION_004_UP] Adding review_period_start validation constraint...');
    pgm.addConstraint('appraisals', 'appraisals_review_period_start_check', {
      check: 'review_period_start <= CURRENT_DATE',
    });
    console.log('[MIGRATION_004_UP] Review period start validation constraint added successfully');

    // Add constraint to ensure self_assessment is not empty when provided
    console.log('[MIGRATION_004_UP] Adding self_assessment format constraint...');
    pgm.addConstraint('appraisals', 'appraisals_self_assessment_format_check', {
      check: "self_assessment IS NULL OR LENGTH(TRIM(self_assessment)) > 0",
    });
    console.log('[MIGRATION_004_UP] Self assessment format constraint added successfully');

    // Add constraint to ensure manager_feedback is not empty when provided
    console.log('[MIGRATION_004_UP] Adding manager_feedback format constraint...');
    pgm.addConstraint('appraisals', 'appraisals_manager_feedback_format_check', {
      check: "manager_feedback IS NULL OR LENGTH(TRIM(manager_feedback)) > 0",
    });
    console.log('[MIGRATION_004_UP] Manager feedback format constraint added successfully');

    // Add constraint to ensure goals is valid JSON array
    console.log('[MIGRATION_004_UP] Adding goals JSON validation constraint...');
    pgm.addConstraint('appraisals', 'appraisals_goals_json_check', {
      check: "jsonb_typeof(goals) = 'array'",
    });
    console.log('[MIGRATION_004_UP] Goals JSON validation constraint added successfully');

    // Add constraint to ensure completed appraisals have required fields
    console.log('[MIGRATION_004_UP] Adding completed appraisal validation constraint...');
    pgm.addConstraint('appraisals', 'appraisals_completed_fields_check', {
      check: `
        status != 'completed' OR (
          rating IS NOT NULL AND
          manager_feedback IS NOT NULL AND
          LENGTH(TRIM(manager_feedback)) > 0
        )
      `,
    });
    console.log('[MIGRATION_004_UP] Completed appraisal validation constraint added successfully');

    // Add unique constraint to prevent duplicate appraisals for same employee and period
    console.log('[MIGRATION_004_UP] Adding unique constraint for employee and review period...');
    pgm.addConstraint('appraisals', 'appraisals_employee_period_unique', {
      unique: ['employee_id', 'review_period_start', 'review_period_end'],
    });
    console.log('[MIGRATION_004_UP] Unique constraint for employee and review period added successfully');

    const duration = Date.now() - startTime;
    console.log(`[MIGRATION_004_UP] Migration completed successfully in ${duration}ms`);
    console.log('[MIGRATION_004_UP] Summary:', {
      table: 'appraisals',
      columns: 11,
      indexes: 7,
      constraints: 9,
      foreign_keys: 2,
      triggers: 1,
      duration_ms: duration,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[MIGRATION_004_UP] FATAL: Migration failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
    throw new Error(
      `[MIGRATION_004_UP] Failed to create appraisals table: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Down migration: Drop appraisals table and related objects
 * 
 * Drops (in reverse order of creation):
 * - Unique constraint
 * - Check constraints
 * - Trigger on appraisals table
 * - Indexes
 * - Foreign key constraints
 * - appraisals table
 * - appraisal_status enum type
 * 
 * @param {import('node-pg-migrate').MigrationBuilder} pgm - Migration builder instance
 * @returns {Promise<void>}
 */
async function down(pgm) {
  const startTime = Date.now();
  
  console.log('[MIGRATION_004_DOWN] Starting appraisals table rollback...');
  console.log('[MIGRATION_004_DOWN] Metadata:', JSON.stringify(MIGRATION_METADATA, null, 2));

  try {
    // Drop trigger first
    console.log('[MIGRATION_004_DOWN] Dropping trigger update_appraisals_updated_at...');
    pgm.dropTrigger('appraisals', 'update_appraisals_updated_at', {
      ifExists: true,
      cascade: true,
    });
    console.log('[MIGRATION_004_DOWN] Trigger dropped successfully');

    // Drop indexes
    console.log('[MIGRATION_004_DOWN] Dropping indexes...');
    pgm.dropIndex('appraisals', 'goals', {
      name: 'idx_appraisals_goals_gin',
      ifExists: true,
    });
    pgm.dropIndex('appraisals', ['status', 'review_period_end'], {
      name: 'idx_appraisals_status_period',
      ifExists: true,
    });
    pgm.dropIndex('appraisals', ['employee_id', 'review_period_end'], {
      name: 'idx_appraisals_employee_period',
      ifExists: true,
    });
    pgm.dropIndex('appraisals', 'review_period_end', {
      name: 'idx_appraisals_review_period_end',
      ifExists: true,
    });
    pgm.dropIndex('appraisals', 'status', {
      name: 'idx_appraisals_status',
      ifExists: true,
    });
    pgm.dropIndex('appraisals', 'reviewer_id', {
      name: 'idx_appraisals_reviewer_id',
      ifExists: true,
    });
    pgm.dropIndex('appraisals', 'employee_id', {
      name: 'idx_appraisals_employee_id',
      ifExists: true,
    });
    console.log('[MIGRATION_004_DOWN] Indexes dropped successfully');

    // Drop constraints
    console.log('[MIGRATION_004_DOWN] Dropping constraints...');
    pgm.dropConstraint('appraisals', 'appraisals_employee_period_unique', {
      ifExists: true,
    });
    pgm.dropConstraint('appraisals', 'appraisals_completed_fields_check', {
      ifExists: true,
    });
    pgm.dropConstraint('appraisals', 'appraisals_goals_json_check', {
      ifExists: true,
    });
    pgm.dropConstraint('appraisals', 'appraisals_manager_feedback_format_check', {
      ifExists: true,
    });
    pgm.dropConstraint('appraisals', 'appraisals_self_assessment_format_check', {
      ifExists: true,
    });
    pgm.dropConstraint('appraisals', 'appraisals_review_period_start_check', {
      ifExists: true,
    });
    pgm.dropConstraint('appraisals', 'appraisals_rating_range_check', {
      ifExists: true,
    });
    pgm.dropConstraint('appraisals', 'appraisals_review_period_check', {
      ifExists: true,
    });
    console.log('[MIGRATION_004_DOWN] Constraints dropped successfully');

    // Drop foreign key constraints
    console.log('[MIGRATION_004_DOWN] Dropping foreign key constraints...');
    pgm.dropConstraint('appraisals', 'fk_appraisals_reviewer_id', {
      ifExists: true,
      cascade: true,
    });
    pgm.dropConstraint('appraisals', 'fk_appraisals_employee_id', {
      ifExists: true,
      cascade: true,
    });
    console.log('[MIGRATION_004_DOWN] Foreign key constraints dropped successfully');

    // Drop appraisals table
    console.log('[MIGRATION_004_DOWN] Dropping appraisals table...');
    pgm.dropTable('appraisals', {
      ifExists: true,
      cascade: true,
    });
    console.log('[MIGRATION_004_DOWN] appraisals table dropped successfully');

    // Drop appraisal_status enum type
    console.log('[MIGRATION_004_DOWN] Dropping appraisal_status enum type...');
    pgm.dropType('appraisal_status', {
      ifExists: true,
      cascade: true,
    });
    console.log('[MIGRATION_004_DOWN] appraisal_status enum type dropped successfully');

    const duration = Date.now() - startTime;
    console.log(`[MIGRATION_004_DOWN] Rollback completed successfully in ${duration}ms`);
    console.log('[MIGRATION_004_DOWN] Summary:', {
      table: 'appraisals',
      operation: 'dropped',
      duration_ms: duration,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[MIGRATION_004_DOWN] FATAL: Rollback failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
    throw new Error(
      `[MIGRATION_004_DOWN] Failed to drop appraisals table: ${error instanceof Error ? error.message : String(error)}`
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
      '[MIGRATION_004] WARNING: No database configuration found in environment. ' +
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
  APPRAISAL_STATUS,
  MIGRATION_METADATA,
};

// Named exports for ES module compatibility
exports.up = up;
exports.down = down;
exports.APPRAISAL_STATUS = APPRAISAL_STATUS;
exports.MIGRATION_METADATA = MIGRATION_METADATA;