FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

RUN mkdir -p uploads logs

EXPOSE 3000

USER node

CMD ["npm", "start"]