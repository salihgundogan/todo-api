const fs = require('fs');
const path = require('path');
const util = require('util');
const { pipeline } = require('stream');
const db = require('../config/database');
const trelloService = require('../services/trello.service');
const { todoSchema } = require('../validation/todo.schema');
const { log } = require('console');

const pump = util.promisify(pipeline);


const formatDateTimeForMySQL = (isoDate) => {
    if (!isoDate) {
        return null;
    }
    return new Date(isoDate).toISOString().slice(0, 19).replace('T', ' ');
};

const getAllTodos = async (request, reply) => {
    try {
        const { page = 1, pageSize = 5, status, importance, category_id, startDate, endDate } = request.query;
        const query = db('todos').join('categories', 'todos.category_id', '=', 'categories.id');

        if (status) { query.where('todos.status', status) };
        if (importance) { query.where('todos.importance', importance) };
        if (category_id) { query.where('todos.category_id', category_id) };
        if (startDate) {
            query.whereRaw('DATE(todos.deadline) >= ?', [startDate]);
        }
        if (endDate) {
            query.whereRaw('DATE(todos.deadline) <= ?', [endDate]);
        }

        const totalQuery = query.clone();
        const totalResult = await totalQuery.count({ total: '*' }).first();
        const total = parseInt(totalResult.total, 10);

        const offset = (page - 1) * pageSize;
        query
            .select(
                'todos.id', 'todos.title', 'todos.importance', 'todos.status',
                'todos.deadline', 'todos.image_path', 'todos.created_at',
                'categories.name as category_name'
            )
            .limit(pageSize)
            .offset(offset)
            .orderBy('todos.created_at', 'desc');

        const todos = await query;
        reply.send({
            data: todos,
            pagination: { total, page: parseInt(page, 10), pageSize: parseInt(pageSize, 10), totalPages: Math.ceil(total / pageSize) }
        });
    } catch (error) {
        console.error(error);
        reply.status(500).send({ message: 'Internal Server Error' });
    }
};

const createTodo = async (request, reply) => {
    try {
        const parts = request.parts();
        const body = {};
        let image_path = null;

        for await (const part of parts) {
            if (part.type === 'file') {
                if (part.mimetype !== 'image/png' && part.mimetype !== 'image/jpeg') {
                    return reply.status(400).send({ message: 'Only .png and .jpeg formats are allowed' });
                }
                const uniqueFilename = `${Date.now()}-${part.filename}`;
                const savePath = path.join(__dirname, '../../uploads', uniqueFilename);
                await pump(part.file, fs.createWriteStream(savePath));
                image_path = uniqueFilename;
            } else {
                body[part.fieldname.trim()] = part.value;
            }
        }

        if (body.category_id) { body.category_id = parseInt(body.category_id, 10) };

        const validationResult = todoSchema.safeParse(body);
        if (!validationResult.success) {
            return reply.status(400).send(validationResult.error.format());
        }

        const { title, category_id, importance, deadline } = validationResult.data;

        const trelloCardId = await trelloService.createTrelloCard(validationResult.data);

        if (!trelloCardId) {
            return reply.status(500).send({ message: 'Trello card could not be created.' });
        }

        const newTodoData = {
            title,
            category_id,
            importance,
            image_path,
            deadline: formatDateTimeForMySQL(deadline),
            trello_card_id: trelloCardId
        };

        if (image_path) {
            const imageUrl = `http://localhost:3000/uploads/${image_path}`;
            console.log("[Todo controller] attaching image to trello card ${trelloCardId} with URL: ${imageUrl}");
            await trelloService.addAttachmentToCard(trelloCardId, imageUrl);


        }

        const [newTodoId] = await db('todos').insert(newTodoData);

        console.log(`[Todo Controller] New todo created with DB ID: ${newTodoId}. Trello Card ID received: ${trelloCardId}`);

        const newTodo = await db('todos').where({ id: newTodoId }).first();
        reply.status(201).send(newTodo);

    } catch (error) {
        console.error(error);
        reply.status(500).send({ message: 'Internal Server Error' });
    }
};

const updateTodo = async (request, reply) => {
    try {
        const validationResult = todoSchema.safeParse(request.body);
        if (!validationResult.success) {
            return reply.status(400).send(validationResult.error.format());
        }

        const { id } = request.params;
        const { title, category_id, importance, deadline } = validationResult.data;

        const updatedData = {
            title,
            category_id,
            importance,
            deadline: formatDateTimeForMySQL(deadline),
            updated_at: new Date()
        };

        const updatedCount = await db('todos').where({ id }).update(updatedData);
    } catch (error) {
        console.error(error);
        reply.status(500).send({ message: 'Internal Server Error' });
    }
};

const deleteTodo = async (request, reply) => {
    try {
        const { id } = request.params;
        const todoToDelete = await db('todos').where({ id }).first();

        if (todoToDelete && todoToDelete.trello_card_id) {
            await trelloService.deleteTrelloCard(todoToDelete.trello_card_id);
        }

        const deletedCount = await db('todos').where({ id }).del();
        if (deletedCount === 0) {
            return reply.status(404).send({ message: 'Todo not found' });
        }
        reply.status(204).send();
    } catch (error) {
        console.error(error);
        reply.status(500).send({ message: 'Internal Server Error' });
    }
};

const updateTodoStatus = async (request, reply) => {
    try {
        const { id } = request.params;
        const { status } = request.body;

        if (status !== 'tamamlandı') {
            return reply.status(400).send({ message: "Status can only be updated to 'tamamlandı'" });
        }

        const currentTodo = await db('todos').where({ id }).first();
        if (!currentTodo) {
            return reply.status(404).send({ message: 'Todo not found' });
        }
        if (currentTodo.status === 'tamamlandı') {
            return reply.status(400).send({ message: 'Completed todo cannot be changed again' });
        }

        await db('todos').where({ id }).update({ status: 'tamamlandı', updated_at: new Date() });
        const updatedTodo = await db('todos').where({ id }).first();
        reply.send(updatedTodo);
    } catch (error) {
        console.error(error);
        reply.status(500).send({ message: 'Internal Server Error' });
    }
};

const updateTodoImportance = async (request, reply) => {
    try {
        const { id } = request.params;
        const { importance } = request.body;

        const allowedImportances = ['düşük', 'orta', 'yüksek'];
        if (!importance || !allowedImportances.includes(importance)) {
            return reply.status(400).send({ message: 'Invalid importance value' });
        }

        const updatedCount = await db('todos').where({ id }).update({ importance, updated_at: new Date() });
        if (updatedCount === 0) {
            return reply.status(404).send({ message: 'Todo not found' });
        }

        const updatedTodo = await db('todos').where({ id }).first();
        reply.send(updatedTodo);
    } catch (error) {
        console.error(error);
        reply.status(500).send({ message: 'Internal Server Error' });
    }
};
const getTodoById = async (request, reply) => {
    try {
        const { id } = request.params;
        const todo = await db('todos')
            .join('categories', 'todos.category_id', 'categories.id')
            .select(
                'todos.id', 'todos.title', 'todos.importance', 'todos.status',
                'todos.deadline', 'todos.image_path', 'todos.category_id',
                'categories.name as category_name'
            )
            .where('todos.id', id)
            .first();

        if (!todo) {
            return reply.status(404).send({ message: 'Todo not found' });
        }
        reply.send(todo);
    } catch (error) {
        console.error(error);
        reply.status(500).send({ message: 'Internal Server Error' });
    }
};

module.exports = {
    getAllTodos,
    createTodo,
    updateTodo,
    deleteTodo,
    updateTodoStatus,
    updateTodoImportance,
    getTodoById,
};
