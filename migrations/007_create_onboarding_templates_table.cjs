exports.up = (pgm) => {
  // Create onboarding_templates table
  pgm.createTable('onboarding_templates', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    name: {
      type: 'varchar(200)',
      notNull: true,
    },
    description: {
      type: 'text',
      notNull: true,
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
    created_by: {
      type: 'uuid',
      notNull: true,
      references: '"users"',
      onDelete: 'SET NULL',
    },
    department_id: {
      type: 'uuid',
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

  pgm.createIndex('onboarding_templates', 'is_active');
  pgm.createIndex('onboarding_templates', 'created_by');
  
  // Add unique constraint on name for upsert operations in seeding
  pgm.addConstraint('onboarding_templates', 'onboarding_templates_name_unique', {
    unique: 'name',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('onboarding_templates');
};
