module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: {
        node: 'current',
      },
    }],
  ],
  plugins: [
    // Support ES modules
    ['@babel/plugin-transform-modules-commonjs', {
      allowTopLevelThis: true,
    }],
  ],
};