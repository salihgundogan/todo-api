/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    // Önce 'categories' tablosunu oluşturuyoruz çünkü 'todos' tablosu ona bağımlı olacak.
    return knex.schema.createTable('categories', function (table) {
        table.increments('id').primary(); // Otomatik artan birincil anahtar (ID)
        table.string('name', 255).notNullable().unique(); // Kategori adı, boş olamaz ve benzersiz olmalı
    })
        .then(() => {
            // 'categories' tablosu oluştuktan sonra 'todos' tablosunu oluşturuyoruz.
            return knex.schema.createTable('todos', function (table) {
                table.increments('id').primary(); // Otomatik artan birincil anahtar (ID)
                table.string('title', 100).notNullable(); // Todo başlığı, en fazla 100 karakter

                // Kategoriye olan bağlantı (Foreign Key)
                table.integer('category_id').unsigned().references('id').inTable('categories').onDelete('SET NULL');
                // unsigned() -> Pozitif tam sayı olmalı. onDelete('SET NULL') -> Kategori silinirse bu todo'nun kategorisi null olur.

                table.enu('importance', ['düşük', 'orta', 'yüksek']).notNullable().defaultTo('orta'); // Önem derecesi
                table.enu('status', ['aktif', 'tamamlandı']).notNullable().defaultTo('aktif'); // Durum

                table.string('image_path', 255).nullable(); // Resim dosya yolu, boş olabilir
                table.string('trello_card_id', 255).nullable(); // Trello kart ID'si, boş olabilir

                table.timestamps(true, true); // created_at ve updated_at sütunlarını otomatik oluşturur
            });
        });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    // 'down' fonksiyonu, 'up' fonksiyonunun yaptığının tam tersini yapmalı.
    // Tabloları silerken, bağımlı olan tabloyu ('todos') önce silmeliyiz.
    return knex.schema.dropTableIfExists('todos')
        .then(() => {
            return knex.schema.dropTableIfExists('categories');
        });
};