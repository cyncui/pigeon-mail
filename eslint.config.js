// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    rules: {
      // Reanimated shared values are mutated via `.value` by design; the
      // compiler-era immutability rule has no model for them and flags every
      // animation in this gesture-heavy app.
      "react-hooks/immutability": "off",
      // Worklets and PanResponder callbacks read shared values / refs at
      // event time, not during render — every hit of this rule here is that
      // false positive.
      "react-hooks/refs": "off",
    },
  },
]);
