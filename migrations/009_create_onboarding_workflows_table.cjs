exports.up = (pgm) => {
  // Create onboarding_workflows table
  pgm.createTable('onboarding_workflows', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    employee_id: {
      type: 'uuid',
      notNull: true,
      references: '"employees"',
      onDelete: 'CASCADE',
    },
    template_id: {
      type: 'uuid',
      notNull: true,
      references: '"onboarding_templates"',
      onDelete: 'SET NULL',
    },
    status: {
      type: 'varchar(50)',
      notNull: true,
      default: 'NOT_STARTED',
      check: "status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')",
    },
    progress: {
      type: 'integer',
      notNull: true,
      default: 0,
      check: 'progress >= 0 AND progress <= 100',
    },
    start_date: {
      type: 'date',
      notNull: true,
    },
    expected_completion_date: {
      type: 'date',
      notNull: true,
    },
    actual_completion_date: {
      type: 'date',
      notNull: false,
    },
    assigned_by: {
      type: 'uuid',
      notNull: true,
      references: '"users"',
      onDelete: 'SET NULL',
    },
    manager_id: {
      type: 'uuid',
      notNull: false,
      references: '"employees"',
      onDelete: 'SET NULL',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('onboarding_workflows', 'employee_id');
  pgm.createIndex('onboarding_workflows', 'template_id');
  pgm.createIndex('onboarding_workflows', 'status');
  pgm.createIndex('onboarding_workflows', 'assigned_by');
  
  // Add unique constraint on employee_id and template_id for upsert operations
  pgm.addConstraint('onboarding_workflows', 'onboarding_workflows_employee_template_unique', {
    unique: ['employee_id', 'template_id'],
  });
};

exports.down = (pgm) => {
  pgm.dropTable('onboarding_workflows');
};
