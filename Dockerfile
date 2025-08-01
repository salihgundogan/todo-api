FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

COPY backend-entrypoint.sh /usr/src/app/backend-entrypoint.sh
RUN chmod +x /usr/src/app/backend-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/usr/src/app/backend-entrypoint.sh"]
CMD [ "node", "server.js" ]