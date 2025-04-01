# CLAUDE.md - Development Guidelines

## Project Commands
- `npm run dev` - Start development server
- `npm run build` - Build the Next.js project
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run compile` - Compile smart contracts
- `npm run test` - Run all smart contract tests
- `npm run test -- --grep "Proof Hash Generation"` - Run specific test
- `npx hardhat test test/ProofOfFunds.test.js --config hardhat.config.cjs` - Run a single test file

## Code Style Guidelines
- **Imports**: Group imports by source (React, Next.js, third-party, local)
- **TypeScript**: Use TypeScript where possible with proper type definitions
- **React Components**: Prefer functional components with hooks
- **File Structure**: Keep components in `/components`, pages in `/pages`, and utilities in `/lib`
- **Smart Contracts**: Follow Solidity style guidelines with NatSpec comments
- **Error Handling**: Use try/catch for async operations, implement proper error states in UI
- **CSS**: Use TailwindCSS for styling, following utility-first approach
- **Testing**: Write thorough tests for smart contracts, include edge cases
- **Naming**: Use PascalCase for components, camelCase for functions/variables, UPPER_CASE for constants

## Documentation
Document complex functions, important business logic, and security considerations.