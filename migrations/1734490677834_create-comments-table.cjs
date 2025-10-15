exports.up = (pgm) => {
  pgm.createTable('comments', {
    id: 'id',
    post_id: {
      type: 'integer',
      notNull: true,
      references: '"posts"',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'integer',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    content: { type: 'text', notNull: true },
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

  pgm.createIndex('comments', 'post_id');
  pgm.createIndex('comments', 'user_id');
};

exports.down = (pgm) => {
  pgm.dropTable('comments');
};