exports.seed = async function(knex) {
  await knex('categories').del();
  
  await knex('categories').insert([
    { name: 'Genel' },
    { name: 'İş' },
    { name: 'Okul' },
    { name: 'Faturalar' },
    { name: 'Kişisel Gelişim' }
  ]);
};