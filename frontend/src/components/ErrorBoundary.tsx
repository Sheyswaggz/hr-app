import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, Button, Box, Typography, Container } from '@mui/material';

/**
 * Props for the ErrorBoundary component
 */
interface ErrorBoundaryProps {
  /** Child components to be wrapped by the error boundary */
  children: ReactNode;
  /** Optional fallback UI to display when an error occurs */
  fallback?: (error: Error, errorInfo: ErrorInfo, retry: () => void) => ReactNode;
  /** Optional callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Optional flag to enable/disable error logging to console */
  logErrors?: boolean;
}

/**
 * State for the ErrorBoundary component
 */
interface ErrorBoundaryState {
  /** Whether an error has been caught */
  hasError: boolean;
  /** The caught error object */
  error: Error | null;
  /** Additional error information from React */
  errorInfo: ErrorInfo | null;
  /** Timestamp when the error occurred */
  errorTimestamp: Date | null;
  /** Number of times the component has been reset */
  resetCount: number;
}

/**
 * ErrorBoundary component for graceful error handling in React applications.
 * 
 * Catches JavaScript errors anywhere in the child component tree, logs errors,
 * and displays a fallback UI instead of crashing the entire application.
 * 
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 * 
 * @example With custom fallback
 * ```tsx
 * <ErrorBoundary
 *   fallback={(error, errorInfo, retry) => (
 *     <CustomErrorUI error={error} onRetry={retry} />
 *   )}
 *   onError={(error, errorInfo) => {
 *     logToExternalService(error, errorInfo);
 *   }}
 * >
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  /**
   * Default props for the ErrorBoundary component
   */
  static defaultProps: Partial<ErrorBoundaryProps> = {
    logErrors: true,
  };

  /**
   * Initialize the error boundary state
   */
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorTimestamp: null,
      resetCount: 0,
    };
  }

  /**
   * Static lifecycle method to update state when an error is caught.
   * This method is called during the "render" phase, so side effects are not permitted.
   * 
   * @param error - The error that was thrown
   * @returns Updated state object
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorTimestamp: new Date(),
    };
  }

  /**
   * Lifecycle method called after an error has been thrown by a descendant component.
   * This method is called during the "commit" phase, so side effects are permitted.
   * 
   * @param error - The error that was thrown
   * @param errorInfo - Object containing component stack trace
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Update state with error info
    this.setState({
      errorInfo,
    });

    // Log error to console if enabled
    if (this.props.logErrors) {
      this.logErrorToConsole(error, errorInfo);
    }

    // Call optional error callback
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (callbackError) {
        // Prevent callback errors from breaking the error boundary
        console.error('Error in ErrorBoundary onError callback:', callbackError);
      }
    }
  }

  /**
   * Log error details to the console with structured formatting
   * 
   * @param error - The error that was thrown
   * @param errorInfo - Object containing component stack trace
   */
  private logErrorToConsole(error: Error, errorInfo: ErrorInfo): void {
    const timestamp = new Date().toISOString();
    
    console.group(`%c🚨 Error Boundary Caught Error - ${timestamp}`, 'color: #d32f2f; font-weight: bold;');
    
    console.error('Error:', error);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    
    if (errorInfo.componentStack) {
      console.group('Component Stack:');
      console.error(errorInfo.componentStack);
      console.groupEnd();
    }
    
    console.groupEnd();
  }

  /**
   * Reset the error boundary state and attempt to re-render children
   */
  private handleReset = (): void => {
    this.setState((prevState) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      errorTimestamp: null,
      resetCount: prevState.resetCount + 1,
    }));
  };

  /**
   * Render the component
   */
  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    // If an error has been caught, render fallback UI
    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback && errorInfo) {
        return fallback(error, errorInfo, this.handleReset);
      }

      // Default fallback UI
      return (
        <Container maxWidth="md">
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '400px',
              py: 4,
            }}
          >
            <Alert
              severity="error"
              sx={{
                width: '100%',
                mb: 3,
              }}
            >
              <Typography variant="h6" component="div" gutterBottom>
                Something went wrong
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {error.message || 'An unexpected error occurred'}
              </Typography>
              {process.env.NODE_ENV === 'development' && errorInfo && (
                <Box
                  component="pre"
                  sx={{
                    mt: 2,
                    p: 2,
                    bgcolor: 'rgba(0, 0, 0, 0.05)',
                    borderRadius: 1,
                    overflow: 'auto',
                    maxHeight: '200px',
                    fontSize: '0.75rem',
                  }}
                >
                  {errorInfo.componentStack}
                </Box>
              )}
            </Alert>
            <Button
              variant="contained"
              color="primary"
              onClick={this.handleReset}
              sx={{ minWidth: 120 }}
            >
              Try Again
            </Button>
          </Box>
        </Container>
      );
    }

    // No error, render children normally
    return children;
  }
}

export default ErrorBoundary;
export { ErrorBoundary };
export type { ErrorBoundaryProps, ErrorBoundaryState };