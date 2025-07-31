/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.table('todos', function(table) {
    // 'created_at' sütunundan sonra 'deadline' adında, null olabilen bir tarih sütunu ekle
    table.date('deadline').nullable().after('status');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.table('todos', function(table) {
    // Geri alma işleminde bu sütunu kaldır
    table.dropColumn('deadline');
  });
};