exports.up = (pgm) => {
  pgm.createTable('leave_requests', {
    id: 'id',
    employee_id: {
      type: 'integer',
      notNull: true,
      references: '"employees"',
      onDelete: 'CASCADE',
    },
    leave_type: {
      type: 'varchar(50)',
      notNull: true,
    },
    start_date: {
      type: 'date',
      notNull: true,
    },
    end_date: {
      type: 'date',
      notNull: true,
    },
    days_requested: {
      type: 'decimal(4,1)',
      notNull: true,
    },
    reason: {
      type: 'text',
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: "'pending'",
    },
    reviewed_by: {
      type: 'integer',
      references: '"users"',
      onDelete: 'SET NULL',
    },
    reviewed_at: {
      type: 'timestamp',
    },
    review_notes: {
      type: 'text',
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

  pgm.createIndex('leave_requests', 'employee_id');
  pgm.createIndex('leave_requests', 'status');
  pgm.createIndex('leave_requests', ['start_date', 'end_date']);
};

exports.down = (pgm) => {
  pgm.dropTable('leave_requests');
};