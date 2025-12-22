import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL") ?? "postgresql://test-placeholder:test-placeholder@localhost:5432/test-placeholder",
  },
});
