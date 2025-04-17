module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: {
        node: 'current',
      },
      modules: 'auto'
    }],
    '@babel/preset-typescript',
  ],
  plugins: [
    // This allows us to use import.meta.url in CommonJS
    function () {
      return {
        visitor: {
          MetaProperty(path) {
            if (path.node.meta.name === 'import' && path.node.property.name === 'meta') {
              path.replaceWithSourceString('({ url: "file://" + __filename })');
            }
          }
        }
      };
    },
  ],
  // Add support for ES modules
  overrides: [
    {
      test: ["**/*.mjs"],
      plugins: [
        // Help with ESM/CJS interop
        ["@babel/plugin-transform-modules-commonjs", { 
          allowTopLevelThis: true,
          loose: true,
          strict: false
        }]
      ],
      presets: [
        ['@babel/preset-env', {
          targets: { node: 'current' },
          modules: false // Preserve ESM syntax
        }]
      ]
    },
    {
      test: ["**/*.js"],
      plugins: [],
      presets: [
        ['@babel/preset-env', {
          targets: { node: 'current' },
          modules: 'auto' // Auto-detect module type
        }]
      ]
    },
    {
      test: ["**/test-import.test.js"],
      plugins: [],
      presets: [
        ['@babel/preset-env', {
          targets: { node: 'current' },
          modules: 'commonjs' // Force CommonJS for specific test files
        }]
      ]
    }
  ]
};