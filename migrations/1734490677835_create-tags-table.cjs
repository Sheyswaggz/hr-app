exports.up = (pgm) => {
  pgm.createTable('tags', {
    id: 'id',
    name: { type: 'varchar(50)', notNull: true, unique: true },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createTable('post_tags', {
    post_id: {
      type: 'integer',
      notNull: true,
      references: '"posts"',
      onDelete: 'CASCADE',
    },
    tag_id: {
      type: 'integer',
      notNull: true,
      references: '"tags"',
      onDelete: 'CASCADE',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.addConstraint('post_tags', 'post_tags_pkey', {
    primaryKey: ['post_id', 'tag_id'],
  });

  pgm.createIndex('post_tags', 'post_id');
  pgm.createIndex('post_tags', 'tag_id');
};

exports.down = (pgm) => {
  pgm.dropTable('post_tags');
  pgm.dropTable('tags');
};