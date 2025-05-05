Rules (ongoing list):
1. No mock or placeholder code. We want to know where we're failing.
2. If something is confusing, don't create crap - stop, make note and consult.
3. Always check if an implementation, file, test, architecture, function or code exists before making any new files or folders.
4. Understand the entire codebase (make sure you grok it before making changes).
5. Review this entire plan and its progress before coding.
6. If you make a new code file - indicate that this is new and exactly what it's needed for. Also make sure there isn't mock or placeholder crap code in here either.
7. Unless a plan or test file was made during this phased sprint (contained in this document) - I'd assume it's unreliable until its contents are analyzed thoroughly. Confirm its legitimacy before proceeding with trusting it blindly. Bad assumptions are unacceptable.
8. Put all imports at the top of the file it's being imported into.
9. Record all progress in this document.

Phase 1: Resolve All Module System Issues

1.1. Fix Remaining Circular Dependencies

Current Progress:
- ✅ Fixed the primary circular dependency between zkErrorHandler.mjs and
 zkErrorLogger.mjs
- ✅ Created initialization pattern in index.mjs for explicit dependency
linking

Remaining Issues:
1. Secondary cycle in the memory & storage system:
```
zkRecoverySystem.mjs → secureStorage.mjs → SecureKeyManager.js →
zkErrorHandler.mjs → zkErrorLogger.js → zkErrorHandler.mjs
```

Specific Files to Modify:
1. `/Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/secureStorage.mjs`
  - Update to use getErrorLogger() function from zkErrorHandler.mjs
  - Remove direct import of zkErrorLogger
2. `/Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/SecureKeyManager.js`
  - Update to use getErrorLogger() function from zkErrorHandler.mjs
  - Remove direct import of zkErrorLogger
3. `/Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/zkRecoverySystem.mjs`
  - Update all imports to use the proper bridge files (.js not .mjs)
  - Ensure consistent logger usage pattern

1.2. Fix TypeScript Integration Issues

Specific Files to Modify:
1. `/Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/contracts/AbiVersionManager.ts`
  - Fix error: "Type 'string' is not assignable to type 'BaseContractMethod<any[], any, any>'"
  - Convert string ABI to proper interface definitions
2. Other TypeScript modules with import issues:
  - `/Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/deployment/DeploymentManager.ts`
  - `/Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/deployment/CrossPlatformDeployment.ts`

1.3. Fix Module Format Inconsistencies

Files to Standardize:
1. `/Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/zkCircuitParameterDerivation.mjs`
  - Ensure imports use consistent extensions (.js vs .mjs)
  - Fix any dynamic imports
2. `/Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/zkUtils.mjs`
  - Standardize imports to use bridge files where appropriate
  - Check for any require() calls in ESM context
3. `/Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/browserCompatibility.mjs`
  - Fix any browser-specific module loading issues

Phase 2: Package Structure Preparation

2.1. Create Common Package Structure

Specific Directory Structure:
```
packages/
└── common/
    ├── package.json        # NEW: Package definition for ZK module
    ├── .npmignore          # NEW: Ignore test/dev files in package
    ├── tsconfig.json       # NEW: TypeScript config for ZK module
    ├── src/                # Will contain source files
    └── dist/               # NEW: Will contain compiled output
```

New package.json:
```json
{
  "name": "@proof-of-funds/common",
  "version": "0.1.0",
  "description": "Common utilities for Proof of Funds platform",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.mjs --format cjs,esm --dts",
    "test": "jest"
  },
  "dependencies": {
    "buffer": "^6.0.3"
    // No ethers dependency
  },
  "peerDependencies": {
    "ethers": "^5.0.0 || ^6.0.0" // Support both versions
  }
}
```

2.2. Create Contracts Package Structure

Specific Directory Structure:
```
packages/
└── contracts/
    ├── package.json        # NEW: Package with ethers v6
    ├── hardhat.config.cjs  # Existing Hardhat config 
    ├── contracts/          # Will contain contracts
    ├── scripts/            # Will contain deployment scripts 
    └── test/               # Will contain contract tests
```

New package.json:
```json
{
  "name": "@proof-of-funds/contracts",
  "version": "0.1.0",
  "description": "Smart contracts for Proof of Funds platform",
  "scripts": {
    "compile": "hardhat compile",
    "test": "hardhat test",
    "deploy:local": "hardhat run scripts/deploy.js --network localhost"
  },
  "dependencies": {
    "ethers": "^6.1.0",
    "hardhat": "^2.17.0",
    "@nomicfoundation/hardhat-chai-matchers": "^2.0.8",
    "chai": "^4.5.0"
  }
}
```

2.3. Create Frontend Package Structure

Specific Directory Structure:
```
packages/
└── frontend/
    ├── package.json        # NEW: Package with ethers v5
    ├── components/         # Will contain components 
    ├── pages/              # Will contain pages
    ├── styles/             # Will contain styles
    ├── next.config.cjs     # Will contain Next.js config
    └── public/             # Will contain public assets
```

New package.json:
```json
{
  "name": "@proof-of-funds/frontend",
  "version": "0.1.0",
  "description": "Frontend for Proof of Funds platform",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "ethers": "^5.7.2", // Keep existing version
    "next": "^14.0.4",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@proof-of-funds/common": "workspace:*" // Workspace dependency
  }
}
```

2.4. Create Root Workspace Configuration

Root package.json:
```json
{
  "name": "proof-of-funds-monorepo",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev": "npm run dev -w @proof-of-funds/frontend",
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces"
  }
}
```

Phase 3: Incremental Migration Strategy (No Symlinks)

3.1. Incremental Migration of Common Package (ZK Libraries)

Step 1: Setup Package Structure
```bash
# Create directory structure
mkdir -p packages/common/src
mkdir -p packages/common/dist

# Create package.json and tsconfig.json
cat > packages/common/package.json << EOF
{
  "name": "@proof-of-funds/common",
  "version": "0.1.0",
  "description": "Common utilities for Proof of Funds platform",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.mjs --format cjs,esm --dts",
    "test": "jest"
  },
  "dependencies": {
    "buffer": "^6.0.3"
  },
  "peerDependencies": {
    "ethers": "^5.0.0 || ^6.0.0"
  }
}
EOF

# Create TypeScript configuration
cat > packages/common/tsconfig.json << EOF
{
  "compilerOptions": {
    "target": "es2020",
    "module": "esnext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "outDir": "./dist",
    "declaration": true,
    "strict": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "**/*.test.ts"]
}
EOF
```

Step 2: Migrate Error Handling System

```bash
# Create the directory structure
mkdir -p packages/common/src/error-handling

# Move files one by one, testing after each move
cp /Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/zkErrorHandler.mjs packages/common/src/error-handling/
cp /Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/zkErrorLogger.mjs packages/common/src/error-handling/
cp /Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/zkErrorLogger.js packages/common/src/error-handling/

# Create an index.js file to export the error handling system
cat > packages/common/src/error-handling/index.js << EOF
// Export error handling system
export * from './zkErrorHandler.mjs';
export * from './zkErrorLogger.mjs';
EOF

# Test the migrated modules
cd packages/common && npm run test -- --testPathPattern=error-handling

# After successful testing, remove original files
rm /Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/zkErrorHandler.mjs
rm /Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/zkErrorLogger.mjs
rm /Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/zkErrorLogger.js
```

Step 3: Migrate Core ZK Modules and Update References

```bash
# Migrate core ZK utility modules
mkdir -p packages/common/src/zk-core
cp /Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/zkUtils.mjs packages/common/src/zk-core/
cp /Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/zkCircuitRegistry.mjs packages/common/src/zk-core/
cp /Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/zkCircuitInputs.mjs packages/common/src/zk-core/

# Update imports to refer to the error-handling module
sed -i '' 's|from '\''./zkErrorHandler.mjs'\''|from '\''../error-handling/zkErrorHandler.mjs'\''|g' packages/common/src/zk-core/*.mjs
sed -i '' 's|from '\''./zkErrorLogger.mjs'\''|from '\''../error-handling/zkErrorLogger.mjs'\''|g' packages/common/src/zk-core/*.mjs

# Create an index.js that exports these modules
cat > packages/common/src/zk-core/index.js << EOF
// Export core ZK utilities
export * from './zkUtils.mjs';
export * from './zkCircuitRegistry.mjs';
export * from './zkCircuitInputs.mjs';
EOF

# Test the migrated modules
cd packages/common && npm run test -- --testPathPattern=zk-core

# After successful testing, remove original files
rm /Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/zkUtils.mjs
rm /Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/zkCircuitRegistry.mjs
rm /Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/zkCircuitInputs.mjs
```

Step 4: Migrate Memory and Storage Modules

```bash
# Create directory for memory and storage modules
mkdir -p packages/common/src/system

# Copy memory and storage modules
cp /Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/memoryManager.mjs packages/common/src/system/
cp /Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/secureStorage.mjs packages/common/src/system/
cp /Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/SecureKeyManager.js packages/common/src/system/

# Update import paths
sed -i '' 's|from '\''./zkErrorHandler.mjs'\''|from '\''../error-handling/zkErrorHandler.mjs'\''|g' packages/common/src/system/*.mjs
sed -i '' 's|from '\''./zkErrorLogger.mjs'\''|from '\''../error-handling/zkErrorLogger.mjs'\''|g' packages/common/src/system/*.mjs
sed -i '' 's|from '\''./zkUtils.mjs'\''|from '\''../zk-core/zkUtils.mjs'\''|g' packages/common/src/system/*.mjs

# Create index.js file
cat > packages/common/src/system/index.js << EOF
// Export system utilities
export * from './memoryManager.mjs';
export * from './secureStorage.mjs';
export * from './SecureKeyManager.js';
EOF

# Test the migrated modules
cd packages/common && npm run test -- --testPathPattern=system

# After successful testing, remove original files
rm /Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/memoryManager.mjs
rm /Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/secureStorage.mjs
rm /Users/karpel/Documents/GitHub/proof-of-funds/lib/zk/src/SecureKeyManager.js
```

Step 5: Create Root Package Index

```bash
# Create main index.js that exports all modules
cat > packages/common/src/index.js << EOF
// Export all modules from the common package

// Error handling
export * from './error-handling';

// Core ZK modules
export * from './zk-core';

// System utilities
export * from './system';
EOF

# Build the package
cd packages/common && npm run build
```

3.2. Migrate Contract Package

Step 1: Setup Contract Package

```bash
# Create directory structure
mkdir -p packages/contracts

# Create package.json
cat > packages/contracts/package.json << EOF
{
  "name": "@proof-of-funds/contracts",
  "version": "0.1.0",
  "description": "Smart contracts for Proof of Funds platform",
  "scripts": {
    "compile": "hardhat compile",
    "test": "hardhat test",
    "deploy:local": "hardhat run scripts/deploy.js --network localhost"
  },
  "dependencies": {
    "ethers": "^6.1.0",
    "hardhat": "^2.17.0",
    "@nomicfoundation/hardhat-chai-matchers": "^2.0.8",
    "chai": "^4.5.0",
    "@proof-of-funds/common": "workspace:*"
  }
}
EOF

# Copy hardhat config
cp /Users/karpel/Documents/GitHub/proof-of-funds/smart-contracts/hardhat.config.cjs packages/contracts/
```

Step 2: Migrate Contract Files

```bash
# Create contract directories
mkdir -p packages/contracts/contracts
mkdir -p packages/contracts/scripts
mkdir -p packages/contracts/test

# Copy contract files
cp /Users/karpel/Documents/GitHub/proof-of-funds/smart-contracts/contracts/*.sol packages/contracts/contracts/
cp /Users/karpel/Documents/GitHub/proof-of-funds/smart-contracts/scripts/*.js packages/contracts/scripts/
cp /Users/karpel/Documents/GitHub/proof-of-funds/smart-contracts/test/*.js packages/contracts/test/

# Update import paths in test files to use the common package
sed -i '' 's|require("../../lib/zk")|require("@proof-of-funds/common")|g' packages/contracts/test/*.js

# Test the contracts
cd packages/contracts && npm run test

# After successful testing, remove original files
# Note: Only remove after confirming everything works
rm -rf /Users/karpel/Documents/GitHub/proof-of-funds/smart-contracts/contracts
rm -rf /Users/karpel/Documents/GitHub/proof-of-funds/smart-contracts/scripts
rm -rf /Users/karpel/Documents/GitHub/proof-of-funds/smart-contracts/test
```

3.3. Migrate Frontend Package

Step 1: Setup Frontend Package

```bash
# Create directory structure
mkdir -p packages/frontend

# Create package.json
cat > packages/frontend/package.json << EOF
{
  "name": "@proof-of-funds/frontend",
  "version": "0.1.0",
  "description": "Frontend for Proof of Funds platform",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "ethers": "^5.7.2",
    "next": "^14.0.4",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@proof-of-funds/common": "workspace:*"
  }
}
EOF

# Copy Next.js config
cp /Users/karpel/Documents/GitHub/proof-of-funds/next.config.cjs packages/frontend/
```

Step 2: Migrate Frontend Files by Component Groups

```bash
# Create frontend directories
mkdir -p packages/frontend/components
mkdir -p packages/frontend/pages
mkdir -p packages/frontend/styles
mkdir -p packages/frontend/public

# Migrate components in logical groups
# Group 1: Basic UI components
cp /Users/karpel/Documents/GitHub/proof-of-funds/components/Layout.js packages/frontend/components/
cp /Users/karpel/Documents/GitHub/proof-of-funds/components/Navbar.js packages/frontend/components/
cp /Users/karpel/Documents/GitHub/proof-of-funds/components/Footer.js packages/frontend/components/
cp /Users/karpel/Documents/GitHub/proof-of-funds/components/NavLink.tsx packages/frontend/components/

# Update imports to use workspace packages
sed -i '' 's|from "../lib/zk"|from "@proof-of-funds/common"|g' packages/frontend/components/*.js
sed -i '' 's|from "../lib/zk"|from "@proof-of-funds/common"|g' packages/frontend/components/*.tsx

# Test these components
cd packages/frontend && npm run build

# After successful testing, remove original files
rm /Users/karpel/Documents/GitHub/proof-of-funds/components/Layout.js
rm /Users/karpel/Documents/GitHub/proof-of-funds/components/Navbar.js
rm /Users/karpel/Documents/GitHub/proof-of-funds/components/Footer.js
rm /Users/karpel/Documents/GitHub/proof-of-funds/components/NavLink.tsx

# Group 2: Wallet-related components
cp /Users/karpel/Documents/GitHub/proof-of-funds/components/WalletSelector.js packages/frontend/components/
cp /Users/karpel/Documents/GitHub/proof-of-funds/components/ConnectWallet.js packages/frontend/components/
cp /Users/karpel/Documents/GitHub/proof-of-funds/components/PhantomMultiWalletSelector.js packages/frontend/components/
cp /Users/karpel/Documents/GitHub/proof-of-funds/components/WalletBalanceProof.tsx packages/frontend/components/

# Update imports
sed -i '' 's|from "../lib/zk"|from "@proof-of-funds/common"|g' packages/frontend/components/*.js
sed -i '' 's|from "../lib/zk"|from "@proof-of-funds/common"|g' packages/frontend/components/*.tsx

# Test these components
cd packages/frontend && npm run build

# After successful testing, remove original files
rm /Users/karpel/Documents/GitHub/proof-of-funds/components/WalletSelector.js
rm /Users/karpel/Documents/GitHub/proof-of-funds/components/ConnectWallet.js
rm /Users/karpel/Documents/GitHub/proof-of-funds/components/PhantomMultiWalletSelector.js
rm /Users/karpel/Documents/GitHub/proof-of-funds/components/WalletBalanceProof.tsx

# Continue with other component groups...
# [Additional component groups would be migrated in similar pattern]

# Pages migration
# Copy pages in logical groups
cp /Users/karpel/Documents/GitHub/proof-of-funds/pages/index.js packages/frontend/pages/
cp /Users/karpel/Documents/GitHub/proof-of-funds/pages/about.js packages/frontend/pages/
cp /Users/karpel/Documents/GitHub/proof-of-funds/pages/_app.js packages/frontend/pages/

# Update imports
sed -i '' 's|from "../lib/zk"|from "@proof-of-funds/common"|g' packages/frontend/pages/*.js

# Test these pages
cd packages/frontend && npm run build

# After successful testing, remove original files
rm /Users/karpel/Documents/GitHub/proof-of-funds/pages/index.js
rm /Users/karpel/Documents/GitHub/proof-of-funds/pages/about.js
rm /Users/karpel/Documents/GitHub/proof-of-funds/pages/_app.js

# Continue with other page groups...
# [Additional page groups would be migrated in similar pattern]

# Migrate styles and public directories
cp -r /Users/karpel/Documents/GitHub/proof-of-funds/styles/* packages/frontend/styles/
cp -r /Users/karpel/Documents/GitHub/proof-of-funds/public/* packages/frontend/public/

# After successful testing, remove original files
rm -rf /Users/karpel/Documents/GitHub/proof-of-funds/styles
rm -rf /Users/karpel/Documents/GitHub/proof-of-funds/public
```

Phase 4: Root Workspace Integration

4.1. Create Root Workspace Configuration

```bash
# Update root package.json to include workspaces
cat > /Users/karpel/Documents/GitHub/proof-of-funds/package.json << EOF
{
  "name": "proof-of-funds-monorepo",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev": "npm run dev -w @proof-of-funds/frontend",
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces"
  }
}
EOF

# Install dependencies for the workspace
npm install
```

4.2. Verify Complete Migration

```bash
# Run specific tests for each phase of migration
# For common package:
npm run test -w @proof-of-funds/common -- --testPathPattern=error-handling
npm run test -w @proof-of-funds/common -- --testPathPattern=zk-core
npm run test -w @proof-of-funds/common -- --testPathPattern=system

# For contracts package:
npm run test -w @proof-of-funds/contracts

# For frontend:
npm run build -w @proof-of-funds/frontend

# Start development server
npm run dev

# Verify application works in browser by navigating to:
# http://localhost:3000
# http://localhost:3000/create
# http://localhost:3000/verify
```

Testing Strategy

For each module migration:
1. Run specific tests for that module:
   ```bash
   # For error handling
   npm run test -- --testPathPattern=error-handling
   
   # For ZK core
   npm run test -- --testPathPattern=zk-core
   
   # For specific components
   npm run test -- --testPathPattern=WalletSelector
   ```

2. Build the package to verify compilation:
   ```bash
   npm run build
   ```

3. For UI components and pages, also manually verify in browser:
   - Check that the component renders correctly
   - Verify functionality (e.g., wallet connection, proof creation)
   - Test with different inputs and edge cases

Risk Assessment and Mitigation

1. **Import Path Resolution:**
   - Risk: Next.js may not properly resolve workspace package imports
   - Mitigation: Update Next.js configuration to support workspaces
   - Test each component after migration before removing original

2. **TypeScript Integration:**
   - Risk: TypeScript types may not be properly exposed between packages
   - Mitigation: Ensure proper tsconfig.json setup in each package
   - Add explicit type exports in common package index.ts

3. **Module Resolution:**
   - Risk: Mixed CommonJS/ESM imports might cause runtime errors
   - Mitigation: Explicitly specify module format in package.json
   - Use proper extensions (.mjs for ESM, .cjs for CommonJS)
   - Test in both Node.js and browser environments

4. **Dependency Management:**
   - Risk: Version conflicts between ethers v5 and v6
   - Mitigation: Use peerDependencies in common package
   - Explicitly specify which version each package uses