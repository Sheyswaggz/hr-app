exports.up = (pgm) => {
  pgm.createTable('employees', {
    id: { 
      type: 'uuid', 
      primaryKey: true, 
      default: pgm.func('uuid_generate_v4()') 
    },
    user_id: {
      type: 'uuid',
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
      type: 'uuid',
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