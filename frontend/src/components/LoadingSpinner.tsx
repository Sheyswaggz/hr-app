import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * Props for the LoadingSpinner component
 */
interface LoadingSpinnerProps {
  /**
   * Optional loading message to display below the spinner
   */
  text?: string;
  /**
   * Size of the spinner in pixels
   * @default 40
   */
  size?: number;
  /**
   * Color of the spinner
   * @default 'primary'
   */
  color?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' | 'inherit';
  /**
   * Full height container (100vh)
   * @default false
   */
  fullHeight?: boolean;
}

/**
 * Reusable loading spinner component with centered layout
 * 
 * Displays a Material-UI CircularProgress indicator centered in its container
 * with an optional loading message below it.
 * 
 * @example
 * ```tsx
 * <LoadingSpinner text="Loading data..." />
 * ```
 * 
 * @example
 * ```tsx
 * <LoadingSpinner size={60} color="secondary" />
 * ```
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  text,
  size = 40,
  color = 'primary',
  fullHeight = false,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: fullHeight ? '100vh' : '200px',
        width: '100%',
        gap: 2,
      }}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <CircularProgress
        size={size}
        color={color}
        aria-label={text || 'Loading'}
      />
      {text && (
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{
            textAlign: 'center',
            maxWidth: '80%',
          }}
        >
          {text}
        </Typography>
      )}
    </Box>
  );
};

export default LoadingSpinner;