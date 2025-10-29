exports.up = (pgm) => {
  // Create onboarding_template_tasks table
  pgm.createTable('onboarding_template_tasks', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    template_id: {
      type: 'uuid',
      notNull: true,
      references: '"onboarding_templates"',
      onDelete: 'CASCADE',
    },
    title: {
      type: 'varchar(200)',
      notNull: true,
    },
    description: {
      type: 'text',
      notNull: true,
    },
    days_until_due: {
      type: 'integer',
      notNull: true,
      default: 0,
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

  pgm.createIndex('onboarding_template_tasks', 'template_id');
  pgm.createIndex('onboarding_template_tasks', ['template_id', 'order_number']);
};

exports.down = (pgm) => {
  pgm.dropTable('onboarding_template_tasks');
};
