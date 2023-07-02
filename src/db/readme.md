### Build image with

`docker build -t homework-db .`

### Start container with

`docker run -d --name homework-db -p 5432:5432 -v homework-data:/var/lib/postgresql/data -e POSTGRES_PASSWORD=<db password> homework-db`
