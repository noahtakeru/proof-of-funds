/**
 * Babel configuration for frontend tests
 */
module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: {
        node: 'current'
      }
    }],
    '@babel/preset-typescript'
  ],
  plugins: []
};