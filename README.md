# Holvi app

## Deploy Docker

Adjust `docker-compose.yml` as desired and run:

```bash
docker-compose up -d
```

## Development

### Setup database

Setup database by building and spawning a database container.

```bash
docker build -t holvi-db-dev ./src/db
```

```bash
docker run -d --name holvi-db-dev -p 5432:5432 -v holvi-db-data-dev:/var/lib/postgresql/data -e POSTGRES_USER=admin -e POSTGRES_PASSWORD=<db password> -e POSTGRES_DB=holvi holvi-db-dev
```

### Setup environment variables

Create a `.env.local` file in the root of the project and add the following variables:

`DB_CONNECTION_STRING=postgres://admin:<db_password>@localhost:5432/holvi`

`DATA_DIR=<directory to hold app data>`

`SESSION_PASSWORD=<32 character long session password>`

`GEO_API_KEY=<reverse geocoding API key (https://www.bigdatacloud.com/packages/reverse-geocoding)>`

### Install dependencies

```bash
yarn install
# or
npm install
```

### Start dev server

```bash
yarn dev
# or
npm dev
```

### Open browser

Open [http://localhost:3000](http://localhost:3000) and start coding.
