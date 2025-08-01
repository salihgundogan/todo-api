
exports.up = function (knex) {
    return knex.schema.createTable('categories', function (table) {
        table.increments('id').primary();
        table.string('name', 255).notNullable().unique();
    })
        .then(() => {
            return knex.schema.createTable('todos', function (table) {
                table.increments('id').primary();
                table.string('title', 100).notNullable();

                table.integer('category_id').unsigned().references('id').inTable('categories').onDelete('SET NULL');

                table.enu('importance', ['düşük', 'orta', 'yüksek']).notNullable().defaultTo('orta');
                table.enu('status', ['aktif', 'tamamlandı']).notNullable().defaultTo('aktif');

                table.string('image_path', 255).nullable();
                table.string('trello_card_id', 255).nullable();

                table.timestamps(true, true);
            });
        });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('todos')
        .then(() => {
            return knex.schema.dropTableIfExists('categories');
        });
};