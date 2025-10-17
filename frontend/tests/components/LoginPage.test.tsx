import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { LoginPage } from '../../src/pages/LoginPage';
import { AuthContext } from '../../src/contexts/AuthContext';
import type { AuthContextType } from '../../src/types';

/**
 * Mock navigation function from react-router-dom
 */
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

/**
 * Test wrapper component that provides AuthContext
 */
interface TestWrapperProps {
  children: React.ReactNode;
  authContextValue?: Partial<AuthContextType>;
}

const TestWrapper: React.FC<TestWrapperProps> = ({ 
  children, 
  authContextValue = {} 
}) => {
  const defaultAuthContext: AuthContextType = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshAuth: vi.fn(),
    ...authContextValue,
  };

  return (
    <BrowserRouter>
      <AuthContext.Provider value={defaultAuthContext}>
        {children}
      </AuthContext.Provider>
    </BrowserRouter>
  );
};

/**
 * Helper function to render LoginPage with AuthContext
 */
const renderLoginPage = (authContextValue?: Partial<AuthContextType>) => {
  return render(
    <TestWrapper authContextValue={authContextValue}>
      <LoginPage />
    </TestWrapper>
  );
};

describe('LoginPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders login form with all required fields', () => {
      renderLoginPage();

      expect(screen.getByRole('heading', { name: /hr management system/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /sign in to your account/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('renders email field with correct attributes', () => {
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email address/i);
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('id', 'email');
      expect(emailInput).toHaveAttribute('aria-required', 'true');
      expect(emailInput).toHaveAttribute('autocomplete', 'email');
    });

    it('renders password field with correct attributes', () => {
      renderLoginPage();

      const passwordInput = screen.getByLabelText(/^password$/i);
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(passwordInput).toHaveAttribute('id', 'password');
      expect(passwordInput).toHaveAttribute('aria-required', 'true');
      expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
    });

    it('renders forgot password link', () => {
      renderLoginPage();

      const forgotPasswordLink = screen.getByText(/forgot password/i);
      expect(forgotPasswordLink).toBeInTheDocument();
      expect(forgotPasswordLink).toHaveAttribute('href', '#');
    });

    it('submit button is disabled initially', () => {
      renderLoginPage();

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Email Validation', () => {
    it('validates email format and shows error for invalid email', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);

      await user.type(emailInput, 'invalid-email');
      await user.type(passwordInput, 'password123');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });

      expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    });

    it('accepts valid email format', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);

      await user.type(emailInput, 'valid@example.com');
      await user.type(passwordInput, 'password123');

      await waitFor(() => {
        expect(emailInput).toHaveAttribute('aria-invalid', 'false');
      });

      expect(screen.queryByText(/please enter a valid email address/i)).not.toBeInTheDocument();
    });

    it('shows error for missing email', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email address/i);
      
      await user.click(emailInput);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      });
    });

    it('validates multiple invalid email formats', async () => {
      const user = userEvent.setup();
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user @example.com',
        'user@example',
      ];

      for (const invalidEmail of invalidEmails) {
        renderLoginPage();
        const emailInput = screen.getByLabelText(/email address/i);
        
        await user.type(emailInput, invalidEmail);
        await user.tab();

        await waitFor(() => {
          expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
        });

        // Clean up for next iteration
        vi.clearAllMocks();
      }
    });
  });

  describe('Required Field Validation', () => {
    it('shows error when email is empty', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email address/i);
      
      await user.click(emailInput);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      });
    });

    it('shows error when password is empty', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const passwordInput = screen.getByLabelText(/^password$/i);
      
      await user.click(passwordInput);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      });
    });

    it('submit button remains disabled when fields are invalid', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email address/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'invalid-email');

      expect(submitButton).toBeDisabled();
    });

    it('enables submit button when all fields are valid', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'valid@example.com');
      await user.type(passwordInput, 'password123');

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });
  });

  describe('Form Submission', () => {
    it('calls login function with correct credentials on submit', async () => {
      const user = userEvent.setup();
      const mockLogin = vi.fn().mockResolvedValue(undefined);
      
      renderLoginPage({ login: mockLogin });

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledTimes(1);
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('prevents submission when form is invalid', async () => {
      const user = userEvent.setup();
      const mockLogin = vi.fn();
      
      renderLoginPage({ login: mockLogin });

      const emailInput = screen.getByLabelText(/email address/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'invalid-email');
      
      expect(submitButton).toBeDisabled();
      
      await user.click(submitButton);

      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('can submit form by pressing Enter key', async () => {
      const user = userEvent.setup();
      const mockLogin = vi.fn().mockResolvedValue(undefined);
      
      renderLoginPage({ login: mockLogin });

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123{Enter}');

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when login fails', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Invalid credentials';
      const mockLogin = vi.fn().mockRejectedValue(new Error(errorMessage));
      
      renderLoginPage({ login: mockLogin });

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('displays generic error message for non-Error objects', async () => {
      const user = userEvent.setup();
      const mockLogin = vi.fn().mockRejectedValue('String error');
      
      renderLoginPage({ login: mockLogin });

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/an unexpected error occurred/i)).toBeInTheDocument();
      });
    });

    it('allows closing error message', async () => {
      const user = userEvent.setup();
      const mockLogin = vi.fn().mockRejectedValue(new Error('Login failed'));
      
      renderLoginPage({ login: mockLogin });

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });

    it('clears previous error on new submission', async () => {
      const user = userEvent.setup();
      const mockLogin = vi.fn()
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce(undefined);
      
      renderLoginPage({ login: mockLogin });

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('First error')).toBeInTheDocument();
      });

      await user.clear(passwordInput);
      await user.type(passwordInput, 'correctpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText('First error')).not.toBeInTheDocument();
      });
    });
  });

  describe('Success Redirect', () => {
    it('redirects to dashboard on successful login', async () => {
      const user = userEvent.setup();
      const mockLogin = vi.fn().mockResolvedValue(undefined);
      
      renderLoginPage({ login: mockLogin });

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
      });
    });

    it('does not redirect on failed login', async () => {
      const user = userEvent.setup();
      const mockLogin = vi.fn().mockRejectedValue(new Error('Login failed'));
      
      renderLoginPage({ login: mockLogin });

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner during authentication', async () => {
      const user = userEvent.setup();
      const mockLogin = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );
      
      renderLoginPage({ login: mockLogin });

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
      expect(submitButton).toBeDisabled();

      await waitFor(() => {
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      });
    });

    it('disables form fields during loading', async () => {
      const user = userEvent.setup();
      const mockLogin = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );
      
      renderLoginPage({ login: mockLogin });

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      expect(emailInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
      expect(submitButton).toBeDisabled();

      await waitFor(() => {
        expect(emailInput).not.toBeDisabled();
      });
    });

    it('respects isLoading from AuthContext', () => {
      renderLoginPage({ isLoading: true });

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      expect(emailInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
      expect(submitButton).toBeDisabled();
    });

    it('clears loading state after successful login', async () => {
      const user = userEvent.setup();
      const mockLogin = vi.fn().mockResolvedValue(undefined);
      
      renderLoginPage({ login: mockLogin });

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled();
      });

      expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
    });

    it('clears loading state after failed login', async () => {
      const user = userEvent.setup();
      const mockLogin = vi.fn().mockRejectedValue(new Error('Login failed'));
      
      renderLoginPage({ login: mockLogin });

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels on form fields', () => {
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);

      expect(emailInput).toHaveAttribute('aria-label', 'Email Address');
      expect(passwordInput).toHaveAttribute('aria-label', 'Password');
    });

    it('marks invalid fields with aria-invalid', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email address/i);
      
      await user.type(emailInput, 'invalid-email');
      await user.tab();

      await waitFor(() => {
        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('associates error messages with form fields', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      const emailInput = screen.getByLabelText(/email address/i);
      
      await user.type(emailInput, 'invalid-email');
      await user.tab();

      await waitFor(() => {
        const errorMessage = screen.getByText(/please enter a valid email address/i);
        expect(errorMessage).toBeInTheDocument();
      });
    });

    it('submit button has proper aria-label', () => {
      renderLoginPage();

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      expect(submitButton).toHaveAttribute('aria-label', 'Sign in');
    });
  });

  describe('Edge Cases', () => {
    it('handles rapid form submissions', async () => {
      const user = userEvent.setup();
      const mockLogin = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );
      
      renderLoginPage({ login: mockLogin });

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      
      await user.click(submitButton);
      await user.click(submitButton);
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledTimes(1);
      });
    });

    it('handles whitespace in email field', async () => {
      const user = userEvent.setup();
      const mockLogin = vi.fn().mockResolvedValue(undefined);
      
      renderLoginPage({ login: mockLogin });

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, '  test@example.com  ');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('  test@example.com  ', 'password123');
      });
    });

    it('handles special characters in password', async () => {
      const user = userEvent.setup();
      const mockLogin = vi.fn().mockResolvedValue(undefined);
      
      renderLoginPage({ login: mockLogin });

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      const specialPassword = 'P@ssw0rd!#$%^&*()';
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, specialPassword);
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', specialPassword);
      });
    });
  });
});