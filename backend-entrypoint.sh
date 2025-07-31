#!/bin/sh

# Veritabanının bağlantıları kabul etmesini bekle
echo "Waiting for database..."
while ! nc -z database 3306; do
  sleep 1
done
echo "Database started"

# Migration'ları ve seed'leri çalıştır
# Bu, veritabanı her boş olduğunda tabloları ve başlangıç verilerini oluşturur
echo "Running migrations and seeds..."
npx knex migrate:latest
npx knex seed:run

# Ana komutu çalıştır (yani, sunucuyu başlat)
exec "$@"