const axios = require('axios');

const TRELLO_API_URL = 'https://api.trello.com/1';

const authParams = {
    key: process.env.TRELLO_API_KEY,
    token: process.env.TRELLO_API_TOKEN,
};

const createTrelloCard = async (todo) => {
    const requestData = {
        idList: process.env.TRELLO_LIST_ID, // Kartın ekleneceği liste
        name: todo.title, // Kartın başlığı
        desc: `Önem Derecesi: ${todo.importance}`, // Kartın açıklaması
        ...authParams,
    };

    console.log('[Trello Service] Creating card with data:', requestData);

    try {
        const response = await axios.post(`${TRELLO_API_URL}/cards`, requestData);
        console.log('[Trello Service] Card created successfully. Card ID:', response.data.id);
        return response.data.id;
    } catch (error) {
        console.error('Trello card could not be created. Full Error:', error);
        return null;
    }
};

const updateTrelloCard = async (cardId, todo) => {
    const requestData = {
        name: todo.title,
        desc: `Önem Derecesi: ${todo.importance}\nDurum: ${todo.status}`,
        ...authParams,
    };

    console.log(`[Trello Service] Updating card ${cardId} with data:`, requestData);

    try {
        await axios.put(`${TRELLO_API_URL}/cards/${cardId}`, requestData);
        console.log(`[Trello Service] Card ${cardId} updated successfully.`);
    } catch (error) {
        console.error(`Trello card ${cardId} could not be updated. Full Error:`, error);
    }
};

const deleteTrelloCard = async (cardId) => {
    console.log(`[Trello Service] Deleting card ${cardId}`);
    try {
        await axios.delete(`${TRELLO_API_URL}/cards/${cardId}`, {
            params: authParams,
        });
        console.log(`[Trello Service] Card ${cardId} deleted successfully.`);
    } catch (error) {
        console.error(`Trello card ${cardId} could not be deleted. Full Error:`, error);
    }
};

const addAttachmentToCard = async (cardId, imageUrl) => {
    const requestData = {
        url: imageUrl,
        ...authParams,
    };
    console.log(`[Trello Service] Adding attachment to card ${cardId} with URL:`, imageUrl);
    try {
        await axios.post(`${TRELLO_API_URL}/cards/${cardId}/attachments`, requestData);
        console.log(`[Trello Service] Attachment added to card ${cardId} successfully.`);
    } catch (error) {
        console.error(`Could not add attachment to Trello card ${cardId}. Full Error:`, error);
    }
};

module.exports = {
    createTrelloCard,
    updateTrelloCard,
    deleteTrelloCard,
    addAttachmentToCard,
};