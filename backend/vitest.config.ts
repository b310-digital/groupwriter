import { configDefaults, defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    mockReset: true,
    exclude: [...configDefaults.exclude, "**/dist/**"],
  },
  resolve: {
    alias: [
      {
        find: /^(\.\.?\/)+generated\/prisma$/,
        replacement: path.resolve(__dirname, "generated/prisma/client.ts"),
      },
    ],
  },
});
