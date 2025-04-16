/**
 * User Guidance System - Progressive learning and guidance for ZK operations
 * 
 * This module implements a comprehensive user guidance system for zero-knowledge
 * operations, featuring progressive learning paths, contextual help, and
 * personalized recommendations based on user skill level and progression.
 * 
 * @module UserGuidanceSystem
 */

import zkErrorLoggerModule from '../zkErrorLogger.mjs';

// Get the singleton logger instance
const { zkErrorLogger } = zkErrorLoggerModule;

/**
 * Represents the difficulty level of a guidance step
 */
export enum GuidanceDifficulty {
    BEGINNER = 'beginner',
    INTERMEDIATE = 'intermediate',
    ADVANCED = 'advanced',
    EXPERT = 'expert'
}

/**
 * Interface for guidance steps
 */
export interface GuidanceStep {
    id: string;
    title: string;
    description: string;
    difficulty: GuidanceDifficulty;
    prerequisites: string[];
    content: string;
    position: number;
    isRequired: boolean;
}

/**
 * Interface for user progress tracking
 */
export interface UserProgress {
    userId: string;
    completedSteps: string[];
    currentStep?: string;
    skillLevel: GuidanceDifficulty;
    lastActivity: Date;
    preferredLearningPath?: string;
}

/**
 * Interface for guidance path definition
 */
export interface GuidancePath {
    id: string;
    name: string;
    description: string;
    targetAudience: GuidanceDifficulty;
    steps: string[]; // IDs of steps in sequence
}

/**
 * Class that manages user guidance through the ZK system
 * Provides step-by-step assistance, tracks user progress, and
 * recommends optimal learning paths based on user experience
 */
export class UserGuidanceSystem {
    private guidanceSteps: Map<string, GuidanceStep>;
    private userProgress: Map<string, UserProgress>;
    private guidancePaths: Map<string, GuidancePath>;
    private activeGuidance: Map<string, string[]>; // userId -> activeStepIds

    /**
     * Creates a new UserGuidanceSystem
     */
    constructor() {
        this.guidanceSteps = new Map<string, GuidanceStep>();
        this.userProgress = new Map<string, UserProgress>();
        this.guidancePaths = new Map<string, GuidancePath>();
        this.activeGuidance = new Map<string, string[]>();

        // Initialize with default guidance paths
        this.initializeDefaultPaths();
    }

    /**
     * Initializes default guidance paths
     * @private
     */
    private initializeDefaultPaths(): void {
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
            zkErrorLogger.log('ERROR', 'Failed to initialize default guidance paths', { error });
        }
    }

    /**
     * Displays guidance information to the user
     * @param userId - Unique identifier for the user
     * @param stepId - ID of the guidance step to show
     * @returns The guidance content or null if not found
     */
    public showGuidance(userId: string, stepId: string): GuidanceStep | null {
        try {
            if (!this.guidanceSteps.has(stepId)) {
                zkErrorLogger.log('WARNING', 'Guidance step not found', { userId, stepId });
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
            zkErrorLogger.log('ERROR', 'Error showing guidance', { userId, stepId, error });
            return null;
        }
    }

    /**
     * Dismisses active guidance for a user
     * @param userId - Unique identifier for the user
     * @param stepId - Optional ID of the specific guidance step to dismiss
     * @returns True if successfully dismissed, false otherwise
     */
    public dismissGuidance(userId: string, stepId?: string): boolean {
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
            zkErrorLogger.log('ERROR', 'Error dismissing guidance', { userId, stepId, error });
            return false;
        }
    }

    /**
     * Registers a new guidance step in the system
     * @param step - The guidance step to register
     * @returns True if successfully registered, false otherwise
     */
    public registerGuidanceStep(step: GuidanceStep): boolean {
        try {
            if (!step.id || this.guidanceSteps.has(step.id)) {
                zkErrorLogger.log('WARNING', 'Invalid step ID or step already exists', { stepId: step.id });
                return false;
            }

            this.guidanceSteps.set(step.id, step);
            return true;
        } catch (error) {
            zkErrorLogger.log('ERROR', 'Error registering guidance step', { step, error });
            return false;
        }
    }

    /**
     * Tracks user progress through the guidance system
     * @param userId - Unique identifier for the user
     * @param completedStepId - ID of the step the user completed
     * @returns Updated user progress object
     */
    public trackUserProgress(userId: string, completedStepId: string): UserProgress {
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
            zkErrorLogger.log('ERROR', 'Error tracking user progress', { userId, completedStepId, error });
            return {
                userId,
                completedSteps: [],
                skillLevel: GuidanceDifficulty.BEGINNER,
                lastActivity: new Date()
            };
        }
    }

    /**
     * Gets recommended guidance path based on user's progress and skill level
     * @param userId - Unique identifier for the user
     * @returns Recommended guidance path or null if not found
     */
    public getRecommendedPath(userId: string): GuidancePath | null {
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
            zkErrorLogger.log('ERROR', 'Error getting recommended path', { userId, error });
            return null;
        }
    }

    /**
     * Updates the user's current step
     * @param userId - Unique identifier for the user 
     * @param stepId - Current step ID
     * @private
     */
    private updateUserCurrentStep(userId: string, stepId: string): void {
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

    /**
     * Updates the user's skill level based on completed steps
     * @param progress - User progress object to update
     * @private
     */
    private updateUserSkillLevel(progress: UserProgress): void {
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

    /**
     * Finds a guidance path by difficulty level
     * @param difficulty - The difficulty level to search for
     * @returns Matching guidance path or null if not found
     * @private
     */
    private findPathByDifficulty(difficulty: GuidanceDifficulty): GuidancePath | null {
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