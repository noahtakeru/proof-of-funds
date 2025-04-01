module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: {
        node: 'current',
      },
    }],
  ],
  // Allow ES modules to be processed correctly
  plugins: [
    // Add any Babel plugins here if needed
  ],
};