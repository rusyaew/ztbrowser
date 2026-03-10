FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY exampleserver.ts ./
COPY demo-pki ./demo-pki
EXPOSE 8080
CMD ["npm", "start"]
