// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
    rules: {
      // Screens load persisted SQLite data when they mount or regain focus.
      "react-hooks/set-state-in-effect": "off",
    },
  }
]);
