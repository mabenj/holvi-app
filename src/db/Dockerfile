FROM postgres:latest

RUN echo "create extension if not exists citext;" > /docker-entrypoint-initdb.d/init.sql

EXPOSE 5432