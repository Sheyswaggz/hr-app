/**
 * Migration: Create Leave Balances Table
 * 
 * Creates the leave_balances table for tracking employee leave entitlements
 * including annual leave and sick leave totals and usage per year.
 * Includes proper constraints, indexes, and audit timestamps.
 * 
 * @module migrations/006_create_leave_balances_table
 */

/**
 * Migration metadata
 * @type {Object}
 */
const MIGRATION_METADATA = Object.freeze({
  version: '006',
  name: 'create_leave_balances_table',
  description: 'Create leave_balances table for tracking employee leave entitlements per year',
  author: 'system',
  timestamp: new Date().toISOString(),
});

/**
 * Up migration: Create leave_balances table and related objects
 * 
 * Creates:
 * - leave_balances table with all required columns
 * - foreign key constraint to employees table
 * - unique constraint on (employee_id, year)
 * - indexes on employee_id and year
 * - trigger for updated_at timestamp
 * - check constraints for data validation
 * 
 * @param {import('node-pg-migrate').MigrationBuilder} pgm - Migration builder instance
 * @returns {Promise<void>}
 */
async function up(pgm) {
  const startTime = Date.now();
  
  console.log('[MIGRATION_006_UP] Starting leave_balances table creation...');
  console.log('[MIGRATION_006_UP] Metadata:', JSON.stringify(MIGRATION_METADATA, null, 2));

  try {
    // Verify employees table exists (dependency check)
    console.log('[MIGRATION_006_UP] Verifying employees table exists...');
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
    console.log('[MIGRATION_006_UP] Employees table verified successfully');

    // Create leave_balances table
    console.log('[MIGRATION_006_UP] Creating leave_balances table...');
    pgm.createTable('leave_balances', {
      id: {
        type: 'uuid',
        primaryKey: true,
        default: pgm.func('gen_random_uuid()'),
        notNull: true,
        comment: 'Unique identifier for the leave balance record',
      },
      employee_id: {
        type: 'uuid',
        notNull: true,
        comment: 'Foreign key reference to employees table',
      },
      annual_leave_total: {
        type: 'decimal(5,2)',
        notNull: true,
        default: 0,
        comment: 'Total annual leave days allocated for the year',
      },
      annual_leave_used: {
        type: 'decimal(5,2)',
        notNull: true,
        default: 0,
        comment: 'Annual leave days used in the year',
      },
      sick_leave_total: {
        type: 'decimal(5,2)',
        notNull: true,
        default: 0,
        comment: 'Total sick leave days allocated for the year',
      },
      sick_leave_used: {
        type: 'decimal(5,2)',
        notNull: true,
        default: 0,
        comment: 'Sick leave days used in the year',
      },
      year: {
        type: 'integer',
        notNull: true,
        comment: 'Calendar year for this leave balance record',
      },
      created_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('NOW()'),
        comment: 'Timestamp when the leave balance record was created (UTC)',
      },
      updated_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('NOW()'),
        comment: 'Timestamp when the leave balance record was last updated (UTC)',
      },
    }, {
      comment: 'Leave balances table storing employee leave entitlements and usage per year',
      ifNotExists: true,
    });
    console.log('[MIGRATION_006_UP] leave_balances table created successfully');

    // Add foreign key constraint to employees table
    console.log('[MIGRATION_006_UP] Adding foreign key constraint to employees table...');
    pgm.addConstraint('leave_balances', 'fk_leave_balances_employee_id', {
      foreignKeys: {
        columns: 'employee_id',
        references: 'employees(id)',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
    });
    console.log('[MIGRATION_006_UP] Foreign key constraint to employees table added successfully');

    // Add unique constraint on (employee_id, year)
    console.log('[MIGRATION_006_UP] Adding unique constraint on (employee_id, year)...');
    pgm.addConstraint('leave_balances', 'leave_balances_employee_year_unique', {
      unique: ['employee_id', 'year'],
    });
    console.log('[MIGRATION_006_UP] Unique constraint on (employee_id, year) added successfully');

    // Create index on employee_id for fast lookups
    console.log('[MIGRATION_006_UP] Creating index on employee_id column...');
    pgm.createIndex('leave_balances', 'employee_id', {
      name: 'idx_leave_balances_employee_id',
      ifNotExists: true,
      method: 'btree',
    });
    console.log('[MIGRATION_006_UP] Index idx_leave_balances_employee_id created successfully');

    // Create index on year for filtering and reporting
    console.log('[MIGRATION_006_UP] Creating index on year column...');
    pgm.createIndex('leave_balances', 'year', {
      name: 'idx_leave_balances_year',
      ifNotExists: true,
      method: 'btree',
    });
    console.log('[MIGRATION_006_UP] Index idx_leave_balances_year created successfully');

    // Create composite index on (employee_id, year) for unique lookups
    console.log('[MIGRATION_006_UP] Creating composite index on (employee_id, year)...');
    pgm.createIndex('leave_balances', ['employee_id', 'year'], {
      name: 'idx_leave_balances_employee_year',
      unique: true,
      ifNotExists: true,
      method: 'btree',
    });
    console.log('[MIGRATION_006_UP] Index idx_leave_balances_employee_year created successfully');

    // Create trigger on leave_balances table for updated_at
    console.log('[MIGRATION_006_UP] Creating trigger on leave_balances table...');
    pgm.createTrigger('leave_balances', 'update_leave_balances_updated_at', {
      when: 'BEFORE',
      operation: 'UPDATE',
      function: 'update_updated_at_column',
      level: 'ROW',
    });
    console.log('[MIGRATION_006_UP] Trigger update_leave_balances_updated_at created successfully');

    // Add constraint to ensure annual_leave_total is non-negative
    console.log('[MIGRATION_006_UP] Adding annual_leave_total non-negative constraint...');
    pgm.addConstraint('leave_balances', 'leave_balances_annual_leave_total_check', {
      check: 'annual_leave_total >= 0',
    });
    console.log('[MIGRATION_006_UP] Annual leave total non-negative constraint added successfully');

    // Add constraint to ensure annual_leave_used is non-negative
    console.log('[MIGRATION_006_UP] Adding annual_leave_used non-negative constraint...');
    pgm.addConstraint('leave_balances', 'leave_balances_annual_leave_used_check', {
      check: 'annual_leave_used >= 0',
    });
    console.log('[MIGRATION_006_UP] Annual leave used non-negative constraint added successfully');

    // Add constraint to ensure annual_leave_used does not exceed total
    console.log('[MIGRATION_006_UP] Adding annual_leave_used limit constraint...');
    pgm.addConstraint('leave_balances', 'leave_balances_annual_leave_used_limit_check', {
      check: 'annual_leave_used <= annual_leave_total',
    });
    console.log('[MIGRATION_006_UP] Annual leave used limit constraint added successfully');

    // Add constraint to ensure sick_leave_total is non-negative
    console.log('[MIGRATION_006_UP] Adding sick_leave_total non-negative constraint...');
    pgm.addConstraint('leave_balances', 'leave_balances_sick_leave_total_check', {
      check: 'sick_leave_total >= 0',
    });
    console.log('[MIGRATION_006_UP] Sick leave total non-negative constraint added successfully');

    // Add constraint to ensure sick_leave_used is non-negative
    console.log('[MIGRATION_006_UP] Adding sick_leave_used non-negative constraint...');
    pgm.addConstraint('leave_balances', 'leave_balances_sick_leave_used_check', {
      check: 'sick_leave_used >= 0',
    });
    console.log('[MIGRATION_006_UP] Sick leave used non-negative constraint added successfully');

    // Add constraint to ensure sick_leave_used does not exceed total
    console.log('[MIGRATION_006_UP] Adding sick_leave_used limit constraint...');
    pgm.addConstraint('leave_balances', 'leave_balances_sick_leave_used_limit_check', {
      check: 'sick_leave_used <= sick_leave_total',
    });
    console.log('[MIGRATION_006_UP] Sick leave used limit constraint added successfully');

    // Add constraint to ensure year is reasonable (between 2000 and 2100)
    console.log('[MIGRATION_006_UP] Adding year range constraint...');
    pgm.addConstraint('leave_balances', 'leave_balances_year_range_check', {
      check: 'year >= 2000 AND year <= 2100',
    });
    console.log('[MIGRATION_006_UP] Year range constraint added successfully');

    // Add constraint to ensure leave values have reasonable precision (max 2 decimal places)
    console.log('[MIGRATION_006_UP] Adding leave values precision constraint...');
    pgm.addConstraint('leave_balances', 'leave_balances_precision_check', {
      check: `
        annual_leave_total = ROUND(annual_leave_total::numeric, 2) AND
        annual_leave_used = ROUND(annual_leave_used::numeric, 2) AND
        sick_leave_total = ROUND(sick_leave_total::numeric, 2) AND
        sick_leave_used = ROUND(sick_leave_used::numeric, 2)
      `,
    });
    console.log('[MIGRATION_006_UP] Leave values precision constraint added successfully');

    // Add constraint to ensure reasonable maximum leave values (max 365 days per year)
    console.log('[MIGRATION_006_UP] Adding maximum leave values constraint...');
    pgm.addConstraint('leave_balances', 'leave_balances_max_values_check', {
      check: `
        annual_leave_total <= 365 AND
        annual_leave_used <= 365 AND
        sick_leave_total <= 365 AND
        sick_leave_used <= 365
      `,
    });
    console.log('[MIGRATION_006_UP] Maximum leave values constraint added successfully');

    const duration = Date.now() - startTime;
    console.log(`[MIGRATION_006_UP] Migration completed successfully in ${duration}ms`);
    console.log('[MIGRATION_006_UP] Summary:', {
      table: 'leave_balances',
      columns: 9,
      indexes: 3,
      constraints: 11,
      foreign_keys: 1,
      triggers: 1,
      duration_ms: duration,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[MIGRATION_006_UP] FATAL: Migration failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
    throw new Error(
      `[MIGRATION_006_UP] Failed to create leave_balances table: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Down migration: Drop leave_balances table and related objects
 * 
 * Drops (in reverse order of creation):
 * - Constraints
 * - Trigger on leave_balances table
 * - Indexes
 * - Foreign key constraint
 * - leave_balances table
 * 
 * @param {import('node-pg-migrate').MigrationBuilder} pgm - Migration builder instance
 * @returns {Promise<void>}
 */
async function down(pgm) {
  const startTime = Date.now();
  
  console.log('[MIGRATION_006_DOWN] Starting leave_balances table rollback...');
  console.log('[MIGRATION_006_DOWN] Metadata:', JSON.stringify(MIGRATION_METADATA, null, 2));

  try {
    // Drop trigger first
    console.log('[MIGRATION_006_DOWN] Dropping trigger update_leave_balances_updated_at...');
    pgm.dropTrigger('leave_balances', 'update_leave_balances_updated_at', {
      ifExists: true,
      cascade: true,
    });
    console.log('[MIGRATION_006_DOWN] Trigger dropped successfully');

    // Drop indexes
    console.log('[MIGRATION_006_DOWN] Dropping indexes...');
    pgm.dropIndex('leave_balances', ['employee_id', 'year'], {
      name: 'idx_leave_balances_employee_year',
      ifExists: true,
    });
    pgm.dropIndex('leave_balances', 'year', {
      name: 'idx_leave_balances_year',
      ifExists: true,
    });
    pgm.dropIndex('leave_balances', 'employee_id', {
      name: 'idx_leave_balances_employee_id',
      ifExists: true,
    });
    console.log('[MIGRATION_006_DOWN] Indexes dropped successfully');

    // Drop constraints
    console.log('[MIGRATION_006_DOWN] Dropping constraints...');
    pgm.dropConstraint('leave_balances', 'leave_balances_max_values_check', {
      ifExists: true,
    });
    pgm.dropConstraint('leave_balances', 'leave_balances_precision_check', {
      ifExists: true,
    });
    pgm.dropConstraint('leave_balances', 'leave_balances_year_range_check', {
      ifExists: true,
    });
    pgm.dropConstraint('leave_balances', 'leave_balances_sick_leave_used_limit_check', {
      ifExists: true,
    });
    pgm.dropConstraint('leave_balances', 'leave_balances_sick_leave_used_check', {
      ifExists: true,
    });
    pgm.dropConstraint('leave_balances', 'leave_balances_sick_leave_total_check', {
      ifExists: true,
    });
    pgm.dropConstraint('leave_balances', 'leave_balances_annual_leave_used_limit_check', {
      ifExists: true,
    });
    pgm.dropConstraint('leave_balances', 'leave_balances_annual_leave_used_check', {
      ifExists: true,
    });
    pgm.dropConstraint('leave_balances', 'leave_balances_annual_leave_total_check', {
      ifExists: true,
    });
    console.log('[MIGRATION_006_DOWN] Constraints dropped successfully');

    // Drop unique constraint
    console.log('[MIGRATION_006_DOWN] Dropping unique constraint...');
    pgm.dropConstraint('leave_balances', 'leave_balances_employee_year_unique', {
      ifExists: true,
    });
    console.log('[MIGRATION_006_DOWN] Unique constraint dropped successfully');

    // Drop foreign key constraint
    console.log('[MIGRATION_006_DOWN] Dropping foreign key constraint...');
    pgm.dropConstraint('leave_balances', 'fk_leave_balances_employee_id', {
      ifExists: true,
      cascade: true,
    });
    console.log('[MIGRATION_006_DOWN] Foreign key constraint dropped successfully');

    // Drop leave_balances table
    console.log('[MIGRATION_006_DOWN] Dropping leave_balances table...');
    pgm.dropTable('leave_balances', {
      ifExists: true,
      cascade: true,
    });
    console.log('[MIGRATION_006_DOWN] leave_balances table dropped successfully');

    const duration = Date.now() - startTime;
    console.log(`[MIGRATION_006_DOWN] Rollback completed successfully in ${duration}ms`);
    console.log('[MIGRATION_006_DOWN] Summary:', {
      table: 'leave_balances',
      operation: 'dropped',
      duration_ms: duration,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[MIGRATION_006_DOWN] FATAL: Rollback failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
    throw new Error(
      `[MIGRATION_006_DOWN] Failed to drop leave_balances table: ${error instanceof Error ? error.message : String(error)}`
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
      '[MIGRATION_006] WARNING: No database configuration found in environment. ' +
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
  MIGRATION_METADATA,
};

// Named exports for ES module compatibility
exports.up = up;
exports.down = down;
exports.MIGRATION_METADATA = MIGRATION_METADATA;