exports.up = (pgm) => {
  pgm.createTable('leave_balances', {
    id: 'id',
    employee_id: {
      type: 'uuid',
      notNull: true,
      references: '"employees"',
      onDelete: 'CASCADE',
    },
    leave_type: {
      type: 'varchar(50)',
      notNull: true,
    },
    year: {
      type: 'integer',
      notNull: true,
    },
    total_days: {
      type: 'decimal(4,1)',
      notNull: true,
      default: 0,
    },
    used_days: {
      type: 'decimal(4,1)',
      notNull: true,
      default: 0,
    },
    pending_days: {
      type: 'decimal(4,1)',
      notNull: true,
      default: 0,
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

  pgm.createIndex('leave_balances', 'employee_id');
  pgm.createIndex('leave_balances', ['employee_id', 'leave_type', 'year'], {
    unique: true,
  });
};

exports.down = (pgm) => {
  pgm.dropTable('leave_balances');
};