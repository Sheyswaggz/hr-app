# HR App

hr-app/
├── src/                    # Source code
│   ├── modules/           # Feature modules (modular architecture)
│   ├── shared/            # Shared utilities, components, and types
│   ├── config/            # Application configuration
│   └── main.tsx           # Application entry point
├── dist/                  # Production build output (generated)
├── node_modules/          # Dependencies (generated)
├── .husky/                # Git hooks (generated)
├── package.json           # Project dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── eslint.config.js       # ESLint configuration (flat config)
├── .prettierrc            # Prettier configuration
├── .prettierignore        # Prettier ignore patterns
├── .gitignore             # Git ignore patterns
└── README.md              # This file

## CI/CD Pipeline

[![CI/CD Pipeline](https://github.com/YOUR_USERNAME/hr-app/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/hr-app/actions/workflows/ci.yml)

This project uses GitHub Actions for continuous integration and deployment. Every code change is automatically tested, linted, and built to ensure code quality and reliability.

### Pipeline Overview

The CI/CD pipeline runs automatically on:
- **Push events** to `main` and `develop` branches
- **Pull requests** targeting `main` and `develop` branches
- **Manual triggers** via workflow dispatch

### Pipeline Stages

The pipeline includes the following stages:

1. **Change Detection** - Identifies which parts of the codebase changed to optimize execution
2. **Install Dependencies** - Installs npm packages with intelligent caching
3. **Lint** - Runs ESLint and Prettier to enforce code quality standards
4. **Type Check** - Validates TypeScript types across the codebase
5. **Unit Tests** - Executes unit tests for individual components
6. **Integration Tests** - Runs integration tests with PostgreSQL database
7. **E2E Tests** - Performs end-to-end testing of complete workflows
8. **Test Coverage** - Generates and uploads code coverage reports
9. **Build** - Compiles the application for production
10. **Security Scan** - Runs npm audit to detect dependency vulnerabilities
11. **Deploy to Staging** - Automatically deploys successful builds from `main` branch to staging environment

### Viewing Pipeline Results

You can view the status and results of pipeline runs in several ways:

- **GitHub Actions Tab**: Navigate to the [Actions tab](https://github.com/YOUR_USERNAME/hr-app/actions) in the repository to see all workflow runs
- **Pull Request Checks**: Pipeline status is displayed directly on pull requests with detailed check results
- **Commit Status**: Each commit shows a status indicator (✓ or ✗) linking to the pipeline run
- **Artifacts**: Test coverage reports and build artifacts are available for download from completed workflow runs

### Pipeline Features

- **Path-based Filtering**: Only runs relevant jobs based on changed files (e.g., skips tests if only documentation changed)
- **Dependency Caching**: Caches `node_modules` to speed up subsequent runs
- **Parallel Execution**: Runs independent jobs in parallel for faster feedback
- **Concurrency Control**: Automatically cancels outdated pipeline runs for pull requests
- **Test Database**: Spins up PostgreSQL containers for integration and E2E tests
- **Coverage Reports**: Generates and stores test coverage reports as artifacts
- **Security Scanning**: Automatically audits dependencies for known vulnerabilities

### Deployment Process

**Staging Environment:**
- Automatic deployment occurs when code is merged to the `main` branch
- All pipeline stages must pass before deployment
- Staging URL: `https://staging.hr-app.example.com`
- Deployment artifacts include compiled application and dependencies

**Production Environment:**
- Production deployments are managed through a separate workflow
- Requires manual approval and additional verification steps
- See `.github/workflows/deploy-production.yml` for production deployment configuration

### Local Development

To run the same checks locally before pushing: