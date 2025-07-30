
// backend/src/config/database.js

const knex = require('knex');
const knexConfig = require('../../knexfile'); // Proje kök dizinindeki knexfile.js'i gösteriyoruz

// Knex'i geliştirme (development) ortamı ayarlarıyla başlatıyoruz
const db = knex(knexConfig.development);

module.exports = db;