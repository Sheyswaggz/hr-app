import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  CircularProgress,
  Link,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

/**
 * Login form data structure
 */
interface LoginFormData {
  email: string;
  password: string;
}

/**
 * Email validation regex pattern
 * Validates standard email format: user@domain.tld
 */
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Login Page Component
 * 
 * Provides user authentication interface with:
 * - Email and password form fields with validation
 * - Client-side validation using react-hook-form
 * - Loading state during authentication
 * - Error message display for failed login attempts
 * - Automatic redirect to dashboard on successful login
 * - Responsive Material-UI design
 * 
 * @component
 * @example
 * ```tsx
 * <Route path="/login" element={<LoginPage />} />
 * ```
 */
export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading: authLoading } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<LoginFormData>({
    mode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
    },
  });

  /**
   * Handles form submission and authentication
   * 
   * @param {LoginFormData} data - Form data containing email and password
   * 
   * Flow:
   * 1. Clear previous error messages
   * 2. Set loading state
   * 3. Call authentication service
   * 4. On success: redirect to dashboard
   * 5. On failure: display error message
   * 6. Always: clear loading state
   */
  const onSubmit = async (data: LoginFormData): Promise<void> => {
    try {
      setErrorMessage('');
      setIsSubmitting(true);

      console.log('[LoginPage] Attempting login:', { email: data.email });

      await login(data.email, data.password);

      console.log('[LoginPage] Login successful, redirecting to dashboard');
      
      navigate('/dashboard', { replace: true });
    } catch (error) {
      const errorMsg = error instanceof Error 
        ? error.message 
        : 'An unexpected error occurred. Please try again.';
      
      console.error('[LoginPage] Login failed:', {
        error: errorMsg,
        email: data.email,
      });

      setErrorMessage(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = authLoading || isSubmitting;

  return (
    <Container
      component="main"
      maxWidth="sm"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: { xs: 3, sm: 4, md: 5 },
          width: '100%',
          borderRadius: 2,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Typography
            component="h1"
            variant="h4"
            sx={{
              mb: 1,
              fontWeight: 600,
              color: 'primary.main',
            }}
          >
            HR Management System
          </Typography>
          
          <Typography
            component="h2"
            variant="h6"
            sx={{
              mb: 4,
              color: 'text.secondary',
            }}
          >
            Sign in to your account
          </Typography>

          {errorMessage && (
            <Alert
              severity="error"
              sx={{ width: '100%', mb: 3 }}
              onClose={() => setErrorMessage('')}
            >
              {errorMessage}
            </Alert>
          )}

          <Box
            component="form"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            sx={{ width: '100%' }}
          >
            <Controller
              name="email"
              control={control}
              rules={{
                required: 'Email is required',
                pattern: {
                  value: EMAIL_REGEX,
                  message: 'Please enter a valid email address',
                },
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  margin="normal"
                  required
                  fullWidth
                  id="email"
                  label="Email Address"
                  autoComplete="email"
                  autoFocus
                  error={!!errors.email}
                  helperText={errors.email?.message}
                  disabled={isLoading}
                  inputProps={{
                    'aria-label': 'Email Address',
                    'aria-required': 'true',
                    'aria-invalid': !!errors.email,
                  }}
                  sx={{ mb: 2 }}
                />
              )}
            />

            <Controller
              name="password"
              control={control}
              rules={{
                required: 'Password is required',
                minLength: {
                  value: 1,
                  message: 'Password is required',
                },
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  margin="normal"
                  required
                  fullWidth
                  name="password"
                  label="Password"
                  type="password"
                  id="password"
                  autoComplete="current-password"
                  error={!!errors.password}
                  helperText={errors.password?.message}
                  disabled={isLoading}
                  inputProps={{
                    'aria-label': 'Password',
                    'aria-required': 'true',
                    'aria-invalid': !!errors.password,
                  }}
                  sx={{ mb: 3 }}
                />
              )}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={!isValid || isLoading}
              sx={{
                py: 1.5,
                mb: 2,
                position: 'relative',
              }}
              aria-label="Sign in"
            >
              {isLoading ? (
                <>
                  <CircularProgress
                    size={24}
                    sx={{
                      position: 'absolute',
                      left: '50%',
                      marginLeft: '-12px',
                    }}
                    aria-label="Loading"
                  />
                  <span style={{ visibility: 'hidden' }}>Sign In</span>
                </>
              ) : (
                'Sign In'
              )}
            </Button>

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
              <Link
                href="#"
                variant="body2"
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  console.log('[LoginPage] Forgot password clicked');
                }}
                sx={{
                  textDecoration: 'none',
                  '&:hover': {
                    textDecoration: 'underline',
                  },
                }}
              >
                Forgot password?
              </Link>
            </Box>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default LoginPage;