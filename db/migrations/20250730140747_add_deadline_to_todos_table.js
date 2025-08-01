exports.up = function(knex) {
  return knex.schema.table('todos', function(table) {
    table.date('deadline').nullable().after('status');
  });
};

exports.down = function(knex) {
  return knex.schema.table('todos', function(table) {
    table.dropColumn('deadline');
  });
};