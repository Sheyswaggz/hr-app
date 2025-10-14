# HR Application

![CI/CD Pipeline](https://github.com/YOUR_USERNAME/hr-app/workflows/CI%2FCD%20Pipeline/badge.svg)

A comprehensive Human Resources management application built with React, TypeScript, and Node.js, featuring modular architecture for employee management, onboarding, performance appraisals, leave management, and analytics.

## Features

- **Authentication & Authorization**: Secure JWT-based authentication with role-based access control
- **Employee Management**: Complete employee lifecycle management
- **Onboarding**: Streamlined onboarding workflows with task tracking
- **Performance Appraisals**: 360-degree feedback and goal management
- **Leave Management**: Leave request and approval workflows with balance tracking
- **Analytics & Reporting**: Comprehensive HR metrics and insights
- **Security**: Built-in security features including rate limiting, input validation, and SQL injection prevention

## Tech Stack

- **Frontend**: React 18, TypeScript, React Router, Vite
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL 16
- **Authentication**: JWT with bcrypt password hashing
- **Testing**: Vitest, React Testing Library
- **Code Quality**: ESLint, Prettier, Husky
- **CI/CD**: GitHub Actions

## Project Structure

```
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
```

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL 16

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/hr-app.git
cd hr-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Setup

Copy the example environment file and configure your environment variables:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/hr_app

# JWT Secrets
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-key-here

# Server
PORT=3000
NODE_ENV=development
```

### 4. Database Setup

Run database migrations:

```bash
npm run migrate:up
```

Seed the database (optional):

```bash
npm run db:seed
```

### 5. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Available Scripts

### Development

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally

### Testing

- `npm run test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report
- `npm run test:auth` - Run authentication-specific tests
- `npm run test:db` - Run database tests

### Code Quality

- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors automatically
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run type-check` - Run TypeScript type checking
- `npm run validate` - Run all quality checks (type-check, lint, format, test)

### Database

- `npm run migrate:up` - Run pending migrations
- `npm run migrate:down` - Rollback last migration
- `npm run migrate:create` - Create a new migration
- `npm run migrate:status` - Check migration status

### Utilities

- `npm run clean` - Clean build artifacts and cache

## CI/CD Pipeline

This project uses GitHub Actions for continuous integration and deployment. The pipeline automatically runs on every push and pull request to ensure code quality and reliability.

### Pipeline Overview

The CI/CD workflow includes the following stages:

1. **Change Detection**: Intelligently detects which parts of the codebase changed to optimize pipeline execution
2. **Install Dependencies**: Installs and caches npm dependencies for faster subsequent runs
3. **Lint**: Runs ESLint to ensure code quality and consistency
4. **Type Check**: Validates TypeScript types across the entire codebase
5. **Unit Tests**: Executes unit tests with coverage reporting
6. **Integration Tests**: Runs integration tests against a PostgreSQL database
7. **E2E Tests**: Performs end-to-end testing of critical user flows
8. **Database Tests**: Validates database migrations and schema
9. **Build**: Compiles the application for production
10. **Security Audit**: Scans dependencies for known vulnerabilities
11. **Coverage Report**: Aggregates test coverage from all test suites
12. **Deploy to Staging**: Automatically deploys successful builds from the main branch to staging

### Viewing Pipeline Results

- **GitHub Actions Tab**: View detailed logs and results at `https://github.com/YOUR_USERNAME/hr-app/actions`
- **Pull Request Checks**: Pipeline status is displayed on every pull request
- **Status Badge**: The badge at the top of this README shows the current pipeline status
- **Artifacts**: Test coverage reports and build artifacts are available for download from completed workflow runs

### Pipeline Features

- **Path-based Filtering**: Skips unnecessary jobs when only documentation or configuration files change
- **Dependency Caching**: Caches node_modules to speed up subsequent runs (typically 2-3x faster)
- **Parallel Execution**: Runs independent test suites in parallel for faster feedback
- **Security Scanning**: Automatically checks for critical and high-severity vulnerabilities
- **Automatic Deployment**: Successful builds on the main branch are automatically deployed to staging
- **Coverage Tracking**: Generates and uploads test coverage reports for all test types
- **Smart Concurrency**: Cancels in-progress runs when new commits are pushed to PRs

### Pipeline Performance

- **Typical Execution Time**: 6-8 minutes for full pipeline with all tests
- **Documentation-only Changes**: ~30 seconds (most jobs skipped)
- **Cache Hit Rate**: 90%+ for dependency installation
- **Deployment Time**: ~2 minutes to staging environment

### Deployment Process

**Staging Environment**:
- **Trigger**: Automatic on merge to `main` branch
- **URL**: https://staging.example.com
- **Requirements**: All tests must pass, no critical security vulnerabilities
- **Artifacts**: Build artifacts are uploaded and available for 7 days

**Production Environment**:
- **Trigger**: Manual approval required (see `.github/workflows/deploy-production.yml`)
- **Process**: Requires successful staging deployment and manual review

### Local Pipeline Testing

You can test the GitHub Actions workflow locally using [act](https://github.com/nektos/act):

```bash
# Install act (macOS)
brew install act

# List available workflows
act -l

# Run the CI workflow
act push

# Run specific job
act -j test-unit
```

### Pipeline Configuration

The pipeline configuration is located at `.github/workflows/ci.yml`. Key features include:

- Node.js version: 18
- PostgreSQL version: 16 (for integration/E2E tests)
- Test timeout: 30 seconds per test
- Artifact retention: 30 days for coverage, 7 days for builds

## Testing

The project includes comprehensive test coverage:

- **Unit Tests**: Test individual functions and components in isolation
- **Integration Tests**: Test API endpoints and database interactions
- **E2E Tests**: Test complete user workflows
- **Database Tests**: Validate migrations and schema integrity

### Running Tests

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm run test:auth
npm run test:db

# Watch mode for development
npm run test:watch
```

### Test Coverage

Test coverage reports are generated automatically and include:
- Line coverage
- Branch coverage
- Function coverage
- Statement coverage

Coverage reports are available in the `coverage/` directory after running tests with the `--coverage` flag.

## Code Quality

This project enforces strict code quality standards:

### ESLint

- TypeScript-specific rules
- React best practices
- Security rules
- Import/export validation
- Accessibility checks

### Prettier

- Consistent code formatting
- Automatic formatting on save (with editor integration)
- Pre-commit hooks ensure formatted code

### Husky & Lint-Staged

Pre-commit hooks automatically:
- Run ESLint on staged files
- Format code with Prettier
- Prevent commits with linting errors

## Security

Security is a top priority:

- **Authentication**: JWT-based with secure token storage
- **Password Hashing**: bcrypt with appropriate salt rounds
- **Input Validation**: Comprehensive validation on all inputs
- **SQL Injection Prevention**: Parameterized queries
- **Rate Limiting**: API rate limiting to prevent abuse
- **Security Headers**: Helmet.js for secure HTTP headers
- **Dependency Scanning**: Automated vulnerability scanning in CI/CD
- **HTTPS**: Enforced in production

## Database Migrations

Database schema changes are managed through migrations:

```bash
# Create a new migration
npm run migrate:create my_migration_name

# Run pending migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down

# Check migration status
npm run migrate:status
```

Migrations are located in the `migrations/` directory and are automatically run in CI/CD pipelines.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run quality checks (`npm run validate`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Pull Request Guidelines

- Ensure all tests pass
- Maintain or improve code coverage
- Follow existing code style and conventions
- Update documentation as needed
- Add tests for new features
- Keep commits atomic and well-described

## License

This project is licensed under UNLICENSED - see the LICENSE file for details.

## Support

For issues, questions, or contributions, please open an issue on GitHub.