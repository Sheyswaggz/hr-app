/**
 * Migration Integration Tests
 * 
 * Comprehensive test suite for database migration operations including:
 * - Migration up/down execution
 * - Idempotency verification
 * - Migration order validation
 * - Schema state verification
 * - Rollback functionality
 * 
 * Uses node-pg-migrate programmatic API for migration control.
 * 
 * @module tests/db/migrations.test
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool, type PoolClient } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import node-pg-migrate programmatic API
import pgMigrate from 'node-pg-migrate';

/**
 * Test database configuration
 */
interface TestDatabaseConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
}

/**
 * Migration metadata for tracking
 */
interface MigrationMetadata {
  readonly id: number;
  readonly name: string;
  readonly run_on: Date;
}

/**
 * Table information from information_schema
 */
interface TableInfo {
  readonly table_name: string;
  readonly table_schema: string;
}

/**
 * Column information from information_schema
 */
interface ColumnInfo {
  readonly table_name: string;
  readonly column_name: string;
  readonly data_type: string;
  readonly is_nullable: string;
}

/**
 * Constraint information from information_schema
 */
interface ConstraintInfo {
  readonly constraint_name: string;
  readonly constraint_type: string;
  readonly table_name: string;
}

/**
 * Index information from pg_indexes
 */
interface IndexInfo {
  readonly indexname: string;
  readonly tablename: string;
  readonly indexdef: string;
}

/**
 * Get test database configuration from environment
 */
function getTestDatabaseConfig(): TestDatabaseConfig {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME_TEST || 'hr_app_test',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  };
}

/**
 * Create a new database pool for testing
 */
function createTestPool(): Pool {
  const config = getTestDatabaseConfig();
  
  return new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
}

/**
 * Get migrations directory path
 */
function getMigrationsDir(): string {
  return path.resolve(__dirname, '../../migrations');
}

/**
 * Run migrations programmatically
 */
async function runMigrations(
  direction: 'up' | 'down',
  options?: {
    readonly count?: number;
    readonly file?: string;
  }
): Promise<void> {
  const config = getTestDatabaseConfig();
  const migrationsDir = getMigrationsDir();

  console.log(`[MIGRATION_TEST] Running migrations ${direction}...`, {
    direction,
    migrationsDir,
    options,
  });

  try {
    await pgMigrate({
      databaseUrl: `postgresql://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}`,
      dir: migrationsDir,
      direction,
      count: options?.count,
      file: options?.file,
      migrationsTable: 'pgmigrations',
      checkOrder: true,
      verbose: true,
      log: (msg: string) => {
        console.log(`[MIGRATION_TEST] ${msg}`);
      },
    });

    console.log(`[MIGRATION_TEST] Migrations ${direction} completed successfully`);
  } catch (error) {
    console.error(`[MIGRATION_TEST] Migration ${direction} failed:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Get applied migrations from database
 */
async function getAppliedMigrations(pool: Pool): Promise<MigrationMetadata[]> {
  try {
    const result = await pool.query<MigrationMetadata>(
      'SELECT id, name, run_on FROM pgmigrations ORDER BY id ASC'
    );
    return result.rows;
  } catch (error) {
    // Table might not exist yet
    if ((error as any).code === '42P01') {
      return [];
    }
    throw error;
  }
}

/**
 * Get all tables in the database
 */
async function getTables(pool: Pool): Promise<string[]> {
  const result = await pool.query<TableInfo>(
    `SELECT table_name 
     FROM information_schema.tables 
     WHERE table_schema = 'public' 
     AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  );
  return result.rows.map(row => row.table_name);
}

/**
 * Get columns for a specific table
 */
async function getTableColumns(pool: Pool, tableName: string): Promise<ColumnInfo[]> {
  const result = await pool.query<ColumnInfo>(
    `SELECT table_name, column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_name = $1
     ORDER BY ordinal_position`,
    [tableName]
  );
  return result.rows;
}

/**
 * Get constraints for a specific table
 */
async function getTableConstraints(pool: Pool, tableName: string): Promise<ConstraintInfo[]> {
  const result = await pool.query<ConstraintInfo>(
    `SELECT constraint_name, constraint_type, table_name
     FROM information_schema.table_constraints
     WHERE table_name = $1
     ORDER BY constraint_name`,
    [tableName]
  );
  return result.rows;
}

/**
 * Get indexes for a specific table
 */
async function getTableIndexes(pool: Pool, tableName: string): Promise<IndexInfo[]> {
  const result = await pool.query<IndexInfo>(
    `SELECT indexname, tablename, indexdef
     FROM pg_indexes
     WHERE tablename = $1
     ORDER BY indexname`,
    [tableName]
  );
  return result.rows;
}

/**
 * Check if a table exists
 */
async function tableExists(pool: Pool, tableName: string): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables 
       WHERE table_schema = 'public' 
       AND table_name = $1
     )`,
    [tableName]
  );
  return result.rows[0]?.exists ?? false;
}

/**
 * Drop all tables in the database (for cleanup)
 */
async function dropAllTables(pool: Pool): Promise<void> {
  console.log('[MIGRATION_TEST] Dropping all tables...');
  
  try {
    // Get all tables
    const tables = await getTables(pool);
    
    if (tables.length === 0) {
      console.log('[MIGRATION_TEST] No tables to drop');
      return;
    }

    // Drop tables in reverse order to handle foreign keys
    for (const table of tables.reverse()) {
      await pool.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
      console.log(`[MIGRATION_TEST] Dropped table: ${table}`);
    }

    // Drop migration tracking table
    await pool.query('DROP TABLE IF EXISTS pgmigrations CASCADE');
    console.log('[MIGRATION_TEST] Dropped pgmigrations table');

    // Drop any remaining types
    await pool.query(`
      DO $$ 
      DECLARE 
        r RECORD;
      BEGIN
        FOR r IN (SELECT typname FROM pg_type WHERE typtype = 'e' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
        LOOP
          EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
        END LOOP;
      END $$;
    `);
    console.log('[MIGRATION_TEST] Dropped all enum types');

    // Drop any remaining functions
    await pool.query(`
      DO $$ 
      DECLARE 
        r RECORD;
      BEGIN
        FOR r IN (SELECT proname, oidvectortypes(proargtypes) as argtypes FROM pg_proc WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
        LOOP
          EXECUTE 'DROP FUNCTION IF EXISTS ' || quote_ident(r.proname) || '(' || r.argtypes || ') CASCADE';
        END LOOP;
      END $$;
    `);
    console.log('[MIGRATION_TEST] Dropped all functions');

    console.log('[MIGRATION_TEST] All tables and objects dropped successfully');
  } catch (error) {
    console.error('[MIGRATION_TEST] Error dropping tables:', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Test suite for database migrations
 */
describe('Database Migrations', () => {
  let pool: Pool;

  beforeAll(async () => {
    console.log('[MIGRATION_TEST] Setting up test suite...');
    pool = createTestPool();

    // Verify database connection
    try {
      await pool.query('SELECT 1');
      console.log('[MIGRATION_TEST] Database connection verified');
    } catch (error) {
      console.error('[MIGRATION_TEST] Database connection failed:', error);
      throw new Error('Failed to connect to test database');
    }
  });

  afterAll(async () => {
    console.log('[MIGRATION_TEST] Cleaning up test suite...');
    
    if (pool) {
      await pool.end();
      console.log('[MIGRATION_TEST] Database pool closed');
    }
  });

  beforeEach(async () => {
    console.log('[MIGRATION_TEST] Cleaning database before test...');
    await dropAllTables(pool);
  });

  describe('Migration Execution', () => {
    it('should run all migrations up successfully', async () => {
      // Run all migrations up
      await runMigrations('up');

      // Verify migrations were applied
      const appliedMigrations = await getAppliedMigrations(pool);
      
      expect(appliedMigrations.length).toBeGreaterThan(0);
      console.log('[MIGRATION_TEST] Applied migrations:', appliedMigrations.length);

      // Verify expected tables exist
      const expectedTables = [
        'users',
        'employees',
        'onboarding_tasks',
        'appraisals',
        'leave_requests',
        'leave_balances',
      ];

      for (const tableName of expectedTables) {
        const exists = await tableExists(pool, tableName);
        expect(exists).toBe(true);
        console.log(`[MIGRATION_TEST] Table verified: ${tableName}`);
      }
    }, 60000); // 60 second timeout

    it('should run migrations down successfully', async () => {
      // First run migrations up
      await runMigrations('up');

      const tablesAfterUp = await getTables(pool);
      expect(tablesAfterUp.length).toBeGreaterThan(0);

      // Run migrations down
      await runMigrations('down');

      // Verify tables were removed
      const tablesAfterDown = await getTables(pool);
      
      // Only pgmigrations table should remain
      expect(tablesAfterDown.length).toBeLessThanOrEqual(1);
      
      if (tablesAfterDown.length === 1) {
        expect(tablesAfterDown[0]).toBe('pgmigrations');
      }

      console.log('[MIGRATION_TEST] All migrations rolled back successfully');
    }, 60000);

    it('should handle partial migration rollback', async () => {
      // Run all migrations up
      await runMigrations('up');

      const migrationsAfterUp = await getAppliedMigrations(pool);
      const initialCount = migrationsAfterUp.length;

      // Roll back last 2 migrations
      await runMigrations('down', { count: 2 });

      const migrationsAfterPartialDown = await getAppliedMigrations(pool);
      
      expect(migrationsAfterPartialDown.length).toBe(initialCount - 2);
      console.log('[MIGRATION_TEST] Partial rollback successful');
    }, 60000);
  });

  describe('Migration Idempotency', () => {
    it('should be idempotent when running up twice', async () => {
      // Run migrations up first time
      await runMigrations('up');
      const firstRun = await getAppliedMigrations(pool);

      // Run migrations up second time (should be no-op)
      await runMigrations('up');
      const secondRun = await getAppliedMigrations(pool);

      // Should have same number of migrations
      expect(secondRun.length).toBe(firstRun.length);

      // Migration IDs should match
      for (let i = 0; i < firstRun.length; i++) {
        expect(secondRun[i]?.name).toBe(firstRun[i]?.name);
      }

      console.log('[MIGRATION_TEST] Idempotency verified for up migrations');
    }, 60000);

    it('should handle running down when already down', async () => {
      // Ensure clean state
      await dropAllTables(pool);

      // Try to run down migrations (should not error)
      await expect(runMigrations('down')).resolves.not.toThrow();

      console.log('[MIGRATION_TEST] Down migration on clean state handled correctly');
    }, 60000);
  });

  describe('Migration Order', () => {
    it('should apply migrations in correct order', async () => {
      await runMigrations('up');

      const appliedMigrations = await getAppliedMigrations(pool);

      // Verify migrations are in order
      const expectedOrder = [
        '001_create_users_table',
        '002_create_employees_table',
        '003_create_onboarding_tasks_table',
        '004_create_appraisals_table',
        '005_create_leave_requests_table',
        '006_create_leave_balances_table',
      ];

      expect(appliedMigrations.length).toBe(expectedOrder.length);

      for (let i = 0; i < expectedOrder.length; i++) {
        expect(appliedMigrations[i]?.name).toContain(expectedOrder[i]);
      }

      console.log('[MIGRATION_TEST] Migration order verified');
    }, 60000);

    it('should respect foreign key dependencies', async () => {
      await runMigrations('up');

      // Verify employees table has foreign key to users
      const employeesConstraints = await getTableConstraints(pool, 'employees');
      const userFkConstraint = employeesConstraints.find(
        c => c.constraint_name === 'fk_employees_user_id'
      );
      expect(userFkConstraint).toBeDefined();

      // Verify onboarding_tasks has foreign key to employees
      const onboardingConstraints = await getTableConstraints(pool, 'onboarding_tasks');
      const employeeFkConstraint = onboardingConstraints.find(
        c => c.constraint_name === 'fk_onboarding_tasks_employee_id'
      );
      expect(employeeFkConstraint).toBeDefined();

      console.log('[MIGRATION_TEST] Foreign key dependencies verified');
    }, 60000);
  });

  describe('Schema Validation', () => {
    beforeEach(async () => {
      await runMigrations('up');
    });

    it('should create users table with correct schema', async () => {
      const columns = await getTableColumns(pool, 'users');

      const expectedColumns = [
        'id',
        'email',
        'password_hash',
        'role',
        'first_name',
        'last_name',
        'is_active',
        'created_at',
        'updated_at',
      ];

      const columnNames = columns.map(c => c.column_name);
      
      for (const expectedCol of expectedColumns) {
        expect(columnNames).toContain(expectedCol);
      }

      // Verify email is unique
      const constraints = await getTableConstraints(pool, 'users');
      const uniqueConstraints = constraints.filter(c => c.constraint_type === 'UNIQUE');
      expect(uniqueConstraints.length).toBeGreaterThan(0);

      console.log('[MIGRATION_TEST] Users table schema verified');
    }, 60000);

    it('should create employees table with correct schema', async () => {
      const columns = await getTableColumns(pool, 'employees');

      const expectedColumns = [
        'id',
        'user_id',
        'employee_number',
        'department',
        'position',
        'hire_date',
        'manager_id',
        'status',
        'created_at',
        'updated_at',
      ];

      const columnNames = columns.map(c => c.column_name);
      
      for (const expectedCol of expectedColumns) {
        expect(columnNames).toContain(expectedCol);
      }

      console.log('[MIGRATION_TEST] Employees table schema verified');
    }, 60000);

    it('should create proper indexes', async () => {
      // Check users table indexes
      const usersIndexes = await getTableIndexes(pool, 'users');
      expect(usersIndexes.length).toBeGreaterThan(0);

      const emailIndex = usersIndexes.find(idx => idx.indexname === 'idx_users_email');
      expect(emailIndex).toBeDefined();

      // Check employees table indexes
      const employeesIndexes = await getTableIndexes(pool, 'employees');
      expect(employeesIndexes.length).toBeGreaterThan(0);

      console.log('[MIGRATION_TEST] Indexes verified');
    }, 60000);

    it('should create enum types', async () => {
      // Verify user_role enum exists
      const userRoleResult = await pool.query(
        `SELECT EXISTS (
           SELECT 1 FROM pg_type 
           WHERE typname = 'user_role'
         )`
      );
      expect(userRoleResult.rows[0]?.exists).toBe(true);

      // Verify employee_status enum exists
      const employeeStatusResult = await pool.query(
        `SELECT EXISTS (
           SELECT 1 FROM pg_type 
           WHERE typname = 'employee_status'
         )`
      );
      expect(employeeStatusResult.rows[0]?.exists).toBe(true);

      console.log('[MIGRATION_TEST] Enum types verified');
    }, 60000);

    it('should create triggers', async () => {
      // Verify update_updated_at_column function exists
      const functionResult = await pool.query(
        `SELECT EXISTS (
           SELECT 1 FROM pg_proc 
           WHERE proname = 'update_updated_at_column'
         )`
      );
      expect(functionResult.rows[0]?.exists).toBe(true);

      // Verify trigger exists on users table
      const triggerResult = await pool.query(
        `SELECT EXISTS (
           SELECT 1 FROM pg_trigger 
           WHERE tgname = 'update_users_updated_at'
         )`
      );
      expect(triggerResult.rows[0]?.exists).toBe(true);

      console.log('[MIGRATION_TEST] Triggers verified');
    }, 60000);
  });

  describe('Data Integrity', () => {
    beforeEach(async () => {
      await runMigrations('up');
    });

    it('should enforce NOT NULL constraints', async () => {
      // Try to insert user without email (should fail)
      await expect(
        pool.query(
          'INSERT INTO users (password_hash, role) VALUES ($1, $2)',
          ['hash', 'employee']
        )
      ).rejects.toThrow();

      console.log('[MIGRATION_TEST] NOT NULL constraints enforced');
    }, 60000);

    it('should enforce foreign key constraints', async () => {
      // Try to insert employee with non-existent user_id (should fail)
      await expect(
        pool.query(
          `INSERT INTO employees (user_id, employee_number, department, position, hire_date, status) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          ['00000000-0000-0000-0000-000000000000', 'EMP001', 'IT', 'Developer', '2024-01-01', 'active']
        )
      ).rejects.toThrow();

      console.log('[MIGRATION_TEST] Foreign key constraints enforced');
    }, 60000);

    it('should enforce unique constraints', async () => {
      // Insert a user
      await pool.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)',
        ['test@example.com', 'hash123', 'employee']
      );

      // Try to insert duplicate email (should fail)
      await expect(
        pool.query(
          'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)',
          ['test@example.com', 'hash456', 'employee']
        )
      ).rejects.toThrow();

      console.log('[MIGRATION_TEST] Unique constraints enforced');
    }, 60000);

    it('should enforce check constraints', async () => {
      // Insert a user first
      const userResult = await pool.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
        ['test@example.com', 'hash123', 'employee']
      );
      const userId = userResult.rows[0]?.id;

      // Insert employee
      const employeeResult = await pool.query(
        `INSERT INTO employees (user_id, employee_number, department, position, hire_date, status) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [userId, 'EMP001', 'IT', 'Developer', '2024-01-01', 'active']
      );
      const employeeId = employeeResult.rows[0]?.id;

      // Try to insert leave request with invalid date range (should fail)
      await expect(
        pool.query(
          `INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days_count, status) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [employeeId, 'annual', '2024-02-01', '2024-01-01', 1, 'pending']
        )
      ).rejects.toThrow();

      console.log('[MIGRATION_TEST] Check constraints enforced');
    }, 60000);
  });

  describe('Migration Rollback', () => {
    it('should completely reverse schema changes', async () => {
      // Run migrations up
      await runMigrations('up');
      const tablesAfterUp = await getTables(pool);
      expect(tablesAfterUp.length).toBeGreaterThan(1);

      // Run migrations down
      await runMigrations('down');
      const tablesAfterDown = await getTables(pool);

      // Should only have pgmigrations table or be empty
      expect(tablesAfterDown.length).toBeLessThanOrEqual(1);

      // Run migrations up again
      await runMigrations('up');
      const tablesAfterSecondUp = await getTables(pool);

      // Should have same tables as first up
      expect(tablesAfterSecondUp.length).toBe(tablesAfterUp.length);

      console.log('[MIGRATION_TEST] Complete rollback and re-apply verified');
    }, 90000);
  });
});