exports.up = function(knex) {
  return knex.schema.alterTable('todos', function(table) {
    // deadline sütununun tipini DATE'den DATETIME'a çevir
    table.dateTime('deadline').nullable().alter();
    // status sütununa 'süresi geçti' seçeneğini ekle
    table.enum('status', ['aktif', 'tamamlandı', 'süresi geçti'], { useNative: true, enumName: 'status_type' })
         .notNullable()
         .defaultTo('aktif')
         .alter();
  });
};

exports.down = function(knex) {
  // Değişiklikleri geri al
  return knex.schema.alterTable('todos', function(table) {
    table.date('deadline').nullable().alter();
    table.enum('status', ['aktif', 'tamamlandı'], { useNative: true, enumName: 'status_type' })
         .notNullable()
         .defaultTo('aktif')
         .alter();
  });
};