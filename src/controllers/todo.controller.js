const fs = require('fs');
const path = require('path');
const util = require('util');
const { pipeline } = require('stream');
const db = require('../config/database');
const trelloService = require('../services/trello.service');
const { todoSchema } = require('../validation/todo.schema');

const pump = util.promisify(pipeline);

// --- TÜM TODOLARI LİSTELEME ---
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

        if (body.category_id) body.category_id = parseInt(body.category_id, 10);

        const validationResult = todoSchema.safeParse(body);
        if (!validationResult.success) {
            return reply.status(400).send(validationResult.error.format());
        }

        // --- DEĞİŞİKLİK BURADA ---
        // Tarihi new Date() objesine çevirmeden, metin olarak alıyoruz.
        const { title, category_id, importance, deadline } = validationResult.data;

        const newTodoData = {
            title,
            category_id,
            importance,
            image_path,
            // Tarihi olduğu gibi (string) veya null olarak ata.
            deadline: deadline || null
        };

        const [newTodoId] = await db('todos').insert(newTodoData);
        // ... (fonksiyonun geri kalanı aynı)
    } catch (error) {
        console.error(error);
        reply.status(500).send({ message: 'Internal Server Error' });
    }
};

// updateTodo fonksiyonunu aşağıdakiyle değiştirin
const updateTodo = async (request, reply) => {
    try {
        const validationResult = todoSchema.safeParse(request.body);
        if (!validationResult.success) {
            return reply.status(400).send(validationResult.error.format());
        }

        const { id } = request.params;
        const { title, category_id, importance, deadline } = validationResult.data;

        // --- DEĞİŞİKLİK BURADA ---
        const updatedData = {
            title,
            category_id,
            importance,
            // Tarihi olduğu gibi (string) veya null olarak ata.
            deadline: deadline || null,
            updated_at: new Date()
        };

        const updatedCount = await db('todos').where({ id }).update(updatedData);
        // ... (fonksiyonun geri kalanı aynı)
    } catch (error) {
        console.error(error);
        reply.status(500).send({ message: 'Internal Server Error' });
    }
};



// --- TODO SİLME (SİL BUTONU İÇİN) ---
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

// --- TODO DURUM GÜNCELLEME (TAMAMLA BUTONU İÇİN) ---
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
        // KURAL GÜNCELLEMESİ: Zaten tamamlanmış bir todo değiştirilemez.
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

// --- TODO ÖNEM DERECESİ GÜNCELLEME (SELECT BOX İÇİN) ---
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
            .first(); // .first() -> Sadece bir sonuç döneceğini belirtir

        if (!todo) {
            return reply.status(404).send({ message: 'Todo not found' });
        }
        reply.send(todo);
    } catch (error) {
        console.error(error);
        reply.status(500).send({ message: 'Internal Server Error' });
    }
};

// Tüm fonksiyonları export et
module.exports = {
    getAllTodos,
    createTodo,
    updateTodo,
    deleteTodo,
    updateTodoStatus,
    updateTodoImportance,
    getTodoById,

};
