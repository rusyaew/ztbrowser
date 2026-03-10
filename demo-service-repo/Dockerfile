FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
RUN npm install tsx
COPY exampleserver.ts ./
COPY demo-pki ./demo-pki
ENV DEMO_ROOT_CERT_PATH=/app/demo-pki/root-cert.pem
ENV DEMO_LEAF_CERT_PATH=/app/demo-pki/leaf-cert.pem
ENV DEMO_LEAF_KEY_PATH=/app/demo-pki/leaf-key.pem
EXPOSE 8080
CMD ["npx", "tsx", "exampleserver.ts"]
