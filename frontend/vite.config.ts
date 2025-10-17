import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vite Configuration for HR App Frontend
 * 
 * This configuration provides:
 * - React plugin with Fast Refresh for optimal development experience
 * - Path alias (@) for clean imports from src directory
 * - Development server on port 5173 with API proxy to backend
 * - Production build optimization with code splitting and asset handling
 * - Environment variable support with VITE_ prefix
 * - TypeScript support with strict type checking
 */
export default defineConfig({
  // React plugin with Fast Refresh enabled
  plugins: [
    react({
      // Enable Fast Refresh for instant feedback during development
      fastRefresh: true,
      // Babel configuration for JSX runtime
      babel: {
        plugins: [],
      },
    }),
  ],

  // Module resolution configuration
  resolve: {
    // Path alias for cleaner imports: @/components instead of ../../components
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // File extensions to resolve
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
  },

  // Development server configuration
  server: {
    // Port for development server
    port: 5173,
    // Automatically open browser on server start
    open: false,
    // Enable CORS for development
    cors: true,
    // Strict port - fail if port is already in use
    strictPort: false,
    // Host configuration - listen on all addresses
    host: true,
    
    // API proxy configuration to backend server
    proxy: {
      '/api': {
        // Backend server URL
        target: 'http://localhost:3000',
        // Change origin header to target URL
        changeOrigin: true,
        // Enable secure connections (set to false for self-signed certs in dev)
        secure: false,
        // WebSocket support for real-time features
        ws: true,
        // Configure proxy behavior
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.error('[Proxy Error]', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('[Proxy Request]', req.method, req.url, '->', proxyReq.path);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('[Proxy Response]', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },

  // Build configuration for production
  build: {
    // Output directory for production build
    outDir: 'dist',
    // Assets directory within outDir
    assetsDir: 'assets',
    // Generate source maps for production debugging
    sourcemap: true,
    // Target browsers for build output
    target: 'es2020',
    // Minification using esbuild (faster than terser)
    minify: 'esbuild',
    // Chunk size warning limit (500 KB)
    chunkSizeWarningLimit: 500,
    // CSS code splitting
    cssCodeSplit: true,
    // Report compressed size (may slow down build)
    reportCompressedSize: true,
    
    // Rollup-specific options
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // React core libraries
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Material-UI components
          'mui-vendor': ['@mui/material', '@emotion/react', '@emotion/styled'],
          // Form handling
          'form-vendor': ['react-hook-form'],
          // HTTP client
          'http-vendor': ['axios'],
        },
        
        // Asset file naming patterns
        assetFileNames: (assetInfo) => {
          // Organize assets by type
          const info = assetInfo.name?.split('.') || [];
          const ext = info[info.length - 1];
          
          // Images
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return 'assets/images/[name]-[hash][extname]';
          }
          
          // Fonts
          if (/woff|woff2|eot|ttf|otf/i.test(ext)) {
            return 'assets/fonts/[name]-[hash][extname]';
          }
          
          // CSS files
          if (ext === 'css') {
            return 'assets/css/[name]-[hash][extname]';
          }
          
          // Other assets
          return 'assets/[name]-[hash][extname]';
        },
        
        // JavaScript chunk naming
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
    },
    
    // Esbuild options for minification
    esbuildOptions: {
      // Drop console and debugger statements in production
      drop: ['console', 'debugger'],
      // Legal comments handling
      legalComments: 'none',
    },
  },

  // Environment variable configuration
  envPrefix: 'VITE_',
  
  // Define global constants
  define: {
    // Ensure process.env is available for compatibility
    'process.env': {},
    // Application version from package.json
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
  },

  // Dependency optimization
  optimizeDeps: {
    // Pre-bundle these dependencies for faster dev server startup
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@mui/material',
      '@emotion/react',
      '@emotion/styled',
      'axios',
      'react-hook-form',
    ],
    // Exclude these from pre-bundling
    exclude: [],
    // Force optimization even if cached
    force: false,
  },

  // Preview server configuration (for testing production build)
  preview: {
    port: 4173,
    strictPort: false,
    host: true,
    open: false,
    // Use same proxy configuration as dev server
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  // CSS configuration
  css: {
    // CSS modules configuration
    modules: {
      // Class name generation pattern
      generateScopedName: '[name]__[local]___[hash:base64:5]',
      // Hash prefix for CSS modules
      hashPrefix: 'hr-app',
    },
    // PostCSS configuration (if needed)
    postcss: {},
    // CSS preprocessor options
    preprocessorOptions: {},
  },

  // JSON configuration
  json: {
    // Generate named exports for JSON files
    namedExports: true,
    // Stringify JSON imports
    stringify: false,
  },

  // ESBuild configuration
  esbuild: {
    // JSX factory
    jsxFactory: 'React.createElement',
    // JSX fragment
    jsxFragment: 'React.Fragment',
    // JSX inject (automatic with React 17+)
    jsxInject: undefined,
  },

  // Worker configuration
  worker: {
    format: 'es',
    plugins: [],
  },

  // Log level for build output
  logLevel: 'info',

  // Clear screen on rebuild
  clearScreen: true,

  // App type
  appType: 'spa',
});