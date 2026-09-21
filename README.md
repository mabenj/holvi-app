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

`HOLVI_DB_CONNECTION_STRING=postgres://admin:<db_password>@localhost:5432/holvi`

`HOLVI_DATA_DIR=<directory to hold app data>`

`HOLVI_BACKUP_DIR=<directory to write backups to (optional, defaults to a backups directory inside HOLVI_DATA_DIR)>`

A backup is a zip holding decrypted copies of every file, so point `HOLVI_BACKUP_DIR` at a separate disk or network mount to keep backups off the data disk; `docker-compose.yml` carries a commented-out `backup-data` volume showing how. Each user keeps only their newest backup, which they can download or delete from the Backups panel.

`HOLVI_SESSION_PASSWORD=<32 character long session password>`

`HOLVI_GEO_API_KEY=<reverse geocoding API key (https://www.bigdatacloud.com/packages/reverse-geocoding)>`

`HOLVI_ENCRYPTION_KEY=<32 character long encryption key>`

`HOLVI_SHUFFLE_PERIOD_MINUTES=<minutes the random order of each user's collections stays the same (optional, defaults to 60)>`

The Collections tab opens in random order. Within one Shuffle period a refresh gives the same order; when the next period starts, the order changes by itself.

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

## Testing

Tests use [Vitest](https://vitest.dev). Integration tests run against a real Postgres database built from the same image as the app database. Start a throwaway test database (its data lives in memory and is lost when the container stops):

```bash
docker build -t holvi-db-dev ./src/db
docker run -d --rm --name holvi-db-test -p 5433:5432 --tmpfs /var/lib/postgresql/data -e POSTGRES_USER=admin -e POSTGRES_PASSWORD=admin -e POSTGRES_DB=holvi_test holvi-db-dev
```

Then run the tests:

```bash
yarn test
# or, re-running on changes
yarn test:watch
```

The tests connect to `postgres://admin:admin@localhost:5433/holvi_test` by default. Set `HOLVI_TEST_DB_CONNECTION_STRING` to use a different database; its name must end with `test`, because the tests delete all of its data. The data directory, backup directory and encryption key are pointed at temporary values for each test file (see `test/setup-env.ts`), so `.env.local` is not used.
