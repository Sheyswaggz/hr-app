exports.up = (pgm) => {
  pgm.createTable('appraisals', {
    id: 'id',
    employee_id: {
      type: 'uuid',
      notNull: true,
      references: '"employees"',
      onDelete: 'CASCADE',
    },
    reviewer_id: {
      type: 'uuid',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    review_period_start: { type: 'date', notNull: true },
    review_period_end: { type: 'date', notNull: true },
    overall_rating: {
      type: 'integer',
      check: 'overall_rating >= 1 AND overall_rating <= 5',
    },
    strengths: { type: 'text' },
    areas_for_improvement: { type: 'text' },
    goals: { type: 'text' },
    comments: { type: 'text' },
    status: {
      type: 'varchar(50)',
      notNull: true,
      default: 'draft',
      check: "status IN ('draft', 'submitted', 'acknowledged')",
    },
    submitted_at: { type: 'timestamp' },
    acknowledged_at: { type: 'timestamp' },
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

  pgm.createIndex('appraisals', 'employee_id');
  pgm.createIndex('appraisals', 'reviewer_id');
  pgm.createIndex('appraisals', 'status');
};

exports.down = (pgm) => {
  pgm.dropTable('appraisals');
};