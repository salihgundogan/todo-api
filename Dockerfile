FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

# Yeni başlangıç script'ini kopyala ve çalıştırılabilir yap
COPY backend-entrypoint.sh /usr/src/app/backend-entrypoint.sh
RUN chmod +x /usr/src/app/backend-entrypoint.sh

EXPOSE 3000

# Konteyner başladığında önce script'i, sonra server.js'i çalıştır
ENTRYPOINT ["/usr/src/app/backend-entrypoint.sh"]
CMD [ "node", "server.js" ]