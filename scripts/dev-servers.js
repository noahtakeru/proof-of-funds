/**
 * Development server launcher
 * Dynamically assigns ports and starts both frontend and backend
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { findAvailablePort } = require('./find-available-port');

async function startDevelopmentServers() {
  console.log('🚀 Starting development servers...');
  
  // Find available ports
  const frontendPort = await findAvailablePort(3000);
  const backendPort = await findAvailablePort(frontendPort + 1);
  
  console.log(`📱 Frontend will run on: http://localhost:${frontendPort}`);
  console.log(`🔧 Backend will run on: http://localhost:${backendPort}`);
  
  // Update frontend environment
  const frontendEnvPath = path.join(__dirname, '../packages/frontend/.env.local');
  let frontendEnv = '';
  
  if (fs.existsSync(frontendEnvPath)) {
    frontendEnv = fs.readFileSync(frontendEnvPath, 'utf8');
  }
  
  // Update or add BACKEND_URL
  const backendUrlPattern = /^BACKEND_URL=.*$/m;
  const newBackendUrl = `BACKEND_URL=http://127.0.0.1:${backendPort}`;
  
  if (backendUrlPattern.test(frontendEnv)) {
    frontendEnv = frontendEnv.replace(backendUrlPattern, newBackendUrl);
  } else {
    frontendEnv = `${newBackendUrl}\n${frontendEnv}`;
  }
  
  fs.writeFileSync(frontendEnvPath, frontendEnv);
  
  // Start backend first
  const backend = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, '../packages/backend'),
    env: { ...process.env, PORT: backendPort },
    stdio: 'pipe'
  });
  
  // Start frontend after a short delay
  setTimeout(() => {
    const frontend = spawn('npm', ['run', 'dev'], {
      cwd: path.join(__dirname, '../packages/frontend'),
      env: { ...process.env, PORT: frontendPort },
      stdio: 'pipe'
    });
    
    // Pipe output with prefixes
    frontend.stdout.on('data', (data) => {
      console.log(`[FRONTEND] ${data.toString().trim()}`);
    });
    
    frontend.stderr.on('data', (data) => {
      console.error(`[FRONTEND] ${data.toString().trim()}`);
    });
    
    frontend.on('close', (code) => {
      console.log(`Frontend process exited with code ${code}`);
      process.exit(code);
    });
  }, 3000);
  
  // Pipe backend output
  backend.stdout.on('data', (data) => {
    console.log(`[BACKEND] ${data.toString().trim()}`);
  });
  
  backend.stderr.on('data', (data) => {
    console.error(`[BACKEND] ${data.toString().trim()}`);
  });
  
  backend.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`);
    process.exit(code);
  });
  
  // Handle cleanup
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down development servers...');
    backend.kill();
    process.exit(0);
  });
}

startDevelopmentServers().catch(console.error);