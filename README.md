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

`HOLVI_SHUFFLE_PERIOD_MINUTES=<minutes the random order of each user's collections, and each collection's rotating cover, stay the same (optional, defaults to 60)>`

`HOLVI_RENDITION_MAX_BITRATE_KBPS=<highest bitrate, in kbit/s, of the web-playable Rendition made for a video the browser may not play, such as HEVC (optional, defaults to 10000)>`

Video processing gives every video whose original is not web-safe (H.264 with AAC or no audio, in MP4) an encrypted Rendition stored next to the original, which is never modified. It runs in the background, one video at a time: new uploads are processed automatically, and existing videos when their user chooses "Process videos" in Settings. Backups contain originals only.

The Collections tab opens in random order. Within one Shuffle period a refresh gives the same order; when the next period starts, the order changes by itself. So does the cover of every collection whose cover the user has not chosen: each period it shows another of the collection's files, and every file gets a turn before any repeats.

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

## Demo environment

A local, production-built Holvi for trying out features with known data. It builds the app from the current working tree, uncommitted changes included, and runs it in Docker with its own database and data. The first time, it seeds the demo with sample data and checks the seed through the app's API. Needs Docker with Docker Compose; on Windows, run it from Git Bash.

```bash
./demo.sh up           # build, start, seed if empty, open the browser
./demo.sh up --no-open # the same without opening the browser
./demo.sh down         # stop the demo and keep its data
./demo.sh reset        # stop the demo and delete its data; the next up seeds again
./demo.sh logs         # follow the app's logs
```

- The app runs at [http://localhost:7100](http://localhost:7100). Sign in as `demo` / `demo1234`, who owns the sample collections, or as `other` / `other1234`, a second User.
- Its database is on `127.0.0.1:5434` (user `holvi`, password `holvi-demo`, database `holvi_demo`), reachable from this machine only.
- It runs under its own Compose project, `holvi-demo`, from `demo/docker-compose.yml`, so it can run next to `yarn dev` and the deploy `docker-compose.yml` without touching their containers, volumes or data. It doesn't read `.env.local`; its session password and encryption key are fixed, committed and not secret.
- `up` seeds only an empty demo, so what you change while testing survives `down` and later `up`s, including on other branches, whose database upgrades then run against the existing demo data. If seeding or its checks fail, `up` says the demo is not ready and exits non-zero without opening the browser. Run `reset` and then `up` to seed it again from scratch; until then, `up` keeps failing on the half-seeded demo, which it recognises by `demo` lacking the last collection the seed creates (for now, "Evening by the sea"). Renaming or deleting that collection has the same effect. Only `reset` deletes demo data.
- The Shuffle period is 1 minute, so the random collection order and Rotating covers change during one session. Override it for one run with `HOLVI_SHUFFLE_PERIOD_MINUTES=60 ./demo.sh up`.
- For place names on files with GPS, put a reverse geocoding key in `demo/.env.local` (git-ignored) as `HOLVI_GEO_API_KEY=<key>`. Without it the demo still starts; those files just have no place name.
