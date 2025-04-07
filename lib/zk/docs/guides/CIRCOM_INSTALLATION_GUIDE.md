# Circom Installation Guide for macOS

This guide provides step-by-step instructions for installing circom on macOS for the proof-of-funds project. Follow these instructions to set up a complete development environment for working with zero-knowledge circuits.

## Prerequisites Installation

### 1. Install Xcode Command Line Tools

The Command Line Tools package is required for compilation:

```bash
xcode-select --install
```

A popup will appear - click "Install" and complete the installation before proceeding.

### 2. Install Rust and Cargo

Rust is required to compile circom from source:

```bash
# Download and run the Rust installer
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Choose option 1 for default installation
# After installation completes, load Rust in your current shell
source "$HOME/.cargo/env"

# Verify the installation
rustc --version
cargo --version
```

## Installing Circom

There are two approaches to installing circom:

### Option A: Direct Installation from Source (Recommended)

This method builds circom from the official repository:

```bash
# Clone the repository
git clone https://github.com/iden3/circom.git
cd circom

# Build the project
cargo build --release

# Install the circom binary
cargo install --path circom

# Verify the installation
circom --version
```

### Option B: Using npm (Fallback Option)

While npm installation is simpler, it may not provide the latest version:

```bash
# Install circom globally
npm install -g circom

# Verify the installation
circom --version
```

## Installing Project Dependencies

Now that circom is installed, return to the project directory and install dependencies:

```bash
cd /path/to/proof-of-funds
npm install
```

This will install snarkjs (v0.7.5) and circomlib (v2.0.5) as specified in the package.json.

## Building Circuits

Now you can build the zero-knowledge circuits:

```bash
# Make the build script executable
chmod +x lib/zk/scripts/real-build-circuits.cjs

# Run the build script
node lib/zk/scripts/real-build-circuits.cjs
```

This will generate the following files for each circuit (standardProof, thresholdProof, maximumProof):
- r1cs constraint files
- WebAssembly (wasm) modules
- Verification keys
- Solidity verifier contracts

## Testing the Installation

After building the circuits, run the tests to verify everything works correctly:

```bash
# Run the ZK implementation tests
npx jest lib/zk/__tests__/realImplementation.test.js
```

If circom is correctly installed and circuits are properly built, you should see all tests passing, including those that were previously skipped.

## Troubleshooting

### Common Issues and Solutions

1. **"Command not found" errors**:
   - Make sure you've sourced your Rust environment: `source "$HOME/.cargo/env"`
   - Check your PATH variable: `echo $PATH`

2. **Compilation errors in circom**:
   - Ensure you have the latest Rust: `rustup update`
   - Try with a specific version: `git checkout v2.1.5` (in the circom directory)

3. **Issues with circuit compilation**:
   - Check the error messages for syntax issues in the circuit files
   - Verify that the include paths in your circuit files are correct
   - Run with verbose output: `node lib/zk/scripts/real-build-circuits.cjs --verbose`

4. **Missing libraries**:
   - For any missing libraries: `brew install <library>` (with Homebrew installed)
   - OpenSSL issues: `brew install openssl`

### Still Having Issues?

If you encounter persistent problems:

1. Use our fallback mechanism, which is designed to work without real circuit compilation
2. Try the Docker-based approach from the ZK_SETUP_GUIDE.md
3. Reach out to the development team for assistance

## Advanced Configuration

### Custom Installation Locations

If you want to install circom in a custom location:

```bash
# Build circom
cargo build --release

# Copy the binary to your preferred location
cp target/release/circom /usr/local/bin/
```

### Multiple Versions

To maintain multiple circom versions:

```bash
# Clone specific versions to different directories
git clone https://github.com/iden3/circom.git circom-latest
cd circom-latest
git checkout v2.1.5
cargo build --release
```

Then use the specific binary with its full path when needed.

## Conclusion

With circom properly installed, you can now work with real zero-knowledge circuits rather than placeholder implementations. This allows for:

1. Complete testing of actual proof generation and verification
2. Development of new circuit functionality
3. Optimization of existing circuits
4. Investigation of gas usage with real proofs

Remember that our system is designed to work with either real or placeholder implementations, so you can always fall back to the mock version if needed.