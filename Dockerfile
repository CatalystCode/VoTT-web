FROM node:8.9.3-alpine
LABEL maintainer="raweil@microsoft.com"

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8080
CMD [ "node", "app.js" ]
