import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const config = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    // eslint-plugin-react's auto-detection uses context.getFilename(), removed in ESLint 10.
    // Pinning the version skips that code path.
    settings: { react: { version: "19.3.0" } },
    rules: {
      "react/no-danger": "error",
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "src/generated/**", "playwright-report/**"],
  },
];

export default config;
