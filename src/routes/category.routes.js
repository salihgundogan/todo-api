// backend/src/routes/category.routes.js

const categoryController = require('../controllers/category.controller');

async function routes(fastify, options) {
    // GET isteği /categories adresine geldiğinde
    // categoryController'daki getAllCategories fonksiyonunu çalıştır
    fastify.get('/categories', categoryController.getAllCategories);
}

module.exports = routes;