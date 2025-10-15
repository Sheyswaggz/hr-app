exports.up = (pgm) => {
  pgm.createTable('posts', {
    id: 'id',
    user_id: {
      type: 'integer',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    title: { type: 'varchar(255)', notNull: true },
    content: { type: 'text', notNull: true },
    published: { type: 'boolean', notNull: true, default: false },
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

  pgm.createIndex('posts', 'user_id');
  pgm.createIndex('posts', 'published');
};

exports.down = (pgm) => {
  pgm.dropTable('posts');
};