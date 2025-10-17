exports.up = (pgm) => {
  pgm.createTable('onboarding_tasks', {
    id: 'id',
    employee_id: {
      type: 'uuid',
      notNull: true,
      references: '"employees"',
      onDelete: 'CASCADE',
    },
    task_name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    status: {
      type: 'varchar(50)',
      notNull: true,
      default: 'pending',
      check: "status IN ('pending', 'in_progress', 'completed')",
    },
    due_date: { type: 'date' },
    completed_at: { type: 'timestamp' },
    assigned_by: {
      type: 'uuid',
      references: '"users"',
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

  pgm.createIndex('onboarding_tasks', 'employee_id');
  pgm.createIndex('onboarding_tasks', 'status');
};

exports.down = (pgm) => {
  pgm.dropTable('onboarding_tasks');
};