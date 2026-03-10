FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
RUN npm install tsx
COPY server.ts ./
COPY facts-db.json ./
ENV FACTS_DB_PATH=/app/facts-db.json
EXPOSE 7777
CMD ["npx", "tsx", "server.ts"]
