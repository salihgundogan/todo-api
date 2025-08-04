require('dotenv').config();
const path = require('path');
const fastify = require('fastify')({ logger: true });

fastify.register(require('@fastify/cors'), {
    origin: 'http://localhost:8080', 
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], 
});
fastify.register(require('@fastify/multipart'));
fastify.register(require('@fastify/static'), {
    root: path.join(__dirname, 'uploads'),
    prefix: '/uploads/',
});

const categoryRoutes = require('./src/routes/category.routes');
const todoRoutes = require('./src/routes/todo.routes');

fastify.register(categoryRoutes, { prefix: '/api' });
fastify.register(todoRoutes, { prefix: '/api' });

fastify.get('/', async (request, reply) => {
    return { status: 'ok', message: 'API is running' };
});

const start = async () => {
    try {
        const port = process.env.PORT || 3000;
        await fastify.listen({ port: port, host: '0.0.0.0' });
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();