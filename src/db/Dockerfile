FROM postgres:latest

ENV POSTGRES_USER=admin
ENV POSTGRES_DB=holvi

RUN echo "create extension if not exists citext;" > /docker-entrypoint-initdb.d/init.sql

EXPOSE 5432