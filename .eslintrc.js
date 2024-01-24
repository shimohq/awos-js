/* eslint-env node */
module.exports = {
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', "prettier"],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  root: true,
  "rules": {
    "no-empty": 0,
    "ordered-imports": 0,
    "object-literal-sort-keys": 0,
    "no-console": 0,
    "no-var-requires": 0,
    "prefer-object-spread": 0,
    "no-shadowed-variable": 0,
    "no-implicit-dependencies": 0,
    "no-submodule-imports": 0,
    "max-classes-per-file": 1,
    "@typescript-eslint/no-var-requires": 0,
    "@typescript-eslint/no-explicit-any": 0,
  }
};
