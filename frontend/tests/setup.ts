import '@testing-library/jest-dom';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

/**
 * Mock Service Worker (MSW) server for API mocking in tests
 * Intercepts HTTP requests and provides mock responses
 */
export const server = setupServer(
  // Default handlers - can be overridden in individual tests
  http.post('/api/auth/login', () => {
    return HttpResponse.json({
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'EMPLOYEE',
        firstName: 'Test',
        lastName: 'User',
      },
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    });
  }),

  http.post('/api/auth/refresh', () => {
    return HttpResponse.json({
      accessToken: 'mock-new-access-token',
      refreshToken: 'mock-new-refresh-token',
    });
  }),

  http.post('/api/auth/logout', () => {
    return HttpResponse.json({ message: 'Logged out successfully' });
  }),

  http.get('/api/auth/me', () => {
    return HttpResponse.json({
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'EMPLOYEE',
      firstName: 'Test',
      lastName: 'User',
    });
  }),

  // Onboarding endpoints
  http.get('/api/onboarding/tasks', () => {
    return HttpResponse.json({
      data: [
        {
          id: 'task-1',
          title: 'Complete Profile',
          description: 'Fill in your personal information',
          status: 'PENDING',
          dueDate: new Date('2025-12-31').toISOString(),
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
    });
  }),

  // Leave endpoints
  http.get('/api/leave/requests', () => {
    return HttpResponse.json({
      data: [
        {
          id: 'leave-1',
          type: 'ANNUAL',
          startDate: new Date('2025-01-15').toISOString(),
          endDate: new Date('2025-01-20').toISOString(),
          status: 'PENDING',
          reason: 'Vacation',
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
    });
  }),

  http.get('/api/leave/balance', () => {
    return HttpResponse.json({
      annual: 15,
      sick: 10,
      casual: 5,
      annualUsed: 5,
      sickUsed: 2,
      casualUsed: 1,
    });
  }),

  // Appraisal endpoints
  http.get('/api/appraisals', () => {
    return HttpResponse.json({
      data: [
        {
          id: 'appraisal-1',
          employeeId: 'test-user-id',
          reviewPeriodStart: new Date('2025-01-01').toISOString(),
          reviewPeriodEnd: new Date('2025-12-31').toISOString(),
          status: 'IN_PROGRESS',
          overallRating: null,
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
    });
  }),
);

/**
 * Setup MSW server before all tests
 * Starts intercepting HTTP requests
 */
beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'warn',
  });
});

/**
 * Reset handlers after each test
 * Ensures test isolation by clearing any runtime request handlers
 */
afterEach(() => {
  server.resetHandlers();
  
  // Clear localStorage to prevent state leakage between tests
  if (typeof window !== 'undefined') {
    window.localStorage.clear();
    window.sessionStorage.clear();
  }
});

/**
 * Cleanup after all tests
 * Stops the MSW server and releases resources
 */
afterAll(() => {
  server.close();
});

/**
 * Global test utilities
 */
declare global {
  interface Window {
    msw: {
      server: typeof server;
    };
  }
}

// Expose server to window for debugging in tests
if (typeof window !== 'undefined') {
  window.msw = { server };
}

/**
 * Mock IntersectionObserver for components that use it
 * Required for Material-UI components that implement virtual scrolling
 */
if (typeof window !== 'undefined' && !window.IntersectionObserver) {
  window.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    takeRecords() {
      return [];
    }
    unobserve() {}
  } as any;
}

/**
 * Mock ResizeObserver for responsive components
 * Required for Material-UI components that respond to size changes
 */
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    unobserve() {}
  } as any;
}

/**
 * Mock matchMedia for responsive design tests
 * Allows testing of media query dependent behavior
 */
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    }),
  });
}

/**
 * Suppress console errors in tests for expected errors
 * Prevents test output pollution while still catching unexpected errors
 */
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args: any[]) => {
    // Suppress React error boundary errors in tests
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Error: Uncaught') ||
        args[0].includes('The above error occurred'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args: any[]) => {
    // Suppress known warnings
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('ReactDOM.render') ||
        args[0].includes('findDOMNode'))
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

/**
 * Custom matchers for testing
 * Extends jest-dom matchers with additional assertions
 */
export const customMatchers = {
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be within range ${floor} - ${ceiling}`
          : `expected ${received} to be within range ${floor} - ${ceiling}`,
    };
  },
};

/**
 * Test data factories for consistent test data generation
 */
export const testDataFactory = {
  user: (overrides?: Partial<any>) => ({
    id: 'test-user-id',
    email: 'test@example.com',
    role: 'EMPLOYEE',
    firstName: 'Test',
    lastName: 'User',
    createdAt: new Date('2025-01-01').toISOString(),
    updatedAt: new Date('2025-01-01').toISOString(),
    ...overrides,
  }),

  employee: (overrides?: Partial<any>) => ({
    id: 'test-employee-id',
    userId: 'test-user-id',
    employeeNumber: 'EMP001',
    department: 'Engineering',
    position: 'Software Engineer',
    hireDate: new Date('2025-01-01').toISOString(),
    status: 'ACTIVE',
    ...overrides,
  }),

  leaveRequest: (overrides?: Partial<any>) => ({
    id: 'leave-request-id',
    employeeId: 'test-employee-id',
    type: 'ANNUAL',
    startDate: new Date('2025-01-15').toISOString(),
    endDate: new Date('2025-01-20').toISOString(),
    status: 'PENDING',
    reason: 'Vacation',
    daysCount: 5,
    createdAt: new Date('2025-01-01').toISOString(),
    updatedAt: new Date('2025-01-01').toISOString(),
    ...overrides,
  }),

  onboardingTask: (overrides?: Partial<any>) => ({
    id: 'task-id',
    employeeId: 'test-employee-id',
    title: 'Complete Profile',
    description: 'Fill in your personal information',
    status: 'PENDING',
    dueDate: new Date('2025-12-31').toISOString(),
    createdAt: new Date('2025-01-01').toISOString(),
    updatedAt: new Date('2025-01-01').toISOString(),
    ...overrides,
  }),

  appraisal: (overrides?: Partial<any>) => ({
    id: 'appraisal-id',
    employeeId: 'test-employee-id',
    managerId: 'manager-id',
    reviewPeriodStart: new Date('2025-01-01').toISOString(),
    reviewPeriodEnd: new Date('2025-12-31').toISOString(),
    status: 'IN_PROGRESS',
    overallRating: null,
    createdAt: new Date('2025-01-01').toISOString(),
    updatedAt: new Date('2025-01-01').toISOString(),
    ...overrides,
  }),
};

/**
 * Utility to wait for async operations in tests
 */
export const waitForAsync = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Utility to create mock API responses
 */
export const createMockResponse = <T>(data: T, status = 200) => {
  return HttpResponse.json(data, { status });
};

/**
 * Utility to create mock error responses
 */
export const createMockErrorResponse = (
  message: string,
  status = 400,
  code?: string
) => {
  return HttpResponse.json(
    {
      error: message,
      code: code || 'ERROR',
      timestamp: new Date().toISOString(),
    },
    { status }
  );
};