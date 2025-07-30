const db = require('../config/database');
const trelloService = require('../services/trello.service');
const { todoSchema } = require('../validation/todo.schema');
const fs = require('fs');
const path = require('path');
const util = require('util');
const { pipeline } = require('stream');
const pump = util.promisify(pipeline);

const getAllTodos = async (request, reply) => {
    try {
        // 1. Sayfalama ve Filtre Parametrelerini al
        const {
            page = 1, pageSize = 5, status, importance, category_id, startDate, endDate
        } = request.query;

        // 2. Temel Sorguyu Oluştur (HENÜZ SELECT YOK)
        const query = db('todos')
            .join('categories', 'todos.category_id', '=', 'categories.id');

        // 3. Filtreleri Sorguya Ekle
        if (status) {
            query.where('todos.status', status);
        }
        if (importance) {
            query.where('todos.importance', importance);
        }
        if (category_id) {
            query.where('todos.category_id', category_id);
        }
        if (startDate) {
            query.where('todos.created_at', '>=', startDate);
        }
        if (endDate) {
            query.where('todos.created_at', '<=', `${endDate} 23:59:59`);
        }

        // 4. Toplam Kayıt Sayısını Al (Filtrelenmiş)
        // Sorgunun bu aşamasında (filtreler eklenmiş ama select ve sayfalama yok) bir klon alıp sayma işlemi yapıyoruz.
        const totalQuery = query.clone();
        const totalResult = await totalQuery.count({ total: '*' }).first();
        const total = parseInt(totalResult.total, 10);

        // 5. Ana Sorguya Şimdi SELECT, Sıralama ve Sayfalama Ekle
        const offset = (page - 1) * pageSize;
        query
            .select(
                'todos.id',
                'todos.title',
                'todos.importance',
                'todos.status',
                'todos.created_at',
                'categories.name as category_name'
            )
            .limit(pageSize)
            .offset(offset)
            .orderBy('todos.created_at', 'desc');

        // 6. Ana Sorguyu Çalıştır
        const todos = await query;

        // 7. Sonuçları Döndür
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
        // Hatayı logla ve kullanıcıya genel bir hata mesajı göster
        console.error(error); // Hatanın tamamını konsolda görmek için
        reply.status(500).send({ message: 'Internal Server Error' });
    }
};


// backend/src/controllers/todo.controller.js
// backend/src/controllers/todo.controller.js

const createTodo = async (request, reply) => {
    try {
        const parts = request.parts(); // Gelen isteğin parçalarını bir iterator olarak al
        const body = {}; // Metin alanlarını toplamak için boş bir obje
        let image_path = null; // Resim yolunu saklamak için boş bir değişken

        // Gelen isteğin tüm parçaları üzerinde döngüye gir
        for await (const part of parts) {
            if (part.type === 'file') {
                // EĞER PARÇA BİR DOSYA İSE:
                // Basit dosya tipi kontrolü
                if (part.mimetype !== 'image/png' && part.mimetype !== 'image/jpeg') {
                    return reply.status(400).send({ message: 'Only .png and .jpeg formats are allowed' });
                }

                const uniqueFilename = `${Date.now()}-${part.filename}`;
                const savePath = path.join(__dirname, '../../uploads', uniqueFilename);
                await pump(part.file, fs.createWriteStream(savePath));
                image_path = uniqueFilename; // Dosya adını değişkene ata
            } else {
                // EĞER PARÇA BİR METİN ALANI İSE:
                // Alanın adını (key) ve değerini (value) body objesine ekle
                body[part.fieldname] = part.value;
            }
        }

        // Döngü bittikten sonra, metin alanlarını Zod ile doğrula
        // category_id string olarak geleceği için onu sayıya çevirmemiz gerekir
        if (body.category_id) {
            body.category_id = parseInt(body.category_id, 10);
        }

        const validationResult = todoSchema.safeParse(body);
        if (!validationResult.success) {
            return reply.status(400).send(validationResult.error.format());
        }
        const { title, category_id, importance } = validationResult.data;

        // Veritabanına kaydet
        const [newTodoId] = await db('todos').insert({ title, category_id, importance, image_path });
        const newTodo = await db('todos').where({ id: newTodoId }).first();

        // Trello'ya gönder
        const trelloCardId = await trelloService.createTrelloCard(newTodo);
        if (trelloCardId) {
            await db('todos').where({ id: newTodoId }).update({ trello_card_id: trelloCardId });
            newTodo.trello_card_id = trelloCardId;
        }

        reply.status(201).send(newTodo);
    } catch (error) {
        console.error(error);
        reply.status(500).send({ message: 'Internal Server Error' });
    }
};


const deleteTodo = async (request, reply) => {
    try {
        const { id } = request.params;

        // -- TRELLO ENTEGRASYONU BAŞLANGIÇ --
        // Silmeden önce todo'yu bulup Trello kart ID'sini alıyoruz
        const todoToDelete = await db('todos').where({ id }).first();
        if (todoToDelete && todoToDelete.trello_card_id) {
            await trelloService.deleteTrelloCard(todoToDelete.trello_card_id);
        }
        // -- TRELLO ENTEGRASYONU BİTİŞ --

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


// YENİ FONKSİYON
const updateTodo = async (request, reply) => {
    // --- ZOD VALIDATION BAŞLANGIÇ ---
    const validationResult = todoSchema.safeParse(request.body);
    if (!validationResult.success) {
        return reply.status(400).send(validationResult.error.format());
    }
    // --- ZOD VALIDATION BİTİŞ ---

    try {
        const { id } = request.params;
        // Doğrulamadan geçen temiz veriyi kullanıyoruz
        const { title, category_id, importance } = validationResult.data;

        // ... (geri kalan kod aynı)
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


// YENİ FONKSİYON
const updateTodoStatus = async (request, reply) => {
    try {
        const { id } = request.params;
        const { status } = request.body;

        // Sadece 'tamamlandı' durumuna geçişe izin veriyoruz
        if (status !== 'tamamlandı') {
            return reply.status(400).send({ message: "Status can only be updated to 'tamamlandı'" });
        }

        // Önce mevcut todo'yu bulalım
        const currentTodo = await db('todos').where({ id: id }).first();

        if (!currentTodo) {
            return reply.status(404).send({ message: 'Todo not found' });
        }

        // Proje kuralı: Eğer todo zaten 'tamamlandı' ise tekrar değiştirilemez.
        if (currentTodo.status === 'tamamlandı') {
            return reply.status(400).send({ message: 'Completed todo cannot be changed again' });
        }

        // Durumu güncelle
        await db('todos').where({ id: id }).update({
            status: 'tamamlandı',
            updated_at: new Date(),
        });

        // Güncellenmiş todo'yu al ve geri dön
        const updatedTodo = await db('todos').where({ id: id }).first();
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

        // Doğrulama: Gelen önem derecesi beklenen değerlerden biri mi?
        const allowedImportances = ['düşük', 'orta', 'yüksek'];
        if (!importance || !allowedImportances.includes(importance)) {
            return reply.status(400).send({ message: 'Invalid importance value' });
        }

        // Önem derecesini güncelle
        const updatedCount = await db('todos').where({ id: id }).update({
            importance: importance,
            updated_at: new Date(),
        });

        if (updatedCount === 0) {
            return reply.status(404).send({ message: 'Todo not found' });
        }

        // Güncellenmiş todo'yu al ve geri dön
        const updatedTodo = await db('todos').where({ id: id }).first();
        reply.send(updatedTodo);

    } catch (error) {
        console.error(error);
        reply.status(500).send({ message: 'Internal Server Error' });
    }
};

module.exports = {
    getAllTodos,
    createTodo,
    deleteTodo,
    updateTodo,
    updateTodoStatus,
    updateTodoImportance,


};