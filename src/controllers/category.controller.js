// backend/src/controllers/category.controller.js

const db = require('../config/database'); // 1. adımda oluşturduğumuz db bağlantısı

// Tüm kategorileri getiren asenkron fonksiyon
const getAllCategories = async (request, reply) => {
    try {
        // Veritabanındaki 'categories' tablosundan tüm verileri ('*') seç
        const categories = await db('categories').select('*');
        // Başarılı olursa, kategorileri JSON olarak gönder
        reply.send(categories);
    } catch (error) {
        // Bir hata olursa, hatayı logla ve 500 (Sunucu Hatası) koduyla bir hata mesajı gönder
        console.error(error);
        reply.status(500).send({ message: 'Internal Server Error' });
    }
};

// Fonksiyonu dışa aktararak başka dosyalarda kullanılabilir yap
module.exports = {
    getAllCategories,
};