exports.up = (pgm) => {
  pgm.createTable('users', {
    id: 'id',
    email: { type: 'varchar(255)', notNull: true, unique: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    first_name: { type: 'varchar(100)', notNull: true },
    last_name: { type: 'varchar(100)', notNull: true },
    role: { 
      type: 'varchar(50)', 
      notNull: true,
      default: 'EMPLOYEE',
      check: "role IN ('HR_ADMIN', 'MANAGER', 'EMPLOYEE')"
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
    failed_login_attempts: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    locked_until: {
      type: 'timestamp',
      notNull: false,
    },
    last_login_at: {
      type: 'timestamp',
      notNull: false,
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

  pgm.createIndex('users', 'email');
};

exports.down = (pgm) => {
  pgm.dropTable('users');
};