/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Önce mevcut tüm kategorileri silerek her çalıştırmada temiz bir başlangıç yaparız.
  await knex('categories').del();
  
  // Yeni kategorileri ekliyoruz.
  await knex('categories').insert([
    { name: 'Genel' },
    { name: 'İş' },
    { name: 'Okul' },
    { name: 'Faturalar' },
    { name: 'Kişisel Gelişim' }
  ]);
};