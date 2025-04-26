// Type definition for zkErrorLogger.mjs

export class ZKErrorLogger {
  constructor(options?: any);
  
  log(level: string, message: string, metadata?: any): void;
  info(message: string, metadata?: any): void;
  error(message: string, metadata?: any): void;
  warn(message: string, metadata?: any): void;
  debug(message: string, metadata?: any): void;
  
  // Add any other methods and properties here
}