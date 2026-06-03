FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY public ./public

RUN mkdir -p /data

ENV NODE_ENV=production
ENV DATA_DIR=/data
EXPOSE 3000

CMD ["npm", "start"]
