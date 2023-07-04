### Build image with

`docker build -t holvi-db .`

### Start container with

`docker run -d --name holvi-db -p 5432:5432 -v holvi-data:/var/lib/postgresql/data -e POSTGRES_PASSWORD=<db password> holvi-db`
