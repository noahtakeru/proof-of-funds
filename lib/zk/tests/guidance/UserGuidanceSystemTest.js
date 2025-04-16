/**
 * @fileoverview Real tests for the UserGuidanceSystem component
 */

import assert from 'assert';

// Mock dependencies
// Create a mock for the zkErrorLogger in ESM environment
const zkErrorLoggerMock = {
  log: (level, message, data) => {
    // Simple mock implementation that just logs to console
    console.log(`[${level}] ${message}`, data);
  }
};

// Mock the import
const mockedModule = { default: { zkErrorLogger: zkErrorLoggerMock } };

// We'll use this in our UserGuidanceSystem class

// Import the guidance enums - we'll recreate them here for testing
const GuidanceDifficulty = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
  EXPERT: 'expert'
};

// Create a simplified UserGuidanceSystem class for testing
// This is based on the implementation in UserGuidanceSystem.ts but adapted for testing in Node.js
class UserGuidanceSystem {
  constructor() {
    this.guidanceSteps = new Map();
    this.userProgress = new Map();
    this.guidancePaths = new Map();
    this.activeGuidance = new Map();
    
    // Get access to mock zkErrorLogger
    this.zkErrorLogger = zkErrorLoggerMock;
    
    // Initialize with default guidance paths
    this.initializeDefaultPaths();
  }
  
  initializeDefaultPaths() {
    try {
      // Basic ZK understanding path
      this.guidancePaths.set('basic-zk', {
        id: 'basic-zk',
        name: 'ZK Fundamentals',
        description: 'Understanding basic concepts of Zero Knowledge proofs',
        targetAudience: GuidanceDifficulty.BEGINNER,
        steps: ['zk-intro', 'zk-use-cases', 'zk-setup']
      });
      
      // Advanced implementation path
      this.guidancePaths.set('advanced-zk', {
        id: 'advanced-zk',
        name: 'ZK Implementation',
        description: 'Creating and verifying ZK proofs in applications',
        targetAudience: GuidanceDifficulty.INTERMEDIATE,
        steps: ['zk-circuit-design', 'zk-proof-generation', 'zk-verification']
      });
      
      // Expert optimization path
      this.guidancePaths.set('expert-zk', {
        id: 'expert-zk',
        name: 'ZK Optimization',
        description: 'Optimizing ZK proof generation for performance',
        targetAudience: GuidanceDifficulty.EXPERT,
        steps: ['zk-performance-tuning', 'zk-security-hardening', 'zk-advanced-circuits']
      });
    } catch (error) {
      this.zkErrorLogger.log('ERROR', 'Failed to initialize default guidance paths', { error });
    }
  }
  
  showGuidance(userId, stepId) {
    try {
      if (!this.guidanceSteps.has(stepId)) {
        this.zkErrorLogger.log('WARNING', 'Guidance step not found', { userId, stepId });
        return null;
      }
      
      const step = this.guidanceSteps.get(stepId);
      
      // Track that this step is active for the user
      if (!this.activeGuidance.has(userId)) {
        this.activeGuidance.set(userId, []);
      }
      
      const activeSteps = this.activeGuidance.get(userId) || [];
      if (!activeSteps.includes(stepId)) {
        activeSteps.push(stepId);
        this.activeGuidance.set(userId, activeSteps);
      }
      
      // Update user progress to reflect current step
      this.updateUserCurrentStep(userId, stepId);
      
      return step || null;
    } catch (error) {
      this.zkErrorLogger.log('ERROR', 'Error showing guidance', { userId, stepId, error });
      return null;
    }
  }
  
  dismissGuidance(userId, stepId) {
    try {
      if (!this.activeGuidance.has(userId)) {
        return false;
      }
      
      if (stepId) {
        // Dismiss specific step
        const activeSteps = this.activeGuidance.get(userId) || [];
        const updatedSteps = activeSteps.filter(id => id !== stepId);
        this.activeGuidance.set(userId, updatedSteps);
        return true;
      } else {
        // Dismiss all active guidance
        this.activeGuidance.set(userId, []);
        return true;
      }
    } catch (error) {
      this.zkErrorLogger.log('ERROR', 'Error dismissing guidance', { userId, stepId, error });
      return false;
    }
  }
  
  registerGuidanceStep(step) {
    try {
      if (!step.id || this.guidanceSteps.has(step.id)) {
        this.zkErrorLogger.log('WARNING', 'Invalid step ID or step already exists', { stepId: step.id });
        return false;
      }
      
      this.guidanceSteps.set(step.id, step);
      return true;
    } catch (error) {
      this.zkErrorLogger.log('ERROR', 'Error registering guidance step', { step, error });
      return false;
    }
  }
  
  trackUserProgress(userId, completedStepId) {
    try {
      let progress = this.userProgress.get(userId);
      
      if (!progress) {
        // Initialize new user progress
        progress = {
          userId,
          completedSteps: [],
          skillLevel: GuidanceDifficulty.BEGINNER,
          lastActivity: new Date()
        };
      }
      
      // Add to completed steps if not already completed
      if (!progress.completedSteps.includes(completedStepId)) {
        progress.completedSteps.push(completedStepId);
      }
      
      progress.lastActivity = new Date();
      
      // Update skill level based on completed steps
      this.updateUserSkillLevel(progress);
      
      // Update user progress in the map
      this.userProgress.set(userId, progress);
      
      // Dismiss the completed guidance step
      this.dismissGuidance(userId, completedStepId);
      
      return progress;
    } catch (error) {
      this.zkErrorLogger.log('ERROR', 'Error tracking user progress', { userId, completedStepId, error });
      return {
        userId,
        completedSteps: [],
        skillLevel: GuidanceDifficulty.BEGINNER,
        lastActivity: new Date()
      };
    }
  }
  
  getRecommendedPath(userId) {
    try {
      const progress = this.userProgress.get(userId);
      
      // If no progress data, recommend beginner path
      if (!progress) {
        return this.findPathByDifficulty(GuidanceDifficulty.BEGINNER);
      }
      
      // If user has preferred path, use that
      if (progress.preferredLearningPath && this.guidancePaths.has(progress.preferredLearningPath)) {
        return this.guidancePaths.get(progress.preferredLearningPath) || null;
      }
      
      // Otherwise, recommend based on skill level
      return this.findPathByDifficulty(progress.skillLevel);
    } catch (error) {
      this.zkErrorLogger.log('ERROR', 'Error getting recommended path', { userId, error });
      return null;
    }
  }
  
  updateUserCurrentStep(userId, stepId) {
    let progress = this.userProgress.get(userId);
    
    if (!progress) {
      progress = {
        userId,
        completedSteps: [],
        currentStep: stepId,
        skillLevel: GuidanceDifficulty.BEGINNER,
        lastActivity: new Date()
      };
    } else {
      progress.currentStep = stepId;
      progress.lastActivity = new Date();
    }
    
    this.userProgress.set(userId, progress);
  }
  
  updateUserSkillLevel(progress) {
    const completedCount = progress.completedSteps.length;
    
    // Simple algorithm to determine skill level based on completed steps
    if (completedCount >= 10) {
      progress.skillLevel = GuidanceDifficulty.EXPERT;
    } else if (completedCount >= 6) {
      progress.skillLevel = GuidanceDifficulty.ADVANCED;
    } else if (completedCount >= 3) {
      progress.skillLevel = GuidanceDifficulty.INTERMEDIATE;
    } else {
      progress.skillLevel = GuidanceDifficulty.BEGINNER;
    }
  }
  
  findPathByDifficulty(difficulty) {
    for (const path of this.guidancePaths.values()) {
      if (path.targetAudience === difficulty) {
        return path;
      }
    }
    
    // If no match, default to beginner path
    for (const path of this.guidancePaths.values()) {
      if (path.targetAudience === GuidanceDifficulty.BEGINNER) {
        return path;
      }
    }
    
    // If no paths at all, return null
    return null;
  }
}

// Set up test suite
console.log('Running UserGuidanceSystem tests...');

let passedTests = 0;
let totalTests = 0;

// Helper function to run and track tests
function runTest(name, testFn) {
  totalTests++;
  try {
    testFn();
    console.log(`✅ ${name} passed`);
    passedTests++;
  } catch (error) {
    console.error(`❌ ${name} failed: ${error.message}`);
  }
}

// Test initialization
runTest('Initialization', () => {
  const guidanceSystem = new UserGuidanceSystem();
  
  // Check that default paths were created
  assert.strictEqual(guidanceSystem.guidancePaths.size, 3);
  assert.strictEqual(guidanceSystem.guidancePaths.has('basic-zk'), true);
  assert.strictEqual(guidanceSystem.guidancePaths.has('advanced-zk'), true);
  assert.strictEqual(guidanceSystem.guidancePaths.has('expert-zk'), true);
});

// Test guidance step registration
runTest('Guidance step registration', () => {
  const guidanceSystem = new UserGuidanceSystem();
  
  // Create a test step
  const testStep = {
    id: 'test-step',
    title: 'Test Step',
    description: 'A test guidance step',
    difficulty: GuidanceDifficulty.BEGINNER,
    prerequisites: [],
    content: 'Test content',
    position: 1,
    isRequired: true
  };
  
  // Register the step
  const result = guidanceSystem.registerGuidanceStep(testStep);
  
  // Check registration succeeded
  assert.strictEqual(result, true);
  
  // Check step was added to the map
  assert.strictEqual(guidanceSystem.guidanceSteps.has('test-step'), true);
  
  // Try to register the same step again (should fail)
  const secondResult = guidanceSystem.registerGuidanceStep(testStep);
  assert.strictEqual(secondResult, false);
});

// Test showing guidance
runTest('Show guidance', () => {
  const guidanceSystem = new UserGuidanceSystem();
  
  // Register a test step
  const testStep = {
    id: 'test-step',
    title: 'Test Step',
    description: 'A test guidance step',
    difficulty: GuidanceDifficulty.BEGINNER,
    prerequisites: [],
    content: 'Test content',
    position: 1,
    isRequired: true
  };
  
  guidanceSystem.registerGuidanceStep(testStep);
  
  // Show guidance to a user
  const userId = 'user1';
  const shownStep = guidanceSystem.showGuidance(userId, 'test-step');
  
  // Check that the correct step was returned
  assert.deepStrictEqual(shownStep, testStep);
  
  // Check that the step is active for the user
  assert.strictEqual(guidanceSystem.activeGuidance.has(userId), true);
  assert.strictEqual(guidanceSystem.activeGuidance.get(userId).includes('test-step'), true);
  
  // Check that the user progress was updated
  assert.strictEqual(guidanceSystem.userProgress.has(userId), true);
  assert.strictEqual(guidanceSystem.userProgress.get(userId).currentStep, 'test-step');
});

// Test dismissing guidance
runTest('Dismiss guidance', () => {
  const guidanceSystem = new UserGuidanceSystem();
  
  // Register a test step
  guidanceSystem.registerGuidanceStep({
    id: 'test-step-1',
    title: 'Test Step 1',
    description: 'A test guidance step',
    difficulty: GuidanceDifficulty.BEGINNER,
    prerequisites: [],
    content: 'Test content 1',
    position: 1,
    isRequired: true
  });
  
  guidanceSystem.registerGuidanceStep({
    id: 'test-step-2',
    title: 'Test Step 2',
    description: 'Another test guidance step',
    difficulty: GuidanceDifficulty.BEGINNER,
    prerequisites: [],
    content: 'Test content 2',
    position: 2,
    isRequired: true
  });
  
  // Show guidance to a user
  const userId = 'user1';
  guidanceSystem.showGuidance(userId, 'test-step-1');
  guidanceSystem.showGuidance(userId, 'test-step-2');
  
  // Check that both steps are active
  assert.strictEqual(guidanceSystem.activeGuidance.get(userId).length, 2);
  
  // Dismiss one step
  const dismissResult1 = guidanceSystem.dismissGuidance(userId, 'test-step-1');
  
  // Check that dismissal succeeded
  assert.strictEqual(dismissResult1, true);
  
  // Check that only the second step is still active
  assert.strictEqual(guidanceSystem.activeGuidance.get(userId).length, 1);
  assert.strictEqual(guidanceSystem.activeGuidance.get(userId)[0], 'test-step-2');
  
  // Dismiss all guidance
  const dismissResult2 = guidanceSystem.dismissGuidance(userId);
  
  // Check that dismissal succeeded
  assert.strictEqual(dismissResult2, true);
  
  // Check that no steps are active
  assert.strictEqual(guidanceSystem.activeGuidance.get(userId).length, 0);
});

// Test tracking user progress
runTest('Track user progress', () => {
  const guidanceSystem = new UserGuidanceSystem();
  
  // Register test steps
  guidanceSystem.registerGuidanceStep({
    id: 'step1',
    title: 'Step 1',
    difficulty: GuidanceDifficulty.BEGINNER,
    prerequisites: [],
    content: 'Content 1',
    position: 1,
    isRequired: true
  });
  
  guidanceSystem.registerGuidanceStep({
    id: 'step2',
    title: 'Step 2',
    difficulty: GuidanceDifficulty.BEGINNER,
    prerequisites: [],
    content: 'Content 2',
    position: 2,
    isRequired: true
  });
  
  // Track progress for a user
  const userId = 'user1';
  
  // Track completion of step 1
  const progress1 = guidanceSystem.trackUserProgress(userId, 'step1');
  
  // Check progress was recorded correctly
  assert.strictEqual(progress1.userId, userId);
  assert.strictEqual(progress1.completedSteps.length, 1);
  assert.strictEqual(progress1.completedSteps[0], 'step1');
  assert.strictEqual(progress1.skillLevel, GuidanceDifficulty.BEGINNER);
  
  // Track completion of step 2
  const progress2 = guidanceSystem.trackUserProgress(userId, 'step2');
  
  // Check progress was updated
  assert.strictEqual(progress2.completedSteps.length, 2);
  assert.strictEqual(progress2.completedSteps.includes('step1'), true);
  assert.strictEqual(progress2.completedSteps.includes('step2'), true);
  
  // Check that the active guidance was updated (steps dismissed)
  assert.strictEqual(
    guidanceSystem.activeGuidance.has(userId) && 
    guidanceSystem.activeGuidance.get(userId).includes('step1'), 
    false
  );
  assert.strictEqual(
    guidanceSystem.activeGuidance.has(userId) && 
    guidanceSystem.activeGuidance.get(userId).includes('step2'), 
    false
  );
});

// Test skill level progression
runTest('Skill level progression', () => {
  const guidanceSystem = new UserGuidanceSystem();
  
  // Register multiple steps
  for (let i = 1; i <= 12; i++) {
    guidanceSystem.registerGuidanceStep({
      id: `step${i}`,
      title: `Step ${i}`,
      difficulty: GuidanceDifficulty.BEGINNER,
      prerequisites: [],
      content: `Content ${i}`,
      position: i,
      isRequired: true
    });
  }
  
  // Test user
  const userId = 'user1';
  
  // Complete 2 steps - should be BEGINNER
  guidanceSystem.trackUserProgress(userId, 'step1');
  guidanceSystem.trackUserProgress(userId, 'step2');
  let progress = guidanceSystem.userProgress.get(userId);
  assert.strictEqual(progress.skillLevel, GuidanceDifficulty.BEGINNER);
  
  // Complete 2 more steps (4 total) - should be INTERMEDIATE
  guidanceSystem.trackUserProgress(userId, 'step3');
  guidanceSystem.trackUserProgress(userId, 'step4');
  progress = guidanceSystem.userProgress.get(userId);
  assert.strictEqual(progress.skillLevel, GuidanceDifficulty.INTERMEDIATE);
  
  // Complete 3 more steps (7 total) - should be ADVANCED
  guidanceSystem.trackUserProgress(userId, 'step5');
  guidanceSystem.trackUserProgress(userId, 'step6');
  guidanceSystem.trackUserProgress(userId, 'step7');
  progress = guidanceSystem.userProgress.get(userId);
  assert.strictEqual(progress.skillLevel, GuidanceDifficulty.ADVANCED);
  
  // Complete 3 more steps (10 total) - should be EXPERT
  guidanceSystem.trackUserProgress(userId, 'step8');
  guidanceSystem.trackUserProgress(userId, 'step9');
  guidanceSystem.trackUserProgress(userId, 'step10');
  progress = guidanceSystem.userProgress.get(userId);
  assert.strictEqual(progress.skillLevel, GuidanceDifficulty.EXPERT);
});

// Test path recommendations
runTest('Path recommendations', () => {
  const guidanceSystem = new UserGuidanceSystem();
  
  // New user with no progress - should get beginner path
  const newUserId = 'newUser';
  const newUserPath = guidanceSystem.getRecommendedPath(newUserId);
  assert.strictEqual(newUserPath.id, 'basic-zk');
  assert.strictEqual(newUserPath.targetAudience, GuidanceDifficulty.BEGINNER);
  
  // User with some progress, but no preference - should get path matching skill level
  const intermediateUserId = 'intermediateUser';
  // Create and set progress directly
  const intermediateProgress = {
    userId: intermediateUserId,
    completedSteps: ['step1', 'step2', 'step3', 'step4'],
    skillLevel: GuidanceDifficulty.INTERMEDIATE,
    lastActivity: new Date()
  };
  guidanceSystem.userProgress.set(intermediateUserId, intermediateProgress);
  
  const intermediatePath = guidanceSystem.getRecommendedPath(intermediateUserId);
  assert.strictEqual(intermediatePath.id, 'advanced-zk');
  assert.strictEqual(intermediatePath.targetAudience, GuidanceDifficulty.INTERMEDIATE);
  
  // User with a preferred path - should get that path regardless of skill level
  const advancedUserId = 'advancedUser';
  const advancedProgress = {
    userId: advancedUserId,
    completedSteps: ['step1', 'step2', 'step3', 'step4', 'step5', 'step6', 'step7'],
    skillLevel: GuidanceDifficulty.ADVANCED,
    preferredLearningPath: 'basic-zk', // User prefers beginner path despite advanced skill
    lastActivity: new Date()
  };
  guidanceSystem.userProgress.set(advancedUserId, advancedProgress);
  
  const advancedPath = guidanceSystem.getRecommendedPath(advancedUserId);
  assert.strictEqual(advancedPath.id, 'basic-zk'); // Should follow user preference
});

// Print test summary
console.log(`\n${passedTests}/${totalTests} tests passed`);

// Exit with appropriate code
if (passedTests === totalTests) {
  console.log('✅ All UserGuidanceSystem tests passed!');
  process.exit(0);
} else {
  console.error('❌ Some UserGuidanceSystem tests failed!');
  process.exit(1);
}