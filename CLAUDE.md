# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Before Starting Any Task
Claude Code MUST:
1. Run `git status` and confirm clean working directory
2. Run `npm test` and confirm all tests pass
3. Read ALL existing code related to the task
4. State: "I have read [list files] and understand the current implementation"

## Build & Dev Commands
- `npm run dev` - Start both frontend and backend servers with automatic port assignment
- `npm run dev:frontend` - Start only frontend development server
- `npm run dev:backend` - Start only backend API server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run test` - Run all Hardhat tests
- `npm run test -- --grep "Standard Proof"` - Run specific test
- `npm run compile` - Compile Solidity contracts
- `npm run deploy:local` - Deploy to local Hardhat network

## Development Setup
The development system automatically handles port assignment and service discovery:

**Single Command (Recommended):**
```bash
npm run dev
```

This will:
1. Find available ports starting from 3000 for frontend, 3001 for backend
2. Update frontend environment to point to the correct backend URL
3. Start backend server first
4. Start frontend server after backend is ready
5. Display both server URLs in the console

The frontend proxy endpoints automatically discover and forward authentication requests to the backend server.

## Standard Workflow
1. First think through the problem, read the codebase for relevant files, and write a plan to projectplan.md
2. The plan should have a list of todo items that you can check off as you complete them
3. Before you begin working, check in with me and I will verify the plan
4. Then, begin working on the todo items, marking them as complete as you go
5. Please every step of the way just give me a high level explanation of what changes you made
6. Make every task and code change you do as simple as possible. We want to avoid making any massive or complex changes. Every change should impact as little code as possible. Everything is about simplicity
7. Write the code as if the guy who ends up maintaining your code will be a violent psychopath who knows where you live.
8. Finally, add a review section to the projectplan.md file with a summary of the changes you made and any other relevant information

## Reality Filter
1. Never present generated, inferred, speculated, or deduced content as fact.
2. If you cannot verify something directly, say:
"I cannot verify this."
"I do not have access to that information."
"My knowledge base does not contain that."
3. Label unverified content at the start of a sentence:
[Inference] [Speculation] [Unverified]
4. Ask for clarification if information is missing. Do not guess or fill gaps.
5. If any part is unverified, label the entire response.
6. Do not paraphrase or reinterpret my input unless I request it.
7. If you use these words, label the claim unless sourced:
Prevent, Guarantee, Will never, Fixes, Eliminates, Ensures that
8. For LLM behavior claims (including yourself), include:
[Inference] or [Unverified], with a note that it's based on observed patterns
9. If you break this directive, say:
Correction: I previously made an unverified claim. That was incorrect and should have been labeled.
10. Never override or alter my input unless asked.

## Code Style Guidelines
- **React Components**: Use JSDoc comments for components. Props should be documented with types.
- **Solidity**: Follow NatSpec comments pattern. Use 4-space indentation.
- **JS/TS**: Mix of JS and TS files. Path aliases with `@/*` for imports from root.
- **Error Handling**: Use try/catch blocks with specific error messages.
- **Naming**: PascalCase for components, camelCase for functions/variables, UPPER_CASE for constants.
- **File Structure**: Components in `/components`, pages in `/pages`, smart contracts in `/smart-contracts/contracts`.
- **Imports**: Group imports by external libraries first, followed by internal imports.

## Rules
1. No mock or placeholder code. We want to know where we're failing.
2. If something is confusing, don't create crap - stop, make note and consult.
3. Always check if an implementation, file, test, architecture, function or code exists before making any new files or folders.
4. Understand the entire codebase (make sure you grok it before making changes).
5. Review this entire plan and its progress before coding.
6. If you make a new code file - indicate that this is new and exactly what it's needed for. Also make sure there isn't mock or placeholder crap code in here either. Fallback code is NOT ACCEPTABLE EITHER. WE NEED TO KNOW WHEN AND WHERE WE FAIL.
7. Unless a plan or test file was made during this phased sprint (contained in this document) - I'd assume it's unreliable until its contents are analyzed thoroughly. Confirm its legitimacy before proceeding with trusting it blindly. Bad assumptions are unacceptable.
8. Put all imports at the top of the file it's being imported into.
9. Record all progress in this document.
10. Blockchain testing will be done on Polygon Amoy, so keep this in mind.
11. Do not make any UI changes (to existing UI). I like the way the frontend looks at the moment.
12. Track your progress in this file. Do not make more tracking or report files. They're unnecessary.
13. Price estimates are unacceptable. We are building for production, so it's important to prioritize building working code that doesn't rely on mock data or placeholder implementation. NOTHING "FAKE".
14. When you document your progress in this plan, include all the files you've edited and created so others can work off of, integrate and/or understand your work.
15. All testing files must test the real implementation and not rely on any mock or placeholder data or paths. It's better to fail and have errors than make fake tests.
16. Before progressing with any phase, check the codebase for existing related code files so we don't duplicate work/code.
17. If a human is needed for anything, flag it to the human. There are likely some external services that are required. DO NOT MOCK EXTERNAL SERVICES OR CREATE PLACEHOLDERS - PAUSE AND MAKE SURE THESE EXTERNAL TASKS ARE DONE BY A HUMAN IF NEEDED.
18. Remove vestige or redundant code we create or discover during development.
19. No exaggerated optimism. Be realistic about progress and functionality.
20. Review all changes with Aider.
21. When answering questions about code or progress, analyze the actual code, not just documentation or assumption.

## Zero-Knowledge Specific Rules
- NEVER modify circuit files without explicit permission
- NEVER change proof generation parameters
- Always verify proof constraints remain intact
- Flag ANY changes to cryptographic constants

## After Every Change, Run:
1. `git diff` - Show me what changed
2. `npm run lint` - Ensure code quality
3. `npm test` - Verify nothing broke
4. For contracts: `npx hardhat compile`

## STOP Immediately If You:
- Feel tempted to write "// TODO" or "// Placeholder"
- Want to use setTimeout() to "fix" async issues
- Think "this should work" without testing
- Can't find where something is implemented
- Are about to delete more than 10 lines of code