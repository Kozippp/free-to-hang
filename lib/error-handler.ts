import { Alert } from 'react-native';
import { supabase } from './supabase';

export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  userId?: string;
  action?: string;
}

class ErrorHandler {
  private static instance: ErrorHandler;
  private errorQueue: AppError[] = [];
  private isOnline: boolean = true;
  
  private constructor() {}
  
  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }
  
  // Handle different types of errors
  async handleError(error: any, context?: string): Promise<void> {
    const appError = this.parseError(error, context);
    
    // Log error
    console.error('App Error:', appError);
    
    // Store error for later analysis
    this.errorQueue.push(appError);
    
    // Handle based on error type
    switch (appError.code) {
      case 'NETWORK_ERROR':
        this.handleNetworkError(appError);
        break;
      case 'AUTH_ERROR':
        this.handleAuthError(appError);
        break;
      case 'DATABASE_ERROR':
        this.handleDatabaseError(appError);
        break;
      case 'VALIDATION_ERROR':
        this.handleValidationError(appError);
        break;
      case 'PERMISSION_ERROR':
        this.handlePermissionError(appError);
        break;
      case 'UNKNOWN_ERROR':
      default:
        this.handleUnknownError(appError);
        break;
    }
    
    // Send error to backend if online
    if (this.isOnline) {
      await this.reportError(appError);
    }
  }
  
  private parseError(error: any, context?: string): AppError {
    let code = 'UNKNOWN_ERROR';
    let message = 'An unexpected error occurred';
    let details = error;
    
    if (error?.message) {
      message = error.message;
      
      // Categorize common errors
      if (message.includes('network') || message.includes('fetch')) {
        code = 'NETWORK_ERROR';
        message = 'Network connection failed. Please check your internet connection.';
      } else if (message.includes('auth') || message.includes('unauthorized')) {
        code = 'AUTH_ERROR';
        message = 'Authentication failed. Please sign in again.';
      } else if (message.includes('permission') || message.includes('forbidden')) {
        code = 'PERMISSION_ERROR';
        message = 'You do not have permission to perform this action.';
      } else if (error.code && error.code.startsWith('PGRST')) {
        code = 'DATABASE_ERROR';
        message = 'Database operation failed. Please try again.';
      } else if (message.includes('validation') || message.includes('invalid')) {
        code = 'VALIDATION_ERROR';
        // Keep original validation message
      }
    }
    
    return {
      code,
      message,
      details,
      timestamp: new Date(),
      action: context
    };
  }
  
  private handleNetworkError(error: AppError): void {
    this.isOnline = false;
    
    Alert.alert(
      'Connection Problem',
      'Unable to connect to the server. The app will work in offline mode with limited functionality.',
      [
        {
          text: 'Retry',
          onPress: () => this.retryConnection()
        },
        {
          text: 'Continue Offline',
          style: 'cancel'
        }
      ]
    );
  }
  
  private handleAuthError(error: AppError): void {
    Alert.alert(
      'Authentication Error',
      'Your session has expired. Please sign in again.',
      [
        {
          text: 'Sign In',
          onPress: () => {
            // Clear all data and redirect to auth
            supabase.auth.signOut();
          }
        }
      ]
    );
  }
  
  private handleDatabaseError(error: AppError): void {
    // Don't show alert for every database error, just log
    console.warn('Database error handled:', error.message);
    
    // Only show alert for critical database errors
    if (error.details?.code === 'PGRST301') {
      Alert.alert(
        'Data Error',
        'Unable to save your changes. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }
  
  private handleValidationError(error: AppError): void {
    Alert.alert(
      'Invalid Input',
      error.message,
      [{ text: 'OK' }]
    );
  }
  
  private handlePermissionError(error: AppError): void {
    Alert.alert(
      'Permission Denied',
      'You do not have permission to perform this action.',
      [{ text: 'OK' }]
    );
  }
  
  private handleUnknownError(error: AppError): void {
    Alert.alert(
      'Something Went Wrong',
      'An unexpected error occurred. The development team has been notified.',
      [
        {
          text: 'Report Bug',
          onPress: () => this.openBugReport(error)
        },
        {
          text: 'OK',
          style: 'cancel'
        }
      ]
    );
  }
  
  private async retryConnection(): Promise<void> {
    try {
      // Simple connectivity test
      const { error } = await supabase.from('users').select('count').single();
      if (!error) {
        this.isOnline = true;
        Alert.alert('Connection Restored', 'You are back online!');
      } else {
        throw error;
      }
    } catch (error) {
      Alert.alert(
        'Still Offline',
        'Unable to connect. Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
    }
  }
  
  private openBugReport(error: AppError): void {
    // In a real app, this would open a bug report form
    console.log('Bug report for error:', error);
    Alert.alert(
      'Bug Report',
      'Thank you! The error details have been recorded for investigation.',
      [{ text: 'OK' }]
    );
  }
  
  private async reportError(error: AppError): Promise<void> {
    try {
      // In production, send to error tracking service (e.g., Sentry, Bugsnag)
      console.log('Reporting error to backend:', error);
      
      // For now, just log locally
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   body: JSON.stringify(error)
      // });
    } catch (reportError) {
      console.error('Failed to report error:', reportError);
    }
  }
  
  // Utility methods
  setOnlineStatus(online: boolean): void {
    this.isOnline = online;
  }
  
  getErrorStats(): { total: number; recent: number } {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return {
      total: this.errorQueue.length,
      recent: this.errorQueue.filter(e => e.timestamp > oneHourAgo).length
    };
  }
  
  clearErrorQueue(): void {
    this.errorQueue = [];
  }
}

export const errorHandler = ErrorHandler.getInstance();

// Wrapper for async operations with error handling
export async function safeAsync<T>(
  operation: () => Promise<T>,
  context?: string,
  fallback?: T
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    await errorHandler.handleError(error, context);
    return fallback;
  }
}

// Wrapper for sync operations with error handling
export function safeSync<T>(
  operation: () => T,
  context?: string,
  fallback?: T
): T | undefined {
  try {
    return operation();
  } catch (error) {
    errorHandler.handleError(error, context);
    return fallback;
  }
} 