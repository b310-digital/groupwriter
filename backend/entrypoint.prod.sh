#!/bin/sh

echo "Creating the schema..."
npx prisma migrate deploy --config dist/prisma.config.js

echo "Starting the application..."
npm run start:prod