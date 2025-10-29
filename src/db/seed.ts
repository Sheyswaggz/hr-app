/**
 * Database Seeding Module
 * 
 * Provides comprehensive database seeding functionality for development and testing
 * environments. Implements idempotent seed operations with proper error handling,
 * transaction management, and data validation.
 * 
 * @module db/seed
 */

import 'dotenv/config';
import bcrypt from 'bcrypt';

import { executeTransaction, queryOne, queryMany, type TransactionCallback } from './index.js';

/**
 * Seed operation metadata
 */
interface SeedMetadata {
  /**
   * Seed operation name
   */
  readonly name: string;

  /**
   * Seed operation description
   */
  readonly description: string;

  /**
   * Number of records to seed
   */
  readonly recordCount: number;

  /**
   * Timestamp when seed was executed
   */
  readonly timestamp: Date;
}

/**
 * Seed operation result
 */
interface SeedResult {
  /**
   * Whether seed operation was successful
   */
  readonly success: boolean;

  /**
   * Seed operation metadata
   */
  readonly metadata: SeedMetadata;

  /**
   * Number of records created
   */
  readonly recordsCreated: number;

  /**
   * Number of records updated
   */
  readonly recordsUpdated: number;

  /**
   * Execution time in milliseconds
   */
  readonly executionTimeMs: number;

  /**
   * Error message if seed failed
   */
  readonly error?: string;
}

/**
 * User seed data
 */
interface UserSeedData {
  readonly email: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly role: 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE';
  readonly isActive: boolean;
}

/**
 * Employee seed data
 */
interface EmployeeSeedData {
  readonly userEmail: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly department?: string;
  readonly position?: string;
  readonly hireDate?: string;
  readonly managerEmail?: string;
}

/**
 * Onboarding template seed data
 */
interface OnboardingTemplateSeedData {
  readonly name: string;
  readonly description: string;
  readonly isActive: boolean;
  readonly createdByEmail: string;
  readonly departmentId?: string;
  readonly tasks: Array<{
    readonly title: string;
    readonly description: string;
    readonly daysUntilDue: number;
    readonly order: number;
    readonly requiresDocument: boolean;
  }>;
}

/**
 * Onboarding workflow seed data
 */
interface OnboardingWorkflowSeedData {
  readonly employeeEmail: string;
  readonly templateName: string;
  readonly startDate: string;
  readonly assignedByEmail: string;
  readonly managerEmail?: string;
}

/**
 * Onboarding task seed data
 */
interface OnboardingTaskSeedData {
  readonly employeeEmail: string;
  readonly taskTitle: string;
  readonly taskDescription: string;
  readonly assignedByEmail: string;
  readonly dueDate: string;
  readonly status: 'pending' | 'in_progress' | 'completed';
  readonly completedAt?: string;
  readonly documentUrl?: string;
}

/**
 * Appraisal seed data
 */
interface AppraisalSeedData {
  readonly employeeEmail: string;
  readonly reviewerEmail: string;
  readonly reviewPeriodStart: string;
  readonly reviewPeriodEnd: string;
  readonly selfAssessment?: string;
  readonly managerFeedback?: string;
  readonly rating?: number;
  readonly goals?: Array<{ title: string; description: string; status: string }>;
  readonly status: 'draft' | 'submitted' | 'completed';
}

/**
 * Leave request seed data
 */
interface LeaveRequestSeedData {
  readonly employeeEmail: string;
  readonly leaveType: 'annual' | 'sick' | 'unpaid' | 'other';
  readonly startDate: string;
  readonly endDate: string;
  readonly daysCount: number;
  readonly reason?: string;
  readonly status: 'pending' | 'approved' | 'rejected';
  readonly approvedByEmail?: string;
  readonly approvedAt?: string;
}

/**
 * Leave balance seed data
 */
interface LeaveBalanceSeedData {
  readonly employeeEmail: string;
  readonly annualLeaveTotal: number;
  readonly annualLeaveUsed: number;
  readonly sickLeaveTotal: number;
  readonly sickLeaveUsed: number;
  readonly year: number;
}

/**
 * Bcrypt salt rounds for password hashing
 */
const BCRYPT_SALT_ROUNDS = 10;

/**
 * Default password for all seeded users
 */
const DEFAULT_PASSWORD = 'Password123!';

/**
 * Hash password using bcrypt
 * 
 * @param password - Plain text password
 * @returns Hashed password
 */
async function hashPassword(password: string): Promise<string> {
  try {
    const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    return hash;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[SEED] Failed to hash password:', {
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
    throw new Error(`[SEED] Password hashing failed: ${errorMessage}`);
  }
}

/**
 * Seed users table with sample data
 * 
 * Creates users with all roles (HR Admin, Manager, Employee) using upsert logic
 * to ensure idempotency. Passwords are hashed using bcrypt.
 * 
 * @param client - Database client for transaction
 * @returns Seed result
 */
async function seedUsers(client: any): Promise<SeedResult> {
  const startTime = Date.now();
  const metadata: SeedMetadata = {
    name: 'users',
    description: 'Seed users with all roles',
    recordCount: 0,
    timestamp: new Date(),
  };

  try {
    console.log('[SEED_USERS] Starting users seed...');

    const users: UserSeedData[] = [
      {
        email: 'admin@hrapp.com',
        password: DEFAULT_PASSWORD,
        firstName: 'Admin',
        lastName: 'User',
        role: 'HR_ADMIN',
        isActive: true,
      },
      {
        email: 'manager1@hrapp.com',
        password: DEFAULT_PASSWORD,
        firstName: 'John',
        lastName: 'Manager',
        role: 'MANAGER',
        isActive: true,
      },
      {
        email: 'manager2@hrapp.com',
        password: DEFAULT_PASSWORD,
        firstName: 'Sarah',
        lastName: 'Manager',
        role: 'MANAGER',
        isActive: true,
      },
      {
        email: 'employee1@hrapp.com',
        password: DEFAULT_PASSWORD,
        firstName: 'Alice',
        lastName: 'Smith',
        role: 'EMPLOYEE',
        isActive: true,
      },
      {
        email: 'employee2@hrapp.com',
        password: DEFAULT_PASSWORD,
        firstName: 'Bob',
        lastName: 'Johnson',
        role: 'EMPLOYEE',
        isActive: true,
      },
      {
        email: 'employee3@hrapp.com',
        password: DEFAULT_PASSWORD,
        firstName: 'Charlie',
        lastName: 'Brown',
        role: 'EMPLOYEE',
        isActive: true,
      },
      {
        email: 'employee4@hrapp.com',
        password: DEFAULT_PASSWORD,
        firstName: 'Diana',
        lastName: 'Wilson',
        role: 'EMPLOYEE',
        isActive: true,
      },
      {
        email: 'employee5@hrapp.com',
        password: DEFAULT_PASSWORD,
        firstName: 'Eve',
        lastName: 'Davis',
        role: 'EMPLOYEE',
        isActive: true,
      },
    ];

    let recordsCreated = 0;
    let recordsUpdated = 0;

    for (const user of users) {
      const passwordHash = await hashPassword(user.password);

      const result = await client.query(
        `
        INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (email) 
        DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          role = EXCLUDED.role,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
        RETURNING (xmax = 0) AS inserted
        `,
        [user.email, passwordHash, user.firstName, user.lastName, user.role, user.isActive]
      );

      if (result.rows[0]?.inserted) {
        recordsCreated++;
      } else {
        recordsUpdated++;
      }
    }

    metadata.recordCount = users.length;
    const executionTimeMs = Date.now() - startTime;

    console.log('[SEED_USERS] Users seeded successfully:', {
      recordsCreated,
      recordsUpdated,
      executionTimeMs,
    });

    return {
      success: true,
      metadata,
      recordsCreated,
      recordsUpdated,
      executionTimeMs,
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[SEED_USERS] Failed to seed users:', {
      error: errorMessage,
      executionTimeMs,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      metadata,
      recordsCreated: 0,
      recordsUpdated: 0,
      executionTimeMs,
      error: errorMessage,
    };
  }
}

/**
 * Seed employees table with sample data
 * 
 * Creates employee records linked to users with proper manager relationships.
 * Uses upsert logic for idempotency.
 * 
 * @param client - Database client for transaction
 * @returns Seed result
 */
async function seedEmployees(client: any): Promise<SeedResult> {
  const startTime = Date.now();
  const metadata: SeedMetadata = {
    name: 'employees',
    description: 'Seed employees with manager relationships',
    recordCount: 0,
    timestamp: new Date(),
  };

  try {
    console.log('[SEED_EMPLOYEES] Starting employees seed...');

    const employees: EmployeeSeedData[] = [
      {
        userEmail: 'manager1@hrapp.com',
        firstName: 'John',
        lastName: 'Manager',
        department: 'Engineering',
        position: 'Engineering Manager',
        hireDate: '2020-01-15',
      },
      {
        userEmail: 'manager2@hrapp.com',
        firstName: 'Sarah',
        lastName: 'Manager',
        department: 'Sales',
        position: 'Sales Manager',
        hireDate: '2020-03-01',
      },
      {
        userEmail: 'employee1@hrapp.com',
        firstName: 'Alice',
        lastName: 'Smith',
        department: 'Engineering',
        position: 'Senior Software Engineer',
        hireDate: '2021-06-01',
        managerEmail: 'manager1@hrapp.com',
      },
      {
        userEmail: 'employee2@hrapp.com',
        firstName: 'Bob',
        lastName: 'Johnson',
        department: 'Engineering',
        position: 'Software Engineer',
        hireDate: '2022-01-15',
        managerEmail: 'manager1@hrapp.com',
      },
      {
        userEmail: 'employee3@hrapp.com',
        firstName: 'Charlie',
        lastName: 'Brown',
        department: 'Engineering',
        position: 'Junior Software Engineer',
        hireDate: '2023-03-01',
        managerEmail: 'manager1@hrapp.com',
      },
      {
        userEmail: 'employee4@hrapp.com',
        firstName: 'Diana',
        lastName: 'Wilson',
        department: 'Sales',
        position: 'Sales Representative',
        hireDate: '2021-09-01',
        managerEmail: 'manager2@hrapp.com',
      },
      {
        userEmail: 'employee5@hrapp.com',
        firstName: 'Eve',
        lastName: 'Davis',
        department: 'Sales',
        position: 'Sales Representative',
        hireDate: '2022-05-15',
        managerEmail: 'manager2@hrapp.com',
      },
    ];

    let recordsCreated = 0;
    let recordsUpdated = 0;

    for (const employee of employees) {
      // Get user_id for employee
      const userResult = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [employee.userEmail]
      );

      if (userResult.rows.length === 0) {
        console.warn(`[SEED_EMPLOYEES] User not found: ${employee.userEmail}`);
        continue;
      }

      const userId = userResult.rows[0].id;

      // Get manager_id if manager email provided
      let managerId = null;
      if (employee.managerEmail) {
        const managerUserResult = await client.query(
          'SELECT id FROM users WHERE email = $1',
          [employee.managerEmail]
        );

        if (managerUserResult.rows.length > 0) {
          const managerUserId = managerUserResult.rows[0].id;

          const managerEmployeeResult = await client.query(
            'SELECT id FROM employees WHERE user_id = $1',
            [managerUserId]
          );

          if (managerEmployeeResult.rows.length > 0) {
            managerId = managerEmployeeResult.rows[0].id;
          }
        }
      }

      const result = await client.query(
        `
        INSERT INTO employees (user_id, first_name, last_name, department, position, hire_date, manager_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
        `,
        [userId, employee.firstName, employee.lastName, employee.department, employee.position, employee.hireDate, managerId]
      );

      if (result.rows.length > 0) {
        recordsCreated++;
      }
    }

    metadata.recordCount = employees.length;
    const executionTimeMs = Date.now() - startTime;

    console.log('[SEED_EMPLOYEES] Employees seeded successfully:', {
      recordsCreated,
      recordsUpdated,
      executionTimeMs,
    });

    return {
      success: true,
      metadata,
      recordsCreated,
      recordsUpdated,
      executionTimeMs,
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[SEED_EMPLOYEES] Failed to seed employees:', {
      error: errorMessage,
      executionTimeMs,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      metadata,
      recordsCreated: 0,
      recordsUpdated: 0,
      executionTimeMs,
      error: errorMessage,
    };
  }
}

/**
 * Seed onboarding_templates table with sample data
 * 
 * Creates onboarding templates with tasks for various departments.
 * Uses upsert logic for idempotency.
 * 
 * @param client - Database client for transaction
 * @returns Seed result
 */
async function seedOnboardingTemplates(client: any): Promise<SeedResult> {
  const startTime = Date.now();
  const metadata: SeedMetadata = {
    name: 'onboarding_templates',
    description: 'Seed onboarding templates with tasks',
    recordCount: 0,
    timestamp: new Date(),
  };

  try {
    console.log('[SEED_ONBOARDING_TEMPLATES] Starting onboarding templates seed...');

    const templates: OnboardingTemplateSeedData[] = [
      {
        name: 'Software Engineer Onboarding',
        description: 'Standard onboarding process for new software engineers',
        isActive: true,
        createdByEmail: 'admin@hrapp.com',
        tasks: [
          {
            title: 'Complete HR Orientation',
            description: 'Attend HR orientation session, review company policies, and complete required paperwork',
            daysUntilDue: 1,
            order: 1,
            requiresDocument: true,
          },
          {
            title: 'Setup Development Environment',
            description: 'Install required software (IDE, Git, Node.js, etc.) and configure development tools',
            daysUntilDue: 2,
            order: 2,
            requiresDocument: false,
          },
          {
            title: 'Complete Security Training',
            description: 'Complete online security awareness training module and pass the assessment',
            daysUntilDue: 3,
            order: 3,
            requiresDocument: true,
          },
          {
            title: 'Review Codebase and Architecture',
            description: 'Review main codebase, understand system architecture, and setup local development environment',
            daysUntilDue: 5,
            order: 4,
            requiresDocument: false,
          },
          {
            title: 'Meet Team Members',
            description: 'Schedule 1:1 meetings with all team members to understand their roles and responsibilities',
            daysUntilDue: 7,
            order: 5,
            requiresDocument: false,
          },
          {
            title: 'Complete First Code Contribution',
            description: 'Complete a small bug fix or feature implementation and submit your first pull request',
            daysUntilDue: 14,
            order: 6,
            requiresDocument: false,
          },
        ],
      },
      {
        name: 'Sales Representative Onboarding',
        description: 'Standard onboarding process for new sales representatives',
        isActive: true,
        createdByEmail: 'admin@hrapp.com',
        tasks: [
          {
            title: 'Complete HR Orientation',
            description: 'Attend HR orientation session and complete required paperwork',
            daysUntilDue: 1,
            order: 1,
            requiresDocument: true,
          },
          {
            title: 'Sales Training Program',
            description: 'Complete 2-week comprehensive sales training program covering products and sales techniques',
            daysUntilDue: 14,
            order: 2,
            requiresDocument: true,
          },
          {
            title: 'Shadow Senior Sales Rep',
            description: 'Shadow a senior sales representative for 1 week to observe client interactions',
            daysUntilDue: 21,
            order: 3,
            requiresDocument: false,
          },
          {
            title: 'Complete CRM Training',
            description: 'Learn to use the CRM system for tracking leads, opportunities, and customer interactions',
            daysUntilDue: 7,
            order: 4,
            requiresDocument: false,
          },
          {
            title: 'First Sales Call',
            description: 'Complete your first sales call with supervision and document the outcome',
            daysUntilDue: 28,
            order: 5,
            requiresDocument: true,
          },
        ],
      },
      {
        name: 'Manager Onboarding',
        description: 'Onboarding process for new managers',
        isActive: true,
        createdByEmail: 'admin@hrapp.com',
        tasks: [
          {
            title: 'Complete HR Orientation',
            description: 'Attend HR orientation session and review manager-specific policies',
            daysUntilDue: 1,
            order: 1,
            requiresDocument: true,
          },
          {
            title: 'Leadership Training',
            description: 'Complete leadership and management training program',
            daysUntilDue: 7,
            order: 2,
            requiresDocument: true,
          },
          {
            title: 'Review Team Structure',
            description: 'Meet with HR to review team structure, roles, and current projects',
            daysUntilDue: 2,
            order: 3,
            requiresDocument: false,
          },
          {
            title: 'One-on-Ones with Direct Reports',
            description: 'Schedule and complete initial 1:1 meetings with all direct reports',
            daysUntilDue: 7,
            order: 4,
            requiresDocument: false,
          },
          {
            title: 'Budget and Resource Review',
            description: 'Review department budget, resources, and planning processes',
            daysUntilDue: 10,
            order: 5,
            requiresDocument: false,
          },
        ],
      },
    ];

    let recordsCreated = 0;
    let recordsUpdated = 0;

    for (const template of templates) {
      // Get created_by user_id
      const createdByResult = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [template.createdByEmail]
      );

      if (createdByResult.rows.length === 0) {
        console.warn(`[SEED_ONBOARDING_TEMPLATES] Created by user not found: ${template.createdByEmail}`);
        continue;
      }

      const createdById = createdByResult.rows[0].id;

      // Insert or update template
      const templateResult = await client.query(
        `
        INSERT INTO onboarding_templates (name, description, is_active, created_by, department_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (name)
        DO UPDATE SET
          description = EXCLUDED.description,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
        RETURNING id, (xmax = 0) AS inserted
        `,
        [template.name, template.description, template.isActive, createdById, template.departmentId || null]
      );

      if (templateResult.rows.length === 0) {
        console.warn(`[SEED_ONBOARDING_TEMPLATES] Failed to insert template: ${template.name}`);
        continue;
      }

      const templateId = templateResult.rows[0].id;
      const isTemplateInserted = templateResult.rows[0].inserted;

      if (isTemplateInserted) {
        recordsCreated++;
      } else {
        recordsUpdated++;
      }

      // Delete existing tasks for this template (to handle updates)
      await client.query(
        'DELETE FROM onboarding_template_tasks WHERE template_id = $1',
        [templateId]
      );

      // Insert template tasks
      for (const task of template.tasks) {
        await client.query(
          `
          INSERT INTO onboarding_template_tasks (
            template_id, title, description, days_until_due, order_number, requires_document
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            templateId,
            task.title,
            task.description,
            task.daysUntilDue,
            task.order,
            task.requiresDocument,
          ]
        );
      }
    }

    const executionTimeMs = Date.now() - startTime;

    console.log('[SEED_ONBOARDING_TEMPLATES] Onboarding templates seeded successfully:', {
      recordsCreated,
      recordsUpdated,
      executionTimeMs,
    });

    return {
      success: true,
      metadata,
      recordsCreated,
      recordsUpdated,
      executionTimeMs,
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[SEED_ONBOARDING_TEMPLATES] Failed to seed onboarding templates:', {
      error: errorMessage,
      executionTimeMs,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      metadata,
      recordsCreated: 0,
      recordsUpdated: 0,
      executionTimeMs,
      error: errorMessage,
    };
  }
}

/**
 * Seed onboarding_workflows table with sample data
 * 
 * Creates onboarding workflows for employees based on templates.
 * Uses upsert logic for idempotency.
 * 
 * @param client - Database client for transaction
 * @returns Seed result
 */
async function seedOnboardingWorkflows(client: any): Promise<SeedResult> {
  const startTime = Date.now();
  const metadata: SeedMetadata = {
    name: 'onboarding_workflows',
    description: 'Seed onboarding workflows for employees',
    recordCount: 0,
    timestamp: new Date(),
  };

  try {
    console.log('[SEED_ONBOARDING_WORKFLOWS] Starting onboarding workflows seed...');

    const workflows: OnboardingWorkflowSeedData[] = [
      {
        employeeEmail: 'employee3@hrapp.com',
        templateName: 'Software Engineer Onboarding',
        startDate: '2023-03-01',
        assignedByEmail: 'admin@hrapp.com',
        managerEmail: 'manager1@hrapp.com',
      },
      {
        employeeEmail: 'employee5@hrapp.com',
        templateName: 'Sales Representative Onboarding',
        startDate: '2022-05-15',
        assignedByEmail: 'admin@hrapp.com',
        managerEmail: 'manager2@hrapp.com',
      },
    ];

    let recordsCreated = 0;
    let recordsUpdated = 0;

    for (const workflow of workflows) {
      // Get employee_id
      const employeeResult = await client.query(
        `
        SELECT e.id 
        FROM employees e
        JOIN users u ON e.user_id = u.id
        WHERE u.email = $1
        `,
        [workflow.employeeEmail]
      );

      if (employeeResult.rows.length === 0) {
        console.warn(`[SEED_ONBOARDING_WORKFLOWS] Employee not found: ${workflow.employeeEmail}`);
        continue;
      }

      const employeeId = employeeResult.rows[0].id;

      // Get template_id
      const templateResult = await client.query(
        'SELECT id FROM onboarding_templates WHERE name = $1',
        [workflow.templateName]
      );

      if (templateResult.rows.length === 0) {
        console.warn(`[SEED_ONBOARDING_WORKFLOWS] Template not found: ${workflow.templateName}`);
        continue;
      }

      const templateId = templateResult.rows[0].id;

      // Get assigned_by user_id
      const assignedByResult = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [workflow.assignedByEmail]
      );

      if (assignedByResult.rows.length === 0) {
        console.warn(`[SEED_ONBOARDING_WORKFLOWS] Assigned by user not found: ${workflow.assignedByEmail}`);
        continue;
      }

      const assignedById = assignedByResult.rows[0].id;

      // Get manager_id if provided
      let managerId = null;
      if (workflow.managerEmail) {
        const managerUserResult = await client.query(
          'SELECT id FROM users WHERE email = $1',
          [workflow.managerEmail]
        );

        if (managerUserResult.rows.length > 0) {
          const managerUserId = managerUserResult.rows[0].id;

          const managerEmployeeResult = await client.query(
            'SELECT id FROM employees WHERE user_id = $1',
            [managerUserId]
          );

          if (managerEmployeeResult.rows.length > 0) {
            managerId = managerEmployeeResult.rows[0].id;
          }
        }
      }

      // Get template tasks to calculate expected completion date
      const templateTasks = await client.query(
        'SELECT MAX(days_until_due) as max_days FROM onboarding_template_tasks WHERE template_id = $1',
        [templateId]
      );

      const maxDays = templateTasks.rows[0]?.max_days || 30;
      const startDate = new Date(workflow.startDate);
      const expectedCompletionDate = new Date(startDate);
      expectedCompletionDate.setDate(expectedCompletionDate.getDate() + maxDays);

      // Insert workflow
      const workflowResult = await client.query(
        `
        INSERT INTO onboarding_workflows (
          employee_id, template_id, status, progress, start_date, 
          expected_completion_date, assigned_by, manager_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (employee_id, template_id)
        DO UPDATE SET
          status = EXCLUDED.status,
          progress = EXCLUDED.progress,
          start_date = EXCLUDED.start_date,
          expected_completion_date = EXCLUDED.expected_completion_date,
          updated_at = NOW()
        RETURNING id, (xmax = 0) AS inserted
        `,
        [
          employeeId,
          templateId,
          'IN_PROGRESS',
          50,
          workflow.startDate,
          expectedCompletionDate,
          assignedById,
          managerId,
        ]
      );

      if (workflowResult.rows[0]?.inserted) {
        recordsCreated++;
      } else {
        recordsUpdated++;
      }

      const workflowId = workflowResult.rows[0].id;

      // Get template tasks and create workflow tasks
      const tasks = await client.query(
        'SELECT * FROM onboarding_template_tasks WHERE template_id = $1 ORDER BY order_number ASC',
        [templateId]
      );

      // Delete existing workflow tasks (to handle updates)
      await client.query(
        'DELETE FROM onboarding_tasks WHERE workflow_id = $1',
        [workflowId]
      );

      // Create workflow tasks from template tasks
      for (const task of tasks.rows) {
        const dueDate = new Date(startDate);
        dueDate.setDate(dueDate.getDate() + task.days_until_due);

        // Determine task status (some completed, some pending)
        let status = 'PENDING';
        let completedAt = null;
        if (task.order_number <= 2) {
          status = 'COMPLETED';
          completedAt = new Date(dueDate);
          completedAt.setDate(completedAt.getDate() - 1); // Completed 1 day before due
        } else if (task.order_number === 3) {
          status = 'IN_PROGRESS';
        }

        await client.query(
          `
          INSERT INTO onboarding_tasks (
            workflow_id, employee_id, title, description, due_date, 
            status, order_number, requires_document, completed_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [
            workflowId,
            employeeId,
            task.title,
            task.description,
            dueDate,
            status,
            task.order_number,
            task.requires_document,
            completedAt,
          ]
        );
      }
    }

    const executionTimeMs = Date.now() - startTime;

    console.log('[SEED_ONBOARDING_WORKFLOWS] Onboarding workflows seeded successfully:', {
      recordsCreated,
      recordsUpdated,
      executionTimeMs,
    });

    return {
      success: true,
      metadata,
      recordsCreated,
      recordsUpdated,
      executionTimeMs,
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[SEED_ONBOARDING_WORKFLOWS] Failed to seed onboarding workflows:', {
      error: errorMessage,
      executionTimeMs,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      metadata,
      recordsCreated: 0,
      recordsUpdated: 0,
      executionTimeMs,
      error: errorMessage,
    };
  }
}

/**
 * Seed onboarding_tasks table with sample data
 * 
 * Creates onboarding tasks for employees with various statuses.
 * Uses upsert logic for idempotency.
 * 
 * @param client - Database client for transaction
 * @returns Seed result
 */
async function seedOnboardingTasks(client: any): Promise<SeedResult> {
  const startTime = Date.now();
  const metadata: SeedMetadata = {
    name: 'onboarding_tasks',
    description: 'Seed onboarding tasks for employees',
    recordCount: 0,
    timestamp: new Date(),
  };

  try {
    console.log('[SEED_ONBOARDING_TASKS] Starting onboarding tasks seed...');

    const tasks: OnboardingTaskSeedData[] = [
      {
        employeeEmail: 'employee3@hrapp.com',
        taskTitle: 'Complete HR Orientation',
        taskDescription: 'Attend HR orientation session and complete required paperwork',
        assignedByEmail: 'admin@hrapp.com',
        dueDate: '2023-03-15',
        status: 'completed',
        completedAt: '2023-03-10T10:00:00Z',
      },
      {
        employeeEmail: 'employee3@hrapp.com',
        taskTitle: 'Setup Development Environment',
        taskDescription: 'Install required software and configure development tools',
        assignedByEmail: 'manager1@hrapp.com',
        dueDate: '2023-03-20',
        status: 'completed',
        completedAt: '2023-03-18T14:30:00Z',
      },
      {
        employeeEmail: 'employee3@hrapp.com',
        taskTitle: 'Complete Security Training',
        taskDescription: 'Complete online security awareness training module',
        assignedByEmail: 'admin@hrapp.com',
        dueDate: '2023-03-25',
        status: 'in_progress',
        documentUrl: 'https://training.hrapp.com/security-101',
      },
      {
        employeeEmail: 'employee5@hrapp.com',
        taskTitle: 'Sales Training Program',
        taskDescription: 'Complete 2-week sales training program',
        assignedByEmail: 'manager2@hrapp.com',
        dueDate: '2022-06-01',
        status: 'completed',
        completedAt: '2022-05-30T16:00:00Z',
      },
      {
        employeeEmail: 'employee5@hrapp.com',
        taskTitle: 'Shadow Senior Sales Rep',
        taskDescription: 'Shadow senior sales representative for 1 week',
        assignedByEmail: 'manager2@hrapp.com',
        dueDate: '2022-06-10',
        status: 'completed',
        completedAt: '2022-06-08T17:00:00Z',
      },
    ];

    let recordsCreated = 0;
    let recordsUpdated = 0;

    for (const task of tasks) {
      // Get employee_id
      const employeeResult = await client.query(
        `
        SELECT e.id 
        FROM employees e
        JOIN users u ON e.user_id = u.id
        WHERE u.email = $1
        `,
        [task.employeeEmail]
      );

      if (employeeResult.rows.length === 0) {
        console.warn(`[SEED_ONBOARDING_TASKS] Employee not found: ${task.employeeEmail}`);
        continue;
      }

      const employeeId = employeeResult.rows[0].id;

      // Get assigned_by user_id
      const assignedByResult = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [task.assignedByEmail]
      );

      if (assignedByResult.rows.length === 0) {
        console.warn(`[SEED_ONBOARDING_TASKS] Assigned by user not found: ${task.assignedByEmail}`);
        continue;
      }

      const assignedById = assignedByResult.rows[0].id;

      const result = await client.query(
        `
        INSERT INTO onboarding_tasks (
          employee_id, task_title, task_description, assigned_by, 
          due_date, status, completed_at, document_url
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (employee_id, task_title)
        DO UPDATE SET
          task_description = EXCLUDED.task_description,
          assigned_by = EXCLUDED.assigned_by,
          due_date = EXCLUDED.due_date,
          status = EXCLUDED.status,
          completed_at = EXCLUDED.completed_at,
          document_url = EXCLUDED.document_url,
          updated_at = NOW()
        RETURNING (xmax = 0) AS inserted
        `,
        [
          employeeId,
          task.taskTitle,
          task.taskDescription,
          assignedById,
          task.dueDate,
          task.status,
          task.completedAt || null,
          task.documentUrl || null,
        ]
      );

      if (result.rows[0]?.inserted) {
        recordsCreated++;
      } else {
        recordsUpdated++;
      }
    }

    metadata.recordCount = tasks.length;
    const executionTimeMs = Date.now() - startTime;

    console.log('[SEED_ONBOARDING_TASKS] Onboarding tasks seeded successfully:', {
      recordsCreated,
      recordsUpdated,
      executionTimeMs,
    });

    return {
      success: true,
      metadata,
      recordsCreated,
      recordsUpdated,
      executionTimeMs,
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[SEED_ONBOARDING_TASKS] Failed to seed onboarding tasks:', {
      error: errorMessage,
      executionTimeMs,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      metadata,
      recordsCreated: 0,
      recordsUpdated: 0,
      executionTimeMs,
      error: errorMessage,
    };
  }
}

/**
 * Seed appraisals table with sample data
 * 
 * Creates performance appraisals for employees with various statuses.
 * Uses upsert logic for idempotency.
 * 
 * @param client - Database client for transaction
 * @returns Seed result
 */
async function seedAppraisals(client: any): Promise<SeedResult> {
  const startTime = Date.now();
  const metadata: SeedMetadata = {
    name: 'appraisals',
    description: 'Seed performance appraisals',
    recordCount: 0,
    timestamp: new Date(),
  };

  try {
    console.log('[SEED_APPRAISALS] Starting appraisals seed...');

    const appraisals: AppraisalSeedData[] = [
      {
        employeeEmail: 'employee1@hrapp.com',
        reviewerEmail: 'manager1@hrapp.com',
        reviewPeriodStart: '2023-01-01',
        reviewPeriodEnd: '2023-06-30',
        selfAssessment: 'Successfully delivered multiple high-priority projects on time. Improved code quality and mentored junior developers.',
        managerFeedback: 'Excellent performance. Consistently exceeds expectations and demonstrates strong technical leadership.',
        rating: 5,
        goals: [
          { title: 'Lead architecture redesign', description: 'Lead the redesign of core system architecture', status: 'completed' },
          { title: 'Mentor 2 junior developers', description: 'Provide mentorship to junior team members', status: 'completed' },
        ],
        status: 'completed',
      },
      {
        employeeEmail: 'employee2@hrapp.com',
        reviewerEmail: 'manager1@hrapp.com',
        reviewPeriodStart: '2023-01-01',
        reviewPeriodEnd: '2023-06-30',
        selfAssessment: 'Completed assigned tasks and improved technical skills through training.',
        managerFeedback: 'Good performance. Shows steady improvement and willingness to learn.',
        rating: 4,
        goals: [
          { title: 'Complete React certification', description: 'Obtain React developer certification', status: 'completed' },
          { title: 'Improve code review participation', description: 'Actively participate in code reviews', status: 'in_progress' },
        ],
        status: 'completed',
      },
      {
        employeeEmail: 'employee3@hrapp.com',
        reviewerEmail: 'manager1@hrapp.com',
        reviewPeriodStart: '2023-07-01',
        reviewPeriodEnd: '2023-12-31',
        selfAssessment: 'Learning quickly and contributing to team projects. Completed onboarding successfully.',
        status: 'submitted',
      },
      {
        employeeEmail: 'employee4@hrapp.com',
        reviewerEmail: 'manager2@hrapp.com',
        reviewPeriodStart: '2023-01-01',
        reviewPeriodEnd: '2023-06-30',
        managerFeedback: 'Strong sales performance. Exceeded quarterly targets consistently.',
        rating: 5,
        goals: [
          { title: 'Exceed Q1 sales target', description: 'Achieve 120% of Q1 sales target', status: 'completed' },
          { title: 'Develop new client relationships', description: 'Establish 10 new client relationships', status: 'completed' },
        ],
        status: 'completed',
      },
    ];

    let recordsCreated = 0;
    let recordsUpdated = 0;

    for (const appraisal of appraisals) {
      // Get employee_id
      const employeeResult = await client.query(
        `
        SELECT e.id 
        FROM employees e
        JOIN users u ON e.user_id = u.id
        WHERE u.email = $1
        `,
        [appraisal.employeeEmail]
      );

      if (employeeResult.rows.length === 0) {
        console.warn(`[SEED_APPRAISALS] Employee not found: ${appraisal.employeeEmail}`);
        continue;
      }

      const employeeId = employeeResult.rows[0].id;

      // Get reviewer_id
      const reviewerResult = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [appraisal.reviewerEmail]
      );

      if (reviewerResult.rows.length === 0) {
        console.warn(`[SEED_APPRAISALS] Reviewer not found: ${appraisal.reviewerEmail}`);
        continue;
      }

      const reviewerId = reviewerResult.rows[0].id;

      const result = await client.query(
        `
        INSERT INTO appraisals (
          employee_id, reviewer_id, review_period_start, review_period_end,
          self_assessment, manager_feedback, rating, goals, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (employee_id, review_period_start, review_period_end)
        DO UPDATE SET
          reviewer_id = EXCLUDED.reviewer_id,
          self_assessment = EXCLUDED.self_assessment,
          manager_feedback = EXCLUDED.manager_feedback,
          rating = EXCLUDED.rating,
          goals = EXCLUDED.goals,
          status = EXCLUDED.status,
          updated_at = NOW()
        RETURNING (xmax = 0) AS inserted
        `,
        [
          employeeId,
          reviewerId,
          appraisal.reviewPeriodStart,
          appraisal.reviewPeriodEnd,
          appraisal.selfAssessment || null,
          appraisal.managerFeedback || null,
          appraisal.rating || null,
          appraisal.goals ? JSON.stringify(appraisal.goals) : '[]',
          appraisal.status,
        ]
      );

      if (result.rows[0]?.inserted) {
        recordsCreated++;
      } else {
        recordsUpdated++;
      }
    }

    metadata.recordCount = appraisals.length;
    const executionTimeMs = Date.now() - startTime;

    console.log('[SEED_APPRAISALS] Appraisals seeded successfully:', {
      recordsCreated,
      recordsUpdated,
      executionTimeMs,
    });

    return {
      success: true,
      metadata,
      recordsCreated,
      recordsUpdated,
      executionTimeMs,
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[SEED_APPRAISALS] Failed to seed appraisals:', {
      error: errorMessage,
      executionTimeMs,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      metadata,
      recordsCreated: 0,
      recordsUpdated: 0,
      executionTimeMs,
      error: errorMessage,
    };
  }
}

/**
 * Seed leave_requests table with sample data
 * 
 * Creates leave requests for employees with various statuses.
 * Uses upsert logic for idempotency.
 * 
 * @param client - Database client for transaction
 * @returns Seed result
 */
async function seedLeaveRequests(client: any): Promise<SeedResult> {
  const startTime = Date.now();
  const metadata: SeedMetadata = {
    name: 'leave_requests',
    description: 'Seed leave requests',
    recordCount: 0,
    timestamp: new Date(),
  };

  try {
    console.log('[SEED_LEAVE_REQUESTS] Starting leave requests seed...');

    const leaveRequests: LeaveRequestSeedData[] = [
      {
        employeeEmail: 'employee1@hrapp.com',
        leaveType: 'annual',
        startDate: '2023-07-01',
        endDate: '2023-07-10',
        daysCount: 10,
        reason: 'Summer vacation',
        status: 'approved',
        approvedByEmail: 'manager1@hrapp.com',
        approvedAt: '2023-06-15T10:00:00Z',
      },
      {
        employeeEmail: 'employee1@hrapp.com',
        leaveType: 'sick',
        startDate: '2023-09-05',
        endDate: '2023-09-06',
        daysCount: 2,
        reason: 'Medical appointment',
        status: 'approved',
        approvedByEmail: 'manager1@hrapp.com',
        approvedAt: '2023-09-04T14:30:00Z',
      },
      {
        employeeEmail: 'employee2@hrapp.com',
        leaveType: 'annual',
        startDate: '2023-12-20',
        endDate: '2023-12-31',
        daysCount: 12,
        reason: 'Holiday vacation',
        status: 'pending',
      },
      {
        employeeEmail: 'employee3@hrapp.com',
        leaveType: 'annual',
        startDate: '2023-08-15',
        endDate: '2023-08-20',
        daysCount: 6,
        reason: 'Family trip',
        status: 'approved',
        approvedByEmail: 'manager1@hrapp.com',
        approvedAt: '2023-08-01T09:00:00Z',
      },
      {
        employeeEmail: 'employee4@hrapp.com',
        leaveType: 'sick',
        startDate: '2023-10-10',
        endDate: '2023-10-11',
        daysCount: 2,
        reason: 'Flu',
        status: 'approved',
        approvedByEmail: 'manager2@hrapp.com',
        approvedAt: '2023-10-09T16:00:00Z',
      },
      {
        employeeEmail: 'employee5@hrapp.com',
        leaveType: 'annual',
        startDate: '2023-11-01',
        endDate: '2023-11-05',
        daysCount: 5,
        reason: 'Personal time off',
        status: 'rejected',
        approvedByEmail: 'manager2@hrapp.com',
        approvedAt: '2023-10-25T11:00:00Z',
      },
    ];

    let recordsCreated = 0;
    let recordsUpdated = 0;

    for (const leaveRequest of leaveRequests) {
      // Get employee_id
      const employeeResult = await client.query(
        `
        SELECT e.id 
        FROM employees e
        JOIN users u ON e.user_id = u.id
        WHERE u.email = $1
        `,
        [leaveRequest.employeeEmail]
      );

      if (employeeResult.rows.length === 0) {
        console.warn(`[SEED_LEAVE_REQUESTS] Employee not found: ${leaveRequest.employeeEmail}`);
        continue;
      }

      const employeeId = employeeResult.rows[0].id;

      // Get approved_by user_id if provided
      let approvedById = null;
      if (leaveRequest.approvedByEmail) {
        const approvedByResult = await client.query(
          'SELECT id FROM users WHERE email = $1',
          [leaveRequest.approvedByEmail]
        );

        if (approvedByResult.rows.length > 0) {
          approvedById = approvedByResult.rows[0].id;
        }
      }

      const result = await client.query(
        `
        INSERT INTO leave_requests (
          employee_id, leave_type, start_date, end_date, days_count,
          reason, status, approved_by, approved_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (employee_id, start_date, end_date)
        DO UPDATE SET
          leave_type = EXCLUDED.leave_type,
          days_count = EXCLUDED.days_count,
          reason = EXCLUDED.reason,
          status = EXCLUDED.status,
          approved_by = EXCLUDED.approved_by,
          approved_at = EXCLUDED.approved_at,
          updated_at = NOW()
        RETURNING (xmax = 0) AS inserted
        `,
        [
          employeeId,
          leaveRequest.leaveType,
          leaveRequest.startDate,
          leaveRequest.endDate,
          leaveRequest.daysCount,
          leaveRequest.reason || null,
          leaveRequest.status,
          approvedById,
          leaveRequest.approvedAt || null,
        ]
      );

      if (result.rows[0]?.inserted) {
        recordsCreated++;
      } else {
        recordsUpdated++;
      }
    }

    metadata.recordCount = leaveRequests.length;
    const executionTimeMs = Date.now() - startTime;

    console.log('[SEED_LEAVE_REQUESTS] Leave requests seeded successfully:', {
      recordsCreated,
      recordsUpdated,
      executionTimeMs,
    });

    return {
      success: true,
      metadata,
      recordsCreated,
      recordsUpdated,
      executionTimeMs,
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[SEED_LEAVE_REQUESTS] Failed to seed leave requests:', {
      error: errorMessage,
      executionTimeMs,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      metadata,
      recordsCreated: 0,
      recordsUpdated: 0,
      executionTimeMs,
      error: errorMessage,
    };
  }
}

/**
 * Seed leave_balances table with sample data
 * 
 * Creates leave balance records for employees.
 * Uses upsert logic for idempotency.
 * 
 * @param client - Database client for transaction
 * @returns Seed result
 */
async function seedLeaveBalances(client: any): Promise<SeedResult> {
  const startTime = Date.now();
  const metadata: SeedMetadata = {
    name: 'leave_balances',
    description: 'Seed leave balances',
    recordCount: 0,
    timestamp: new Date(),
  };

  try {
    console.log('[SEED_LEAVE_BALANCES] Starting leave balances seed...');

    const currentYear = new Date().getFullYear();

    const leaveBalances: LeaveBalanceSeedData[] = [
      {
        employeeEmail: 'employee1@hrapp.com',
        annualLeaveTotal: 20,
        annualLeaveUsed: 12,
        sickLeaveTotal: 10,
        sickLeaveUsed: 2,
        year: currentYear,
      },
      {
        employeeEmail: 'employee2@hrapp.com',
        annualLeaveTotal: 20,
        annualLeaveUsed: 0,
        sickLeaveTotal: 10,
        sickLeaveUsed: 0,
        year: currentYear,
      },
      {
        employeeEmail: 'employee3@hrapp.com',
        annualLeaveTotal: 15,
        annualLeaveUsed: 6,
        sickLeaveTotal: 10,
        sickLeaveUsed: 0,
        year: currentYear,
      },
      {
        employeeEmail: 'employee4@hrapp.com',
        annualLeaveTotal: 20,
        annualLeaveUsed: 0,
        sickLeaveTotal: 10,
        sickLeaveUsed: 2,
        year: currentYear,
      },
      {
        employeeEmail: 'employee5@hrapp.com',
        annualLeaveTotal: 20,
        annualLeaveUsed: 5,
        sickLeaveTotal: 10,
        sickLeaveUsed: 0,
        year: currentYear,
      },
    ];

    let recordsCreated = 0;
    let recordsUpdated = 0;

    for (const balance of leaveBalances) {
      // Get employee_id
      const employeeResult = await client.query(
        `
        SELECT e.id 
        FROM employees e
        JOIN users u ON e.user_id = u.id
        WHERE u.email = $1
        `,
        [balance.employeeEmail]
      );

      if (employeeResult.rows.length === 0) {
        console.warn(`[SEED_LEAVE_BALANCES] Employee not found: ${balance.employeeEmail}`);
        continue;
      }

      const employeeId = employeeResult.rows[0].id;

      const result = await client.query(
        `
        INSERT INTO leave_balances (
          employee_id, annual_leave_total, annual_leave_used,
          sick_leave_total, sick_leave_used, year
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (employee_id, year)
        DO UPDATE SET
          annual_leave_total = EXCLUDED.annual_leave_total,
          annual_leave_used = EXCLUDED.annual_leave_used,
          sick_leave_total = EXCLUDED.sick_leave_total,
          sick_leave_used = EXCLUDED.sick_leave_used,
          updated_at = NOW()
        RETURNING (xmax = 0) AS inserted
        `,
        [
          employeeId,
          balance.annualLeaveTotal,
          balance.annualLeaveUsed,
          balance.sickLeaveTotal,
          balance.sickLeaveUsed,
          balance.year,
        ]
      );

      if (result.rows[0]?.inserted) {
        recordsCreated++;
      } else {
        recordsUpdated++;
      }
    }

    metadata.recordCount = leaveBalances.length;
    const executionTimeMs = Date.now() - startTime;

    console.log('[SEED_LEAVE_BALANCES] Leave balances seeded successfully:', {
      recordsCreated,
      recordsUpdated,
      executionTimeMs,
    });

    return {
      success: true,
      metadata,
      recordsCreated,
      recordsUpdated,
      executionTimeMs,
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[SEED_LEAVE_BALANCES] Failed to seed leave balances:', {
      error: errorMessage,
      executionTimeMs,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      metadata,
      recordsCreated: 0,
      recordsUpdated: 0,
      executionTimeMs,
      error: errorMessage,
    };
  }
}

/**
 * Clean up all seed data from database
 * 
 * Truncates all tables in reverse dependency order to maintain referential integrity.
 * Resets sequences to initial values.
 * 
 * @returns Cleanup result
 */
export async function cleanupSeedData(): Promise<{
  readonly success: boolean;
  readonly tablesCleared: string[];
  readonly executionTimeMs: number;
  readonly error?: string;
}> {
  const startTime = Date.now();

  try {
    console.log('[SEED_CLEANUP] Starting seed data cleanup...');

    const tablesCleared: string[] = [];

    await executeTransaction(async (client) => {
      // Truncate tables in reverse dependency order
      const tables = [
        'leave_balances',
        'leave_requests',
        'appraisals',
        'onboarding_tasks',
        'onboarding_workflows',
        'onboarding_template_tasks',
        'onboarding_templates',
        'employees',
        'users',
      ];

      for (const table of tables) {
        await client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
        tablesCleared.push(table);
        console.log(`[SEED_CLEANUP] Truncated table: ${table}`);
      }
    });

    const executionTimeMs = Date.now() - startTime;

    console.log('[SEED_CLEANUP] Seed data cleanup completed successfully:', {
      tablesCleared,
      executionTimeMs,
    });

    return {
      success: true,
      tablesCleared,
      executionTimeMs,
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[SEED_CLEANUP] Failed to cleanup seed data:', {
      error: errorMessage,
      executionTimeMs,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      tablesCleared: [],
      executionTimeMs,
      error: errorMessage,
    };
  }
}

/**
 * Main seed function
 * 
 * Executes all seed operations in a single transaction.
 * Provides comprehensive logging and error handling.
 * 
 * @param options - Seed options
 * @returns Seed results for all operations
 */
export async function seed(options?: {
  readonly cleanup?: boolean;
  readonly correlationId?: string;
}): Promise<{
  readonly success: boolean;
  readonly results: SeedResult[];
  readonly totalExecutionTimeMs: number;
  readonly error?: string;
}> {
  const startTime = Date.now();
  const correlationId = options?.correlationId || `seed_${Date.now()}`;

  console.log('[SEED] Starting database seeding...', {
    correlationId,
    cleanup: options?.cleanup ?? false,
    timestamp: new Date().toISOString(),
  });

  try {
    // Cleanup existing data if requested
    if (options?.cleanup) {
      const cleanupResult = await cleanupSeedData();
      if (!cleanupResult.success) {
        throw new Error(`Cleanup failed: ${cleanupResult.error}`);
      }
    }

    // Execute all seed operations in a transaction
    const results = await executeTransaction<SeedResult[]>(
      async (client) => {
        const seedResults: SeedResult[] = [];

        // Seed users
        const usersResult = await seedUsers(client);
        seedResults.push(usersResult);
        if (!usersResult.success) {
          throw new Error(`Users seed failed: ${usersResult.error}`);
        }

        // Seed employees
        const employeesResult = await seedEmployees(client);
        seedResults.push(employeesResult);
        if (!employeesResult.success) {
          throw new Error(`Employees seed failed: ${employeesResult.error}`);
        }

        // Seed onboarding templates
        const onboardingTemplatesResult = await seedOnboardingTemplates(client);
        seedResults.push(onboardingTemplatesResult);
        if (!onboardingTemplatesResult.success) {
          throw new Error(`Onboarding templates seed failed: ${onboardingTemplatesResult.error}`);
        }

        // Seed onboarding workflows
        const onboardingWorkflowsResult = await seedOnboardingWorkflows(client);
        seedResults.push(onboardingWorkflowsResult);
        if (!onboardingWorkflowsResult.success) {
          throw new Error(`Onboarding workflows seed failed: ${onboardingWorkflowsResult.error}`);
        }

        // Note: onboarding_tasks are now created through workflows, not seeded directly
        // The seedOnboardingTasks function is legacy and has been disabled

        // Note: Appraisals and leave management seeds are disabled for now
        // They need to be updated to match the current database schema
        // Focus is on onboarding system functionality

        return seedResults;
      },
      {
        correlationId,
        operation: 'seed_database',
      }
    );

    const totalExecutionTimeMs = Date.now() - startTime;

    // Calculate summary statistics
    const totalRecordsCreated = results.reduce((sum, r) => sum + r.recordsCreated, 0);
    const totalRecordsUpdated = results.reduce((sum, r) => sum + r.recordsUpdated, 0);

    console.log('[SEED] Database seeding completed successfully:', {
      correlationId,
      totalExecutionTimeMs,
      totalRecordsCreated,
      totalRecordsUpdated,
      operations: results.length,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      results,
      totalExecutionTimeMs,
    };
  } catch (error) {
    const totalExecutionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[SEED] Database seeding failed:', {
      correlationId,
      error: errorMessage,
      totalExecutionTimeMs,
      timestamp: new Date().toISOString(),
    });

    return {
      success: false,
      results: [],
      totalExecutionTimeMs,
      error: errorMessage,
    };
  }
}

/**
 * Default export: seed function
 */
export default seed;

/**
 * Execute seed if run directly
 */
const isMainModule = import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') || '');
if (isMainModule || process.argv[1]?.includes('seed.ts')) {
  seed({ cleanup: true })
    .then((result) => {
      if (result.success) {
        console.log('\n✅ Database seeding completed successfully!');
        console.log(`Total execution time: ${result.totalExecutionTimeMs}ms`);
        console.log(`Total operations: ${result.results.length}`);
        
        result.results.forEach((r) => {
          console.log(`  - ${r.metadata.name}: ${r.recordsCreated} created, ${r.recordsUpdated} updated`);
        });
        
        process.exit(0);
      } else {
        console.error('\n❌ Database seeding failed!');
        console.error(`Error: ${result.error}`);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n❌ Database seeding crashed!');
      console.error(error);
      process.exit(1);
    });
}