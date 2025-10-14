/**
 * Migration: Create Users Table
 * 
 * Creates the users table with authentication and role information.
 * Includes proper constraints, indexes, and audit timestamps.
 * 
 * @module migrations/001_create_users_table
 */

/**
 * User role enumeration values
 * @readonly
 * @enum {string}
 */
const USER_ROLES = Object.freeze({
  HR_ADMIN: 'hr_admin',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
});

/**
 * Migration metadata
 * @type {Object}
 */
const MIGRATION_METADATA = Object.freeze({
  version: '001',
  name: 'create_users_table',
  description: 'Create users table with authentication and role information',
  author: 'system',
  timestamp: new Date().toISOString(),
});

/**
 * Up migration: Create users table and related objects
 * 
 * Creates:
 * - user_role enum type
 * - users table with all required columns
 * - indexes on email and role
 * - trigger for updated_at timestamp
 * 
 * @param {import('node-pg-migrate').MigrationBuilder} pgm - Migration builder instance
 * @returns {Promise<void>}
 */
async function up(pgm) {
  const startTime = Date.now();
  
  console.log('[MIGRATION_001_UP] Starting users table creation...');
  console.log('[MIGRATION_001_UP] Metadata:', JSON.stringify(MIGRATION_METADATA, null, 2));

  try {
    // Create user_role enum type
    console.log('[MIGRATION_001_UP] Creating user_role enum type...');
    pgm.createType('user_role', [
      USER_ROLES.HR_ADMIN,
      USER_ROLES.MANAGER,
      USER_ROLES.EMPLOYEE,
    ]);
    console.log('[MIGRATION_001_UP] user_role enum type created successfully');

    // Create users table
    console.log('[MIGRATION_001_UP] Creating users table...');
    pgm.createTable('users', {
      id: {
        type: 'uuid',
        primaryKey: true,
        default: pgm.func('gen_random_uuid()'),
        notNull: true,
        comment: 'Unique identifier for the user',
      },
      email: {
        type: 'varchar(255)',
        notNull: true,
        unique: true,
        comment: 'User email address (used for authentication)',
      },
      password_hash: {
        type: 'varchar(255)',
        notNull: true,
        comment: 'Hashed password for authentication (bcrypt)',
      },
      role: {
        type: 'user_role',
        notNull: true,
        default: USER_ROLES.EMPLOYEE,
        comment: 'User role in the system',
      },
      first_name: {
        type: 'varchar(100)',
        notNull: false,
        comment: 'User first name',
      },
      last_name: {
        type: 'varchar(100)',
        notNull: false,
        comment: 'User last name',
      },
      is_active: {
        type: 'boolean',
        notNull: true,
        default: true,
        comment: 'Whether the user account is active',
      },
      created_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('NOW()'),
        comment: 'Timestamp when the user was created (UTC)',
      },
      updated_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('NOW()'),
        comment: 'Timestamp when the user was last updated (UTC)',
      },
    }, {
      comment: 'Users table storing authentication and role information',
      ifNotExists: true,
    });
    console.log('[MIGRATION_001_UP] users table created successfully');

    // Create index on email for fast lookups during authentication
    console.log('[MIGRATION_001_UP] Creating index on email column...');
    pgm.createIndex('users', 'email', {
      name: 'idx_users_email',
      unique: true,
      ifNotExists: true,
      method: 'btree',
    });
    console.log('[MIGRATION_001_UP] Index idx_users_email created successfully');

    // Create index on role for filtering users by role
    console.log('[MIGRATION_001_UP] Creating index on role column...');
    pgm.createIndex('users', 'role', {
      name: 'idx_users_role',
      ifNotExists: true,
      method: 'btree',
    });
    console.log('[MIGRATION_001_UP] Index idx_users_role created successfully');

    // Create composite index on is_active and role for active user queries
    console.log('[MIGRATION_001_UP] Creating composite index on is_active and role...');
    pgm.createIndex('users', ['is_active', 'role'], {
      name: 'idx_users_active_role',
      ifNotExists: true,
      method: 'btree',
      where: 'is_active = true',
    });
    console.log('[MIGRATION_001_UP] Index idx_users_active_role created successfully');

    // Create trigger function to automatically update updated_at timestamp
    console.log('[MIGRATION_001_UP] Creating trigger function for updated_at...');
    pgm.createFunction(
      'update_updated_at_column',
      [],
      {
        returns: 'trigger',
        language: 'plpgsql',
        replace: true,
      },
      `
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      `
    );
    console.log('[MIGRATION_001_UP] Trigger function update_updated_at_column created successfully');

    // Create trigger on users table
    console.log('[MIGRATION_001_UP] Creating trigger on users table...');
    pgm.createTrigger('users', 'update_users_updated_at', {
      when: 'BEFORE',
      operation: 'UPDATE',
      function: 'update_updated_at_column',
      level: 'ROW',
    });
    console.log('[MIGRATION_001_UP] Trigger update_users_updated_at created successfully');

    // Add constraint to ensure email is lowercase
    console.log('[MIGRATION_001_UP] Adding email format constraint...');
    pgm.addConstraint('users', 'users_email_lowercase_check', {
      check: "email = LOWER(email)",
    });
    console.log('[MIGRATION_001_UP] Email format constraint added successfully');

    // Add constraint to ensure password_hash is not empty
    console.log('[MIGRATION_001_UP] Adding password_hash length constraint...');
    pgm.addConstraint('users', 'users_password_hash_length_check', {
      check: "LENGTH(password_hash) >= 60",
    });
    console.log('[MIGRATION_001_UP] Password hash length constraint added successfully');

    const duration = Date.now() - startTime;
    console.log(`[MIGRATION_001_UP] Migration completed successfully in ${duration}ms`);
    console.log('[MIGRATION_001_UP] Summary:', {
      table: 'users',
      columns: 9,
      indexes: 3,
      constraints: 2,
      triggers: 1,
      duration_ms: duration,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[MIGRATION_001_UP] FATAL: Migration failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
    throw new Error(
      `[MIGRATION_001_UP] Failed to create users table: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Down migration: Drop users table and related objects
 * 
 * Drops (in reverse order of creation):
 * - Trigger on users table
 * - Trigger function
 * - Indexes
 * - users table
 * - user_role enum type
 * 
 * @param {import('node-pg-migrate').MigrationBuilder} pgm - Migration builder instance
 * @returns {Promise<void>}
 */
async function down(pgm) {
  const startTime = Date.now();
  
  console.log('[MIGRATION_001_DOWN] Starting users table rollback...');
  console.log('[MIGRATION_001_DOWN] Metadata:', JSON.stringify(MIGRATION_METADATA, null, 2));

  try {
    // Drop trigger first
    console.log('[MIGRATION_001_DOWN] Dropping trigger update_users_updated_at...');
    pgm.dropTrigger('users', 'update_users_updated_at', {
      ifExists: true,
      cascade: true,
    });
    console.log('[MIGRATION_001_DOWN] Trigger dropped successfully');

    // Drop trigger function
    console.log('[MIGRATION_001_DOWN] Dropping trigger function update_updated_at_column...');
    pgm.dropFunction('update_updated_at_column', [], {
      ifExists: true,
      cascade: true,
    });
    console.log('[MIGRATION_001_DOWN] Trigger function dropped successfully');

    // Drop indexes (not strictly necessary as they'll be dropped with table, but explicit is better)
    console.log('[MIGRATION_001_DOWN] Dropping indexes...');
    pgm.dropIndex('users', 'email', {
      name: 'idx_users_email',
      ifExists: true,
    });
    pgm.dropIndex('users', 'role', {
      name: 'idx_users_role',
      ifExists: true,
    });
    pgm.dropIndex('users', ['is_active', 'role'], {
      name: 'idx_users_active_role',
      ifExists: true,
    });
    console.log('[MIGRATION_001_DOWN] Indexes dropped successfully');

    // Drop users table
    console.log('[MIGRATION_001_DOWN] Dropping users table...');
    pgm.dropTable('users', {
      ifExists: true,
      cascade: true,
    });
    console.log('[MIGRATION_001_DOWN] users table dropped successfully');

    // Drop user_role enum type
    console.log('[MIGRATION_001_DOWN] Dropping user_role enum type...');
    pgm.dropType('user_role', {
      ifExists: true,
      cascade: true,
    });
    console.log('[MIGRATION_001_DOWN] user_role enum type dropped successfully');

    const duration = Date.now() - startTime;
    console.log(`[MIGRATION_001_DOWN] Rollback completed successfully in ${duration}ms`);
    console.log('[MIGRATION_001_DOWN] Summary:', {
      table: 'users',
      operation: 'dropped',
      duration_ms: duration,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[MIGRATION_001_DOWN] FATAL: Rollback failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
    throw new Error(
      `[MIGRATION_001_DOWN] Failed to drop users table: ${error instanceof Error ? error.message : String(error)}`
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
      '[MIGRATION_001] WARNING: No database configuration found in environment. ' +
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
  USER_ROLES,
  MIGRATION_METADATA,
};

// Named exports for ES module compatibility
exports.up = up;
exports.down = down;
exports.USER_ROLES = USER_ROLES;
exports.MIGRATION_METADATA = MIGRATION_METADATA;