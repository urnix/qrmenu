FROM node:18-alpine
RUN apk --no-cache add imagemagick graphicsmagick
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3001
CMD ["node", "server.js"]
