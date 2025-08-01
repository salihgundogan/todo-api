const categoryController = require('../controllers/category.controller');

async function routes(fastify, options) {
    fastify.get('/categories', categoryController.getAllCategories);
}

module.exports = routes;