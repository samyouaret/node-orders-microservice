FROM node:18-alpine

WORKDIR /app

COPY package*.json .

COPY yarn.lock .

COPY . .

RUN yarn install --only=production

RUN chmod +x start.sh

CMD [ "./start.sh" ]
