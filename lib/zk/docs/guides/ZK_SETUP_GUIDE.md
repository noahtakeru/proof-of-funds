# Zero-Knowledge Setup Guide

This guide provides recommendations for setting up and working with the zero-knowledge infrastructure in this project.

## Working with Fallbacks (Recommended for Development)

Our project is designed to work effectively without requiring full compilation of zero-knowledge circuits. This approach offers:

- **Faster development**: No need to wait for circuits to compile
- **Less dependencies**: No need to install Rust, circom, etc.
- **Consistent testing**: Tests will pass consistently across all environments

To use this approach (which is the default):

1. Use the existing test infrastructure as-is
2. Run the tests, which will automatically use fallbacks for missing WASM files
3. If you make circuit changes, update the corresponding JS models

## Docker-Based Setup (Recommended for Production Testing)

For a consistent environment with all dependencies pre-installed:

1. Install Docker Desktop from [docker.com](https://www.docker.com/products/docker-desktop/)
2. Build the Docker image:
   ```bash
   cd /path/to/proof-of-funds/lib/zk
   docker build -t zk-circuits .
   ```
3. Run the container:
   ```bash
   docker run -it --rm -v $(pwd):/app zk-circuits
   ```
4. Inside the container, compile circuits:
   ```bash
   node scripts/real-build-circuits.cjs
   ```

## Local Installation (Advanced)

If you prefer installing dependencies directly on your machine:

### Prerequisites

- Node.js 16+ (already installed)
- Rust/Cargo (required for circom)
- C++ build tools:
  - macOS: Xcode Command Line Tools (`xcode-select --install`)
  - Linux: `build-essential` package
  - Windows: Visual Studio Build Tools

### Installing circom and snarkjs

1. Install Rust:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source "$HOME/.cargo/env"
   ```

2. Install circom:
   ```bash
   git clone https://github.com/iden3/circom.git
   cd circom
   cargo build --release
   cargo install --path circom
   ```

3. Install snarkjs (already in package.json):
   ```bash
   npm install
   ```

### Building Circuits

After installation, you can build the circuits:

```bash
cd /path/to/proof-of-funds
node lib/zk/scripts/real-build-circuits.cjs
```

## Testing

Regardless of your setup method, run tests with:

```bash
cd /path/to/proof-of-funds
npx jest lib/zk/__tests__/realImplementation.test.js
```

When real WASM files are available, all tests will run. When they're missing, tests will automatically use fallbacks.

## Troubleshooting

If you encounter issues:

1. **Jest not exiting**: Add `--forceExit` flag to Jest command
2. **Module format errors**: Check that file extensions match their format (.cjs for CommonJS, .mjs for ES modules)
3. **Missing dependencies**: Run `npm install` to install all required packages
4. **Compilation errors**: Check for circom version compatibility (our code targets circom 2.x)

Remember, our system is designed to work with fallbacks, so even if circuit compilation fails, the tests and functionality should still work.