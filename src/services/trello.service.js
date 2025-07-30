// backend/src/services/trello.service.js

const axios = require('axios');

const TRELLO_API_URL = 'https://api.trello.com/1';

// .env dosyasından alınan Trello kimlik bilgileri
const authParams = {
    key: process.env.TRELLO_API_KEY,
    token: process.env.TRELLO_API_TOKEN,
};

// Trello'da yeni bir kart oluşturan fonksiyon
const createTrelloCard = async (todo) => {
    try {
        const response = await axios.post(`${TRELLO_API_URL}/cards`, {
            idList: process.env.TRELLO_LIST_ID, // Kartın ekleneceği liste
            name: todo.title, // Kartın başlığı
            desc: `Önem Derecesi: ${todo.importance}`, // Kartın açıklaması
            ...authParams,
        });
        return response.data.id; // Oluşturulan kartın ID'sini geri dön
    } catch (error) {
        console.error('Trello card could not be created:', error.response.data);
        return null;
    }
};

// Trello'daki bir kartı güncelleyen fonksiyon
const updateTrelloCard = async (cardId, todo) => {
    try {
        await axios.put(`${TRELLO_API_URL}/cards/${cardId}`, {
            name: todo.title,
            desc: `Önem Derecesi: ${todo.importance}\nDurum: ${todo.status}`,
            ...authParams,
        });
    } catch (error) {
        console.error('Trello card could not be updated:', error.response.data);
    }
};

// Trello'daki bir kartı silen fonksiyon
const deleteTrelloCard = async (cardId) => {
    try {
        await axios.delete(`${TRELLO_API_URL}/cards/${cardId}`, {
            params: authParams,
        });
    } catch (error) {
        console.error('Trello card could not be deleted:', error.response.data);
    }
};

module.exports = {
    createTrelloCard,
    updateTrelloCard,
    deleteTrelloCard,
};