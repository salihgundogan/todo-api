// backend/src/controllers/todo.controller.js

const fs = require('fs');
const path = require('path');
const util = require('util');
const { pipeline } = require('stream');
const db = require('../config/database');
const trelloService = require('../services/trello.service');
const { todoSchema } = require('../validation/todo.schema');

// stream.pipeline'i Promise tabanlı hale getiriyoruz
const pump = util.promisify(pipeline);

// --- TÜM TODOLARI LİSTELEME (FİLTRELİ VE SAYFALI) ---
const getAllTodos = async (request, reply) => {
    try {
        const { page = 1, pageSize = 5, status, importance, category_id, startDate, endDate } = request.query;
        const query = db('todos').join('categories', 'todos.category_id', '=', 'categories.id');

        if (status) query.where('todos.status', status);
        if (importance) query.where('todos.importance', importance);
        if (category_id) query.where('todos.category_id', category_id);
        if (startDate) query.where('todos.created_at', '>=', startDate);
        if (endDate) query.where('todos.created_at', '<=', `${endDate} 23:59:59`);

        const totalQuery = query.clone();
        const totalResult = await totalQuery.count({ total: '*' }).first();
        const total = parseInt(totalResult.total, 10);

        const offset = (page - 1) * pageSize;
        query
            .select(
                'todos.id', 'todos.title', 'todos.importance', 'todos.status',
                'todos.image_path', 'todos.created_at',
                'categories.name as category_name'
            )
            .limit(pageSize)
            .offset(offset)
            .orderBy('todos.created_at', 'desc');

        const todos = await query;
        reply.send({
            data: todos,
            pagination: {
                total,
                page: parseInt(page, 10),
                pageSize: parseInt(pageSize, 10),
                totalPages: Math.ceil(total / pageSize),
            }
        });
    } catch (error) {
        console.error(error);
        reply.status(500).send({ message: 'Internal Server Error' });
    }
};

// --- YENİ TODO OLUŞTURMA (RESİMLİ) ---
// backend/src/controllers/todo.controller.js

const createTodo = async (request, reply) => {
    // --- DEBUG BAŞLANGIÇ ---
    console.log('--- YENİ TODO İSTEĞİ GELDİ ---');
    console.log('İSTEK HEADERS:', request.headers['content-type']);
    // --- DEBUG BİTİŞ ---

    try {
        const parts = request.parts();
        const body = {};
        let image_path = null;

        for await (const part of parts) {
            // --- DEBUG BAŞLANGIÇ ---
            // Gelen her bir parçayı detaylıca konsola yazdırıyoruz.
            console.log('>> YENİ BİR PART GELDİ:', {
                type: part.type,
                fieldname: part.fieldname,
                filename: part.filename,
                mimetype: part.mimetype,
                value: part.value // Sadece metin alanları için
            });
            // --- DEBUG BİTİŞ ---

            if (part.type === 'file') {
                if (part.mimetype !== 'image/png' && part.mimetype !== 'image/jpeg') {
                    return reply.status(400).send({ message: 'Only .png and .jpeg formats are allowed' });
                }
                const uniqueFilename = `${Date.now()}-${part.filename}`;
                const savePath = path.join(__dirname, '../../uploads', uniqueFilename);
                await pump(part.file, fs.createWriteStream(savePath));
                image_path = uniqueFilename;
            } else {
                body[part.fieldname] = part.value;
            }
        }

        // --- DEBUG BAŞLANGIÇ ---
        console.log('--- DÖNGÜ BİTTİ, OLUŞTURULAN BODY: ---', body);
        // --- DEBUG BİTİŞ ---

        if (body.category_id) {
            body.category_id = parseInt(body.category_id, 10);
        }

        const validationResult = todoSchema.safeParse(body);
        if (!validationResult.success) {
            console.log('--- ZOD HATASI, BODY:', body); // Zod'a giden veriyi görelim
            return reply.status(400).send(validationResult.error.format());
        }
        const { title, category_id, importance } = validationResult.data;

        const [newTodoId] = await db('todos').insert({ title, category_id, importance, image_path });
        const newTodo = await db('todos').where({ id: newTodoId }).first();

        const trelloCardId = await trelloService.createTrelloCard(newTodo);
        if (trelloCardId) {
            await db('todos').where({ id: newTodoId }).update({ trello_card_id: trelloCardId });
            newTodo.trello_card_id = trelloCardId;

            // --- YENİ EKLENEN KISIM BAŞLANGIÇ ---
            // Eğer bir resim yüklendiyse, onun URL'ini Trello'ya eklenti olarak gönder
            if (image_path) {
                // .env dosyasındaki temel adresi ve resim adını birleştirerek tam bir URL oluştur
                const imageUrl = `${process.env.APP_BASE_URL}/uploads/${image_path}`;
                await trelloService.addAttachmentToCard(trelloCardId, imageUrl);
            }
            // --- YENİ EKLENEN KISIM BİTİŞ ---
        }


        reply.status(201).send(newTodo);
    } catch (error) {
        console.error(error);
        reply.status(500).send({ message: 'Internal Server Error' });
    }
};

// --- TODO GÜNCELLEME ---
const updateTodo = async (request, reply) => {
    try {
        const validationResult = todoSchema.safeParse(request.body);
        if (!validationResult.success) {
            return reply.status(400).send(validationResult.error.format());
        }

        const { id } = request.params;
        const { title, category_id, importance } = validationResult.data;

        const updatedCount = await db('todos').where({ id }).update({ title, category_id, importance, updated_at: new Date() });
        if (updatedCount === 0) {
            return reply.status(404).send({ message: 'Todo not found' });
        }

        const updatedTodo = await db('todos').where({ id }).first();
        if (updatedTodo.trello_card_id) {
            await trelloService.updateTrelloCard(updatedTodo.trello_card_id, updatedTodo);
        }

        reply.send(updatedTodo);
    } catch (error) {
        console.error(error);
        reply.status(500).send({ message: 'Internal Server Error' });
    }
};

// --- TODO SİLME ---
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

// --- TODO DURUM GÜNCELLEME ---
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

// --- TODO ÖNEM DERECESİ GÜNCELLEME ---
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

// Tüm fonksiyonları export et
module.exports = {
    getAllTodos,
    createTodo,
    updateTodo,
    deleteTodo,
    updateTodoStatus,
    updateTodoImportance,
};