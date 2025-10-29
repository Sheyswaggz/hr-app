exports.up = (pgm) => {
  // Drop old constraints and columns that don't match the new schema
  pgm.dropConstraint('onboarding_tasks', 'onboarding_tasks_status_check', { ifExists: true });
  
  // Rename columns to match the new schema
  pgm.renameColumn('onboarding_tasks', 'task_name', 'title', { ifExists: true });
  
  // Add new columns for the updated schema
  pgm.addColumns('onboarding_tasks', {
    workflow_id: {
      type: 'uuid',
      notNull: false,
      references: '"onboarding_workflows"',
      onDelete: 'CASCADE',
    },
    status: {
      type: 'varchar(50)',
      notNull: true,
      default: 'PENDING',
    },
    document_url: {
      type: 'text',
      notNull: false,
    },
    order_number: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    requires_document: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
  }, { ifNotExists: true });

  // Add new constraint for status
  pgm.addConstraint('onboarding_tasks', 'onboarding_tasks_status_check', {
    check: "status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')",
  });

  // Add indexes
  pgm.createIndex('onboarding_tasks', 'workflow_id', { ifNotExists: true });
  pgm.createIndex('onboarding_tasks', ['workflow_id', 'order_number'], { ifNotExists: true });
  pgm.createIndex('onboarding_tasks', 'status', { ifNotExists: true });
};

exports.down = (pgm) => {
  // Remove new columns
  pgm.dropColumns('onboarding_tasks', ['workflow_id', 'document_url', 'order_number', 'requires_document']);
  
  // Rename columns back
  pgm.renameColumn('onboarding_tasks', 'title', 'task_name');
  
  // Drop new constraint
  pgm.dropConstraint('onboarding_tasks', 'onboarding_tasks_status_check');
  
  // Add old constraint
  pgm.addConstraint('onboarding_tasks', 'onboarding_tasks_status_check', {
    check: "status IN ('pending', 'in_progress', 'completed')",
  });
};
