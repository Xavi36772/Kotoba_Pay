FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY src/ ./src/
RUN npm ci && npm run build

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist/ ./dist/
EXPOSE 5002
CMD ["node", "dist/index.js"]
