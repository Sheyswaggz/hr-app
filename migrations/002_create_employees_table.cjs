exports.up = (pgm) => {
  pgm.createTable('employees', {
    id: 'id',
    user_id: {
      type: 'integer',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    first_name: { type: 'varchar(100)', notNull: true },
    last_name: { type: 'varchar(100)', notNull: true },
    department: { type: 'varchar(100)' },
    position: { type: 'varchar(100)' },
    hire_date: { type: 'date' },
    manager_id: {
      type: 'integer',
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

  pgm.createIndex('employees', 'user_id');
  pgm.createIndex('employees', 'manager_id');
};

exports.down = (pgm) => {
  pgm.dropTable('employees');
};