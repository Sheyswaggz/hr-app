/**
 * Database Schema Integration Tests
 * 
 * Comprehensive test suite validating database schema integrity, constraints,
 * relationships, indexes, and data validation rules. Tests verify that all
 * migrations have been applied correctly and the schema enforces business rules.
 * 
 * @module tests/db/schema.test
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Pool, type PoolClient } from 'pg';
import { getDatabaseConfig, toPgPoolConfig } from '../../src/config/database.js';

/**
 * Test database pool instance
 */
let testPool: Pool;

/**
 * Test client for transaction-based tests
 */
let testClient: PoolClient | null = null;

/**
 * Test data cleanup tracking
 */
const createdRecords: {
  table: string;
  id: string;
}[] = [];

/**
 * Setup test database connection before all tests
 */
beforeAll(async () => {
  console.log('[SCHEMA_TEST] Initializing test database connection...');
  
  const config = getDatabaseConfig();
  const poolConfig = toPgPoolConfig(config);
  
  testPool = new Pool(poolConfig);
  
  // Verify connection
  const client = await testPool.connect();
  try {
    const result = await client.query('SELECT NOW() as current_time');
    console.log('[SCHEMA_TEST] Database connection established:', {
      timestamp: result.rows[0]?.current_time,
      database: config.database,
      host: config.host,
    });
  } finally {
    client.release();
  }
});

/**
 * Cleanup test database connection after all tests
 */
afterAll(async () => {
  console.log('[SCHEMA_TEST] Closing test database connection...');
  
  if (testPool) {
    await testPool.end();
    console.log('[SCHEMA_TEST] Database connection closed successfully');
  }
});

/**
 * Setup transaction for each test
 */
beforeEach(async () => {
  testClient = await testPool.connect();
  await testClient.query('BEGIN');
  console.log('[SCHEMA_TEST] Transaction started for test');
});

/**
 * Rollback transaction after each test
 */
afterEach(async () => {
  if (testClient) {
    await testClient.query('ROLLBACK');
    testClient.release();
    testClient = null;
    console.log('[SCHEMA_TEST] Transaction rolled back and client released');
  }
  
  // Clear tracking
  createdRecords.length = 0;
});

/**
 * Helper function to execute query in test transaction
 */
async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  if (!testClient) {
    throw new Error('[SCHEMA_TEST] No active test client');
  }
  
  const result = await testClient.query(sql, params);
  return result.rows as T[];
}

/**
 * Helper function to check if table exists
 */
async function tableExists(tableName: string): Promise<boolean> {
  const rows = await query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    )`,
    [tableName]
  );
  
  return rows[0]?.exists ?? false;
}

/**
 * Helper function to check if column exists
 */
async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const rows = await query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1 
      AND column_name = $2
    )`,
    [tableName, columnName]
  );
  
  return rows[0]?.exists ?? false;
}

/**
 * Helper function to check if index exists
 */
async function indexExists(indexName: string): Promise<boolean> {
  const rows = await query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND indexname = $1
    )`,
    [indexName]
  );
  
  return rows[0]?.exists ?? false;
}

/**
 * Helper function to check if constraint exists
 */
async function constraintExists(tableName: string, constraintName: string): Promise<boolean> {
  const rows = await query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_schema = 'public' 
      AND table_name = $1 
      AND constraint_name = $2
    )`,
    [tableName, constraintName]
  );
  
  return rows[0]?.exists ?? false;
}

/**
 * Helper function to check if enum type exists
 */
async function enumTypeExists(typeName: string): Promise<boolean> {
  const rows = await query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM pg_type 
      WHERE typname = $1 
      AND typtype = 'e'
    )`,
    [typeName]
  );
  
  return rows[0]?.exists ?? false;
}

/**
 * Helper function to get enum values
 */
async function getEnumValues(typeName: string): Promise<string[]> {
  const rows = await query<{ enumlabel: string }>(
    `SELECT enumlabel 
     FROM pg_enum 
     WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = $1)
     ORDER BY enumsortorder`,
    [typeName]
  );
  
  return rows.map(row => row.enumlabel);
}

describe('Database Schema - Table Existence', () => {
  it('should have users table', async () => {
    const exists = await tableExists('users');
    expect(exists).toBe(true);
  });

  it('should have employees table', async () => {
    const exists = await tableExists('employees');
    expect(exists).toBe(true);
  });

  it('should have onboarding_tasks table', async () => {
    const exists = await tableExists('onboarding_tasks');
    expect(exists).toBe(true);
  });

  it('should have appraisals table', async () => {
    const exists = await tableExists('appraisals');
    expect(exists).toBe(true);
  });

  it('should have leave_requests table', async () => {
    const exists = await tableExists('leave_requests');
    expect(exists).toBe(true);
  });

  it('should have leave_balances table', async () => {
    const exists = await tableExists('leave_balances');
    expect(exists).toBe(true);
  });
});

describe('Database Schema - Users Table', () => {
  it('should have all required columns', async () => {
    const columns = ['id', 'email', 'password_hash', 'role', 'first_name', 'last_name', 'is_active', 'created_at', 'updated_at'];
    
    for (const column of columns) {
      const exists = await columnExists('users', column);
      expect(exists).toBe(true);
    }
  });

  it('should have user_role enum type', async () => {
    const exists = await enumTypeExists('user_role');
    expect(exists).toBe(true);
  });

  it('should have correct user_role enum values', async () => {
    const values = await getEnumValues('user_role');
    expect(values).toContain('hr_admin');
    expect(values).toContain('manager');
    expect(values).toContain('employee');
  });

  it('should enforce unique email constraint', async () => {
    const email = 'test@example.com';
    
    await query(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3)`,
      [email, '$2b$10$abcdefghijklmnopqrstuv', 'employee']
    );
    
    await expect(
      query(
        `INSERT INTO users (email, password_hash, role) 
         VALUES ($1, $2, $3)`,
        [email, '$2b$10$abcdefghijklmnopqrstuv', 'employee']
      )
    ).rejects.toThrow();
  });

  it('should enforce email lowercase constraint', async () => {
    await expect(
      query(
        `INSERT INTO users (email, password_hash, role) 
         VALUES ($1, $2, $3)`,
        ['Test@Example.COM', '$2b$10$abcdefghijklmnopqrstuv', 'employee']
      )
    ).rejects.toThrow();
  });

  it('should enforce password_hash length constraint', async () => {
    await expect(
      query(
        `INSERT INTO users (email, password_hash, role) 
         VALUES ($1, $2, $3)`,
        ['test@example.com', 'short', 'employee']
      )
    ).rejects.toThrow();
  });

  it('should have email index', async () => {
    const exists = await indexExists('idx_users_email');
    expect(exists).toBe(true);
  });

  it('should have role index', async () => {
    const exists = await indexExists('idx_users_role');
    expect(exists).toBe(true);
  });

  it('should auto-update updated_at timestamp', async () => {
    const [user] = await query<{ id: string; updated_at: Date }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id, updated_at`,
      ['test@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'employee']
    );
    
    const initialUpdatedAt = user!.updated_at;
    
    // Wait a moment to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const [updated] = await query<{ updated_at: Date }>(
      `UPDATE users SET first_name = $1 WHERE id = $2 RETURNING updated_at`,
      ['John', user!.id]
    );
    
    expect(new Date(updated!.updated_at).getTime()).toBeGreaterThan(
      new Date(initialUpdatedAt).getTime()
    );
  });
});

describe('Database Schema - Employees Table', () => {
  it('should have all required columns', async () => {
    const columns = ['id', 'user_id', 'employee_number', 'department', 'position', 'hire_date', 'manager_id', 'status', 'created_at', 'updated_at'];
    
    for (const column of columns) {
      const exists = await columnExists('employees', column);
      expect(exists).toBe(true);
    }
  });

  it('should have employee_status enum type', async () => {
    const exists = await enumTypeExists('employee_status');
    expect(exists).toBe(true);
  });

  it('should have correct employee_status enum values', async () => {
    const values = await getEnumValues('employee_status');
    expect(values).toContain('active');
    expect(values).toContain('on_leave');
    expect(values).toContain('terminated');
  });

  it('should enforce foreign key to users table', async () => {
    await expect(
      query(
        `INSERT INTO employees (user_id, employee_number, department, position, hire_date) 
         VALUES ($1, $2, $3, $4, $5)`,
        ['00000000-0000-0000-0000-000000000000', 'EMP001', 'Engineering', 'Developer', '2024-01-01']
      )
    ).rejects.toThrow();
  });

  it('should enforce unique employee_number constraint', async () => {
    const [user] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['test1@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'employee']
    );
    
    const [user2] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['test2@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'employee']
    );
    
    await query(
      `INSERT INTO employees (user_id, employee_number, department, position, hire_date) 
       VALUES ($1, $2, $3, $4, $5)`,
      [user!.id, 'EMP001', 'Engineering', 'Developer', '2024-01-01']
    );
    
    await expect(
      query(
        `INSERT INTO employees (user_id, employee_number, department, position, hire_date) 
         VALUES ($1, $2, $3, $4, $5)`,
        [user2!.id, 'EMP001', 'Engineering', 'Developer', '2024-01-01']
      )
    ).rejects.toThrow();
  });

  it('should enforce hire_date not in future constraint', async () => {
    const [user] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['test@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'employee']
    );
    
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    
    await expect(
      query(
        `INSERT INTO employees (user_id, employee_number, department, position, hire_date) 
         VALUES ($1, $2, $3, $4, $5)`,
        [user!.id, 'EMP001', 'Engineering', 'Developer', futureDate.toISOString().split('T')[0]]
      )
    ).rejects.toThrow();
  });

  it('should prevent self-referencing manager', async () => {
    const [user] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['test@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'employee']
    );
    
    const [employee] = await query<{ id: string }>(
      `INSERT INTO employees (user_id, employee_number, department, position, hire_date) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      [user!.id, 'EMP001', 'Engineering', 'Developer', '2024-01-01']
    );
    
    await expect(
      query(
        `UPDATE employees SET manager_id = $1 WHERE id = $1`,
        [employee!.id]
      )
    ).rejects.toThrow();
  });

  it('should have required indexes', async () => {
    const indexes = [
      'idx_employees_user_id',
      'idx_employees_employee_number',
      'idx_employees_manager_id',
      'idx_employees_department',
      'idx_employees_hire_date'
    ];
    
    for (const index of indexes) {
      const exists = await indexExists(index);
      expect(exists).toBe(true);
    }
  });
});

describe('Database Schema - Onboarding Tasks Table', () => {
  it('should have all required columns', async () => {
    const columns = ['id', 'employee_id', 'task_title', 'task_description', 'assigned_by', 'due_date', 'status', 'completed_at', 'document_url', 'created_at', 'updated_at'];
    
    for (const column of columns) {
      const exists = await columnExists('onboarding_tasks', column);
      expect(exists).toBe(true);
    }
  });

  it('should have onboarding_task_status enum type', async () => {
    const exists = await enumTypeExists('onboarding_task_status');
    expect(exists).toBe(true);
  });

  it('should have correct onboarding_task_status enum values', async () => {
    const values = await getEnumValues('onboarding_task_status');
    expect(values).toContain('pending');
    expect(values).toContain('in_progress');
    expect(values).toContain('completed');
  });

  it('should enforce foreign key to employees table', async () => {
    const [user] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['test@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'hr_admin']
    );
    
    await expect(
      query(
        `INSERT INTO onboarding_tasks (employee_id, task_title, assigned_by, due_date) 
         VALUES ($1, $2, $3, $4)`,
        ['00000000-0000-0000-0000-000000000000', 'Complete paperwork', user!.id, '2024-12-31']
      )
    ).rejects.toThrow();
  });

  it('should enforce completed_at consistency with status', async () => {
    const [user] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['test@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'employee']
    );
    
    const [employee] = await query<{ id: string }>(
      `INSERT INTO employees (user_id, employee_number, department, position, hire_date) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      [user!.id, 'EMP001', 'Engineering', 'Developer', '2024-01-01']
    );
    
    const [hrUser] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['hr@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'hr_admin']
    );
    
    await expect(
      query(
        `INSERT INTO onboarding_tasks (employee_id, task_title, assigned_by, due_date, status, completed_at) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [employee!.id, 'Complete paperwork', hrUser!.id, '2024-12-31', 'pending', new Date().toISOString()]
      )
    ).rejects.toThrow();
  });

  it('should have required indexes', async () => {
    const indexes = [
      'idx_onboarding_tasks_employee_id',
      'idx_onboarding_tasks_status',
      'idx_onboarding_tasks_due_date',
      'idx_onboarding_tasks_assigned_by'
    ];
    
    for (const index of indexes) {
      const exists = await indexExists(index);
      expect(exists).toBe(true);
    }
  });
});

describe('Database Schema - Appraisals Table', () => {
  it('should have all required columns', async () => {
    const columns = ['id', 'employee_id', 'reviewer_id', 'review_period_start', 'review_period_end', 'self_assessment', 'manager_feedback', 'rating', 'goals', 'status', 'created_at', 'updated_at'];
    
    for (const column of columns) {
      const exists = await columnExists('appraisals', column);
      expect(exists).toBe(true);
    }
  });

  it('should have appraisal_status enum type', async () => {
    const exists = await enumTypeExists('appraisal_status');
    expect(exists).toBe(true);
  });

  it('should have correct appraisal_status enum values', async () => {
    const values = await getEnumValues('appraisal_status');
    expect(values).toContain('draft');
    expect(values).toContain('submitted');
    expect(values).toContain('completed');
  });

  it('should enforce rating range constraint', async () => {
    const [user] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['test@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'employee']
    );
    
    const [employee] = await query<{ id: string }>(
      `INSERT INTO employees (user_id, employee_number, department, position, hire_date) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      [user!.id, 'EMP001', 'Engineering', 'Developer', '2024-01-01']
    );
    
    const [manager] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['manager@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'manager']
    );
    
    await expect(
      query(
        `INSERT INTO appraisals (employee_id, reviewer_id, review_period_start, review_period_end, rating) 
         VALUES ($1, $2, $3, $4, $5)`,
        [employee!.id, manager!.id, '2024-01-01', '2024-06-30', 6]
      )
    ).rejects.toThrow();
  });

  it('should enforce review period validation', async () => {
    const [user] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['test@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'employee']
    );
    
    const [employee] = await query<{ id: string }>(
      `INSERT INTO employees (user_id, employee_number, department, position, hire_date) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      [user!.id, 'EMP001', 'Engineering', 'Developer', '2024-01-01']
    );
    
    const [manager] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['manager@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'manager']
    );
    
    await expect(
      query(
        `INSERT INTO appraisals (employee_id, reviewer_id, review_period_start, review_period_end) 
         VALUES ($1, $2, $3, $4)`,
        [employee!.id, manager!.id, '2024-06-30', '2024-01-01']
      )
    ).rejects.toThrow();
  });

  it('should enforce goals JSON array type', async () => {
    const [user] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['test@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'employee']
    );
    
    const [employee] = await query<{ id: string }>(
      `INSERT INTO employees (user_id, employee_number, department, position, hire_date) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      [user!.id, 'EMP001', 'Engineering', 'Developer', '2024-01-01']
    );
    
    const [manager] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['manager@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'manager']
    );
    
    await expect(
      query(
        `INSERT INTO appraisals (employee_id, reviewer_id, review_period_start, review_period_end, goals) 
         VALUES ($1, $2, $3, $4, $5)`,
        [employee!.id, manager!.id, '2024-01-01', '2024-06-30', '{"not": "an array"}']
      )
    ).rejects.toThrow();
  });

  it('should have required indexes', async () => {
    const indexes = [
      'idx_appraisals_employee_id',
      'idx_appraisals_reviewer_id',
      'idx_appraisals_status',
      'idx_appraisals_review_period_end',
      'idx_appraisals_goals_gin'
    ];
    
    for (const index of indexes) {
      const exists = await indexExists(index);
      expect(exists).toBe(true);
    }
  });
});

describe('Database Schema - Leave Requests Table', () => {
  it('should have all required columns', async () => {
    const columns = ['id', 'employee_id', 'leave_type', 'start_date', 'end_date', 'days_count', 'reason', 'status', 'approved_by', 'approved_at', 'created_at', 'updated_at'];
    
    for (const column of columns) {
      const exists = await columnExists('leave_requests', column);
      expect(exists).toBe(true);
    }
  });

  it('should have leave_type enum type', async () => {
    const exists = await enumTypeExists('leave_type');
    expect(exists).toBe(true);
  });

  it('should have leave_status enum type', async () => {
    const exists = await enumTypeExists('leave_status');
    expect(exists).toBe(true);
  });

  it('should have correct leave_type enum values', async () => {
    const values = await getEnumValues('leave_type');
    expect(values).toContain('annual');
    expect(values).toContain('sick');
    expect(values).toContain('unpaid');
    expect(values).toContain('other');
  });

  it('should have correct leave_status enum values', async () => {
    const values = await getEnumValues('leave_status');
    expect(values).toContain('pending');
    expect(values).toContain('approved');
    expect(values).toContain('rejected');
  });

  it('should enforce date range validation', async () => {
    const [user] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['test@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'employee']
    );
    
    const [employee] = await query<{ id: string }>(
      `INSERT INTO employees (user_id, employee_number, department, position, hire_date) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      [user!.id, 'EMP001', 'Engineering', 'Developer', '2024-01-01']
    );
    
    await expect(
      query(
        `INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days_count) 
         VALUES ($1, $2, $3, $4, $5)`,
        [employee!.id, 'annual', '2024-12-31', '2024-12-01', 5]
      )
    ).rejects.toThrow();
  });

  it('should enforce days_count positive constraint', async () => {
    const [user] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['test@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'employee']
    );
    
    const [employee] = await query<{ id: string }>(
      `INSERT INTO employees (user_id, employee_number, department, position, hire_date) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      [user!.id, 'EMP001', 'Engineering', 'Developer', '2024-01-01']
    );
    
    await expect(
      query(
        `INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days_count) 
         VALUES ($1, $2, $3, $4, $5)`,
        [employee!.id, 'annual', '2024-12-01', '2024-12-05', 0]
      )
    ).rejects.toThrow();
  });

  it('should enforce approval workflow constraint', async () => {
    const [user] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['test@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'employee']
    );
    
    const [employee] = await query<{ id: string }>(
      `INSERT INTO employees (user_id, employee_number, department, position, hire_date) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      [user!.id, 'EMP001', 'Engineering', 'Developer', '2024-01-01']
    );
    
    await expect(
      query(
        `INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days_count, status) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [employee!.id, 'annual', '2024-12-01', '2024-12-05', 5, 'approved']
      )
    ).rejects.toThrow();
  });

  it('should have required indexes', async () => {
    const indexes = [
      'idx_leave_requests_employee_id',
      'idx_leave_requests_status',
      'idx_leave_requests_start_date',
      'idx_leave_requests_end_date',
      'idx_leave_requests_approved_by'
    ];
    
    for (const index of indexes) {
      const exists = await indexExists(index);
      expect(exists).toBe(true);
    }
  });
});

describe('Database Schema - Leave Balances Table', () => {
  it('should have all required columns', async () => {
    const columns = ['id', 'employee_id', 'annual_leave_total', 'annual_leave_used', 'sick_leave_total', 'sick_leave_used', 'year', 'created_at', 'updated_at'];
    
    for (const column of columns) {
      const exists = await columnExists('leave_balances', column);
      expect(exists).toBe(true);
    }
  });

  it('should enforce unique employee_id and year constraint', async () => {
    const [user] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['test@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'employee']
    );
    
    const [employee] = await query<{ id: string }>(
      `INSERT INTO employees (user_id, employee_number, department, position, hire_date) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      [user!.id, 'EMP001', 'Engineering', 'Developer', '2024-01-01']
    );
    
    await query(
      `INSERT INTO leave_balances (employee_id, annual_leave_total, sick_leave_total, year) 
       VALUES ($1, $2, $3, $4)`,
      [employee!.id, 20, 10, 2024]
    );
    
    await expect(
      query(
        `INSERT INTO leave_balances (employee_id, annual_leave_total, sick_leave_total, year) 
         VALUES ($1, $2, $3, $4)`,
        [employee!.id, 20, 10, 2024]
      )
    ).rejects.toThrow();
  });

  it('should enforce annual_leave_used not exceeding total', async () => {
    const [user] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['test@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'employee']
    );
    
    const [employee] = await query<{ id: string }>(
      `INSERT INTO employees (user_id, employee_number, department, position, hire_date) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      [user!.id, 'EMP001', 'Engineering', 'Developer', '2024-01-01']
    );
    
    await expect(
      query(
        `INSERT INTO leave_balances (employee_id, annual_leave_total, annual_leave_used, sick_leave_total, year) 
         VALUES ($1, $2, $3, $4, $5)`,
        [employee!.id, 20, 25, 10, 2024]
      )
    ).rejects.toThrow();
  });

  it('should enforce year range constraint', async () => {
    const [user] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['test@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'employee']
    );
    
    const [employee] = await query<{ id: string }>(
      `INSERT INTO employees (user_id, employee_number, department, position, hire_date) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      [user!.id, 'EMP001', 'Engineering', 'Developer', '2024-01-01']
    );
    
    await expect(
      query(
        `INSERT INTO leave_balances (employee_id, annual_leave_total, sick_leave_total, year) 
         VALUES ($1, $2, $3, $4)`,
        [employee!.id, 20, 10, 1999]
      )
    ).rejects.toThrow();
  });

  it('should have required indexes', async () => {
    const indexes = [
      'idx_leave_balances_employee_id',
      'idx_leave_balances_year',
      'idx_leave_balances_employee_year'
    ];
    
    for (const index of indexes) {
      const exists = await indexExists(index);
      expect(exists).toBe(true);
    }
  });
});

describe('Database Schema - Foreign Key Relationships', () => {
  it('should cascade delete employees when user is deleted', async () => {
    const [user] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['test@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'employee']
    );
    
    await query(
      `INSERT INTO employees (user_id, employee_number, department, position, hire_date) 
       VALUES ($1, $2, $3, $4, $5)`,
      [user!.id, 'EMP001', 'Engineering', 'Developer', '2024-01-01']
    );
    
    await query(`DELETE FROM users WHERE id = $1`, [user!.id]);
    
    const employees = await query(
      `SELECT * FROM employees WHERE user_id = $1`,
      [user!.id]
    );
    
    expect(employees).toHaveLength(0);
  });

  it('should cascade delete onboarding tasks when employee is deleted', async () => {
    const [user] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['test@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'employee']
    );
    
    const [employee] = await query<{ id: string }>(
      `INSERT INTO employees (user_id, employee_number, department, position, hire_date) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      [user!.id, 'EMP001', 'Engineering', 'Developer', '2024-01-01']
    );
    
    const [hrUser] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['hr@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'hr_admin']
    );
    
    await query(
      `INSERT INTO onboarding_tasks (employee_id, task_title, assigned_by, due_date) 
       VALUES ($1, $2, $3, $4)`,
      [employee!.id, 'Complete paperwork', hrUser!.id, '2024-12-31']
    );
    
    await query(`DELETE FROM employees WHERE id = $1`, [employee!.id]);
    
    const tasks = await query(
      `SELECT * FROM onboarding_tasks WHERE employee_id = $1`,
      [employee!.id]
    );
    
    expect(tasks).toHaveLength(0);
  });

  it('should set manager_id to null when manager is deleted', async () => {
    const [managerUser] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['manager@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'manager']
    );
    
    const [manager] = await query<{ id: string }>(
      `INSERT INTO employees (user_id, employee_number, department, position, hire_date) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      [managerUser!.id, 'MGR001', 'Engineering', 'Manager', '2024-01-01']
    );
    
    const [employeeUser] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['employee@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'employee']
    );
    
    await query(
      `INSERT INTO employees (user_id, employee_number, department, position, hire_date, manager_id) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [employeeUser!.id, 'EMP001', 'Engineering', 'Developer', '2024-01-01', manager!.id]
    );
    
    await query(`DELETE FROM employees WHERE id = $1`, [manager!.id]);
    
    const [employee] = await query<{ manager_id: string | null }>(
      `SELECT manager_id FROM employees WHERE user_id = $1`,
      [employeeUser!.id]
    );
    
    expect(employee!.manager_id).toBeNull();
  });
});

describe('Database Schema - Default Values', () => {
  it('should set default role to employee for users', async () => {
    const [user] = await query<{ role: string }>(
      `INSERT INTO users (email, password_hash) 
       VALUES ($1, $2) 
       RETURNING role`,
      ['test@example.com', '$2b$10$abcdefghijklmnopqrstuv']
    );
    
    expect(user!.role).toBe('employee');
  });

  it('should set default is_active to true for users', async () => {
    const [user] = await query<{ is_active: boolean }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING is_active`,
      ['test@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'employee']
    );
    
    expect(user!.is_active).toBe(true);
  });

  it('should set default status to active for employees', async () => {
    const [user] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['test@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'employee']
    );
    
    const [employee] = await query<{ status: string }>(
      `INSERT INTO employees (user_id, employee_number, department, position, hire_date) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING status`,
      [user!.id, 'EMP001', 'Engineering', 'Developer', '2024-01-01']
    );
    
    expect(employee!.status).toBe('active');
  });

  it('should set default status to pending for leave requests', async () => {
    const [user] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['test@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'employee']
    );
    
    const [employee] = await query<{ id: string }>(
      `INSERT INTO employees (user_id, employee_number, department, position, hire_date) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      [user!.id, 'EMP001', 'Engineering', 'Developer', '2024-01-01']
    );
    
    const [leaveRequest] = await query<{ status: string }>(
      `INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days_count) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING status`,
      [employee!.id, 'annual', '2024-12-01', '2024-12-05', 5]
    );
    
    expect(leaveRequest!.status).toBe('pending');
  });

  it('should set default goals to empty array for appraisals', async () => {
    const [user] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['test@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'employee']
    );
    
    const [employee] = await query<{ id: string }>(
      `INSERT INTO employees (user_id, employee_number, department, position, hire_date) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      [user!.id, 'EMP001', 'Engineering', 'Developer', '2024-01-01']
    );
    
    const [manager] = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['manager@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'manager']
    );
    
    const [appraisal] = await query<{ goals: any }>(
      `INSERT INTO appraisals (employee_id, reviewer_id, review_period_start, review_period_end) 
       VALUES ($1, $2, $3, $4) 
       RETURNING goals`,
      [employee!.id, manager!.id, '2024-01-01', '2024-06-30']
    );
    
    expect(appraisal!.goals).toEqual([]);
  });
});

describe('Database Schema - Timestamp Auto-Update', () => {
  it('should auto-set created_at and updated_at on insert', async () => {
    const [user] = await query<{ created_at: Date; updated_at: Date }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING created_at, updated_at`,
      ['test@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'employee']
    );
    
    expect(user!.created_at).toBeDefined();
    expect(user!.updated_at).toBeDefined();
    expect(new Date(user!.created_at).getTime()).toBeCloseTo(
      new Date(user!.updated_at).getTime(),
      -2 // Within 100ms
    );
  });

  it('should auto-update updated_at on update', async () => {
    const [user] = await query<{ id: string; updated_at: Date }>(
      `INSERT INTO users (email, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id, updated_at`,
      ['test@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'employee']
    );
    
    const initialUpdatedAt = new Date(user!.updated_at).getTime();
    
    // Wait to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const [updated] = await query<{ updated_at: Date }>(
      `UPDATE users SET first_name = $1 WHERE id = $2 RETURNING updated_at`,
      ['John', user!.id]
    );
    
    expect(new Date(updated!.updated_at).getTime()).toBeGreaterThan(initialUpdatedAt);
  });
});

console.log('[SCHEMA_TEST] Database schema integration tests loaded successfully');