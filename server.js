// .env dosyasındaki değişkenleri projemize yüklemek için
require('dotenv').config();
const path = require('path');
const fastify = require('fastify')({ logger: true });

fastify.register(require('@fastify/multipart'), { attachFieldsToBody: true });

fastify.register(require('@fastify/static'), {
    root: path.join(__dirname, 'uploads'),
    prefix: '/uploads/',
});

const categoryRoutes = require('./src/routes/category.routes');
const todoRoutes = require('./src/routes/todo.routes');


// Kategori rotalarını /api ön ekiyle kaydet
fastify.register(categoryRoutes, { prefix: '/api' });
// Todo rotalarını /api ön ekiyle kaydet
fastify.register(todoRoutes, { prefix: '/api' });

// Basit bir test rotası (route) oluşturuyoruz
// Sunucunun çalışıp çalışmadığını kontrol etmek için
fastify.get('/', async (request, reply) => {
    return { hello: 'world' };
});




const start = async () => {
    try {
        // Sunucuyu .env dosyasındaki portta veya varsayılan olarak 3000 portunda dinlemeye başla
        const port = process.env.PORT || 3000;
        await fastify.listen({ port: port, host: '0.0.0.0' });
        fastify.log.info(`Sunucu ${fastify.server.address().port} portunda calisiyor`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

// Sunucuyu başlat
start();