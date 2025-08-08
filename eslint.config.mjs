import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      "src/generated/**",
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "src/generated/prisma/**",
      ".env",
      ".env.local",
      ".env.development.local",
      ".env.test.local",
      ".env.production.local",
      "npm-debug.log*",
      "yarn-debug.log*",
      "yarn-error.log*",
      "pids",
      "*.pid",
      "*.seed",
      "*.pid.lock",
      "coverage/**",
      ".nyc_output/**",
      ".npm",
      ".node_repl_history",
      "*.tgz",
      ".yarn-integrity",
      ".cache",
      ".parcel-cache",
      ".nuxt/**",
      ".vuepress/dist/**",
      ".serverless/**",
      ".fusebox/**",
      ".dynamodb/**",
      ".tern-port",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
