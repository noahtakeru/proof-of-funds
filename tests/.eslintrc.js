module.exports = {
  extends: ['../.eslintrc.js'],
  env: {
    jest: true,
    node: true,
  },
  rules: {
    // Allow more lenient rules for tests
    'no-console': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-require-imports': 'off',
  },
};