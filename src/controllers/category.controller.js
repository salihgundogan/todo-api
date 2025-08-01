const db = require('../config/database');
const getAllCategories = async (request, reply) => {
    try {
        const categories = await db('categories').select('*');
        reply.send(categories);
    } catch (error) {
        console.error(error);
        reply.status(500).send({ message: 'Internal Server Error' });
    }
};

module.exports = {
    getAllCategories,
};