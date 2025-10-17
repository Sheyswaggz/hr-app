/**
 * Material-UI Theme Configuration
 * 
 * Provides a custom MUI theme with:
 * - Primary color palette (blue)
 * - Secondary color palette (green)
 * - Typography settings
 * - Responsive breakpoints
 * - Component overrides for consistent styling
 * 
 * @module theme
 */

import { createTheme, ThemeOptions } from '@mui/material/styles';

/**
 * Custom breakpoint values for responsive design
 * - xs: 0px (mobile)
 * - sm: 600px (tablet portrait)
 * - md: 960px (tablet landscape)
 * - lg: 1280px (desktop)
 * - xl: 1920px (large desktop)
 */
const breakpoints = {
  values: {
    xs: 0,
    sm: 600,
    md: 960,
    lg: 1280,
    xl: 1920,
  },
};

/**
 * Primary color palette (blue)
 * Used for primary actions, links, and key UI elements
 */
const primaryPalette = {
  main: '#1976d2',
  light: '#42a5f5',
  dark: '#1565c0',
  contrastText: '#ffffff',
};

/**
 * Secondary color palette (green)
 * Used for secondary actions and complementary UI elements
 */
const secondaryPalette = {
  main: '#388e3c',
  light: '#66bb6a',
  dark: '#2e7d32',
  contrastText: '#ffffff',
};

/**
 * Typography configuration
 * Defines font families, sizes, weights, and line heights
 */
const typography = {
  fontFamily: [
    '-apple-system',
    'BlinkMacSystemFont',
    '"Segoe UI"',
    'Roboto',
    '"Helvetica Neue"',
    'Arial',
    'sans-serif',
    '"Apple Color Emoji"',
    '"Segoe UI Emoji"',
    '"Segoe UI Symbol"',
  ].join(','),
  h1: {
    fontSize: '2.5rem',
    fontWeight: 600,
    lineHeight: 1.2,
  },
  h2: {
    fontSize: '2rem',
    fontWeight: 600,
    lineHeight: 1.3,
  },
  h3: {
    fontSize: '1.75rem',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  h4: {
    fontSize: '1.5rem',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  h5: {
    fontSize: '1.25rem',
    fontWeight: 600,
    lineHeight: 1.5,
  },
  h6: {
    fontSize: '1rem',
    fontWeight: 600,
    lineHeight: 1.5,
  },
  subtitle1: {
    fontSize: '1rem',
    fontWeight: 500,
    lineHeight: 1.75,
  },
  subtitle2: {
    fontSize: '0.875rem',
    fontWeight: 500,
    lineHeight: 1.57,
  },
  body1: {
    fontSize: '1rem',
    fontWeight: 400,
    lineHeight: 1.5,
  },
  body2: {
    fontSize: '0.875rem',
    fontWeight: 400,
    lineHeight: 1.43,
  },
  button: {
    fontSize: '0.875rem',
    fontWeight: 500,
    lineHeight: 1.75,
    textTransform: 'none' as const,
  },
  caption: {
    fontSize: '0.75rem',
    fontWeight: 400,
    lineHeight: 1.66,
  },
  overline: {
    fontSize: '0.75rem',
    fontWeight: 400,
    lineHeight: 2.66,
    textTransform: 'uppercase' as const,
  },
};

/**
 * Spacing configuration
 * Base spacing unit is 8px
 */
const spacing = 8;

/**
 * Component overrides for consistent styling across the application
 */
const components = {
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        textTransform: 'none' as const,
        fontWeight: 500,
        padding: '8px 16px',
      },
      contained: {
        boxShadow: 'none',
        '&:hover': {
          boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
        },
      },
    },
  },
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 12,
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: {
        borderRadius: 8,
      },
      elevation1: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.08)',
      },
      elevation2: {
        boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          borderRadius: 8,
        },
      },
    },
  },
  MuiAppBar: {
    styleOverrides: {
      root: {
        boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  MuiDrawer: {
    styleOverrides: {
      paper: {
        borderRight: '1px solid rgba(0, 0, 0, 0.12)',
      },
    },
  },
  MuiTableCell: {
    styleOverrides: {
      root: {
        borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
      },
      head: {
        fontWeight: 600,
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
      },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: 16,
      },
    },
  },
  MuiAlert: {
    styleOverrides: {
      root: {
        borderRadius: 8,
      },
    },
  },
};

/**
 * Theme options configuration
 */
const themeOptions: ThemeOptions = {
  palette: {
    primary: primaryPalette,
    secondary: secondaryPalette,
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    text: {
      primary: 'rgba(0, 0, 0, 0.87)',
      secondary: 'rgba(0, 0, 0, 0.6)',
      disabled: 'rgba(0, 0, 0, 0.38)',
    },
    divider: 'rgba(0, 0, 0, 0.12)',
    error: {
      main: '#d32f2f',
      light: '#ef5350',
      dark: '#c62828',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#ed6c02',
      light: '#ff9800',
      dark: '#e65100',
      contrastText: '#ffffff',
    },
    info: {
      main: '#0288d1',
      light: '#03a9f4',
      dark: '#01579b',
      contrastText: '#ffffff',
    },
    success: {
      main: '#2e7d32',
      light: '#4caf50',
      dark: '#1b5e20',
      contrastText: '#ffffff',
    },
  },
  typography,
  spacing,
  breakpoints,
  components,
  shape: {
    borderRadius: 8,
  },
  shadows: [
    'none',
    '0px 2px 4px rgba(0, 0, 0, 0.08)',
    '0px 4px 8px rgba(0, 0, 0, 0.12)',
    '0px 6px 12px rgba(0, 0, 0, 0.16)',
    '0px 8px 16px rgba(0, 0, 0, 0.20)',
    '0px 10px 20px rgba(0, 0, 0, 0.24)',
    '0px 12px 24px rgba(0, 0, 0, 0.28)',
    '0px 14px 28px rgba(0, 0, 0, 0.32)',
    '0px 16px 32px rgba(0, 0, 0, 0.36)',
    '0px 18px 36px rgba(0, 0, 0, 0.40)',
    '0px 20px 40px rgba(0, 0, 0, 0.44)',
    '0px 22px 44px rgba(0, 0, 0, 0.48)',
    '0px 24px 48px rgba(0, 0, 0, 0.52)',
    '0px 26px 52px rgba(0, 0, 0, 0.56)',
    '0px 28px 56px rgba(0, 0, 0, 0.60)',
    '0px 30px 60px rgba(0, 0, 0, 0.64)',
    '0px 32px 64px rgba(0, 0, 0, 0.68)',
    '0px 34px 68px rgba(0, 0, 0, 0.72)',
    '0px 36px 72px rgba(0, 0, 0, 0.76)',
    '0px 38px 76px rgba(0, 0, 0, 0.80)',
    '0px 40px 80px rgba(0, 0, 0, 0.84)',
    '0px 42px 84px rgba(0, 0, 0, 0.88)',
    '0px 44px 88px rgba(0, 0, 0, 0.92)',
    '0px 46px 92px rgba(0, 0, 0, 0.96)',
    '0px 48px 96px rgba(0, 0, 0, 1.00)',
  ],
};

/**
 * Create and export the custom MUI theme
 * 
 * This theme provides:
 * - Consistent color palette across the application
 * - Responsive typography that scales with screen size
 * - Custom component styling for a cohesive look
 * - Accessible color contrasts meeting WCAG 2.1 AA standards
 * 
 * @example
 * ```tsx
 * import { ThemeProvider } from '@mui/material/styles';
 * import theme from './theme';
 * 
 * function App() {
 *   return (
 *     <ThemeProvider theme={theme}>
 *       <YourApp />
 *     </ThemeProvider>
 *   );
 * }
 * ```
 */
const theme = createTheme(themeOptions);

export default theme;