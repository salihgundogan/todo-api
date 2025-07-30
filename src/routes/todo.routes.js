// backend/src/routes/todo.routes.js

const todoController = require('../controllers/todo.controller');

async function routes(fastify, options) {
    fastify.get('/todos', todoController.getAllTodos);
    fastify.post('/todos', todoController.createTodo);
    fastify.delete('/todos/:id', todoController.deleteTodo);
    fastify.put('/todos/:id', todoController.updateTodo);
    fastify.patch('/todos/:id/status', todoController.updateTodoStatus);
    fastify.patch('/todos/:id/importance', todoController.updateTodoImportance);

}

module.exports = routes;