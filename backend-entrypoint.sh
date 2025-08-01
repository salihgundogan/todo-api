#!/bin/sh

echo "Waiting for database..."
while ! nc -z database 3306; do
  sleep 1
done
echo "Database started"

echo "Running migrations and seeds..."
npx knex migrate:latest
npx knex seed:run

exec "$@"