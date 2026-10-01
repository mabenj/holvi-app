# Pinned to one Node major: new Node releases break native modules such as
# sharp and bcrypt
FROM node:24

WORKDIR /app

COPY package.json ./

COPY yarn.lock ./

RUN yarn install

COPY . .

EXPOSE 3000

RUN yarn build

CMD ["yarn", "start"]
