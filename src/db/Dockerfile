FROM postgres:15

RUN echo "create extension if not exists citext;" > /docker-entrypoint-initdb.d/init.sql

EXPOSE 5432