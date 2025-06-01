/**
 * Password Validation Shim for Frontend
 * 
 * This provides a compatible interface with the common password validation
 * module for the frontend environment.
 * 
 * This implementation mirrors @proof-of-funds/common/src/auth/passwordValidation.ts
 * but is adapted for the frontend environment.
 */

/**
 * Default validation options
 */
const DEFAULT_OPTIONS = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecial: true,
  minStrength: 2,
  forbidCommonPatterns: true,
};

/**
 * Common weak passwords to check against
 */
const COMMON_PASSWORDS = [
  'password',
  '123456',
  '12345678',
  'qwerty',
  'admin',
  'welcome',
  'letmein',
];

/**
 * Password strength scoring
 * @param {string} password - Password to score
 * @returns {number} Strength score (0-3)
 */
function scorePasswordStrength(password) {
  if (!password) return 0;
  
  let score = 0;
  
  // Length-based scoring
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  
  // Complexity scoring
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  
  // Add 0.25 for each complexity criteria met
  let complexityScore = 0;
  if (hasUppercase) complexityScore += 0.25;
  if (hasLowercase) complexityScore += 0.25;
  if (hasNumber) complexityScore += 0.25;
  if (hasSpecial) complexityScore += 0.25;
  
  // Add complexity score (rounded to nearest integer)
  score += Math.round(complexityScore);
  
  // Ensure the score is between 0-3
  return Math.min(Math.max(score, 0), 3);
}

/**
 * Validate password requirements
 * @param {string} password - Password to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result with detailed information
 */
function validatePassword(
  password,
  options = DEFAULT_OPTIONS
) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors = [];
  
  // Check password requirements
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  
  // Create requirements object for easy checking in UI
  const requirements = {
    minLength: password.length >= (opts.minLength || 8),
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecial,
  };
  
  // Check minimum length
  if (opts.minLength && password.length < opts.minLength) {
    errors.push(`Password must be at least ${opts.minLength} characters long`);
  }
  
  // Check character requirements
  if (opts.requireUppercase && !hasUppercase) {
    errors.push('Password must include at least one uppercase letter');
  }
  
  if (opts.requireLowercase && !hasLowercase) {
    errors.push('Password must include at least one lowercase letter');
  }
  
  if (opts.requireNumbers && !hasNumber) {
    errors.push('Password must include at least one number');
  }
  
  if (opts.requireSpecial && !hasSpecial) {
    errors.push('Password must include at least one special character');
  }
  
  // Check common password patterns
  if (opts.forbidCommonPatterns) {
    // Check against common passwords list
    if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
      errors.push('Password is too common and easily guessed');
    }
    
    // Check for sequential patterns
    const sequentialPatterns = ['123', 'abc', 'qwe', 'asd', 'zxc'];
    for (const pattern of sequentialPatterns) {
      if (password.toLowerCase().includes(pattern)) {
        errors.push('Password contains a common sequential pattern');
        break;
      }
    }
    
    // Check for repeated characters (more than 2 in a row)
    if (/(.)\1{2,}/.test(password)) {
      errors.push('Password contains too many repeated characters');
    }
  }
  
  // Calculate strength score
  const strength = scorePasswordStrength(password);
  
  // Check if minimum strength is met
  if (opts.minStrength !== undefined && strength < opts.minStrength) {
    errors.push(`Password strength is too weak (${strength}/${opts.minStrength})`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    strength,
    requirements,
  };
}

/**
 * Get human-readable description of password strength
 * @param {number} strength - Strength score (0-3)
 * @returns {string} Human-readable strength description
 */
function getPasswordStrengthDescription(strength) {
  switch (strength) {
    case 0:
      return 'Weak';
    case 1:
      return 'Fair';
    case 2:
      return 'Good';
    case 3:
      return 'Strong';
    default:
      return 'Unknown';
  }
}

/**
 * Determine if a password meets minimum security requirements
 * @param {string} password - Password to check
 * @returns {boolean} Whether the password meets minimum requirements
 */
function isPasswordSecure(password) {
  const result = validatePassword(password);
  return result.isValid;
}

module.exports = {
  validatePassword,
  scorePasswordStrength,
  getPasswordStrengthDescription,
  isPasswordSecure,
};