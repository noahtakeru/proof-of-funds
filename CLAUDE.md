# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run test` - Run all Hardhat tests
- `npm run test -- --grep "Standard Proof"` - Run specific test
- `npm run compile` - Compile Solidity contracts
- `npm run deploy:local` - Deploy to local Hardhat network

## Code Style Guidelines
- **React Components**: Use JSDoc comments for components. Props should be documented with types.
- **Solidity**: Follow NatSpec comments pattern. Use 4-space indentation.
- **JS/TS**: Mix of JS and TS files. Path aliases with `@/*` for imports from root.
- **Error Handling**: Use try/catch blocks with specific error messages.
- **Naming**: PascalCase for components, camelCase for functions/variables, UPPER_CASE for constants.
- **File Structure**: Components in `/components`, pages in `/pages`, smart contracts in `/smart-contracts/contracts`.
- **Imports**: Group imports by external libraries first, followed by internal imports.
- Always maintain existing UI/UX when adding functionality. Ask before making any design changes.