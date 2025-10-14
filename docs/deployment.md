# Deployment Guide

## Table of Contents
- [Overview](#overview)
- [CI/CD Pipeline Architecture](#cicd-pipeline-architecture)
- [Deployment Environments](#deployment-environments)
- [Automated Deployment Process](#automated-deployment-process)
- [Manual Deployment](#manual-deployment)
- [Rollback Procedures](#rollback-procedures)
- [Secrets Management](#secrets-management)
- [Troubleshooting](#troubleshooting)
- [Monitoring and Alerts](#monitoring-and-alerts)

---

## Overview

This document provides comprehensive guidance for deploying the HR Application using our automated CI/CD pipeline powered by GitHub Actions. The deployment process is designed to ensure reliability, security, and rapid delivery of features to production.

### Key Features
- **Automated Testing**: Every code change is validated through unit, integration, and E2E tests
- **Security Scanning**: Automated dependency audits and vulnerability checks
- **Path-Based Optimization**: Intelligent job execution based on changed files
- **Caching Strategy**: Optimized build times through dependency caching
- **Environment Isolation**: Separate staging and production environments
- **Rollback Capability**: Quick recovery from failed deployments

### Prerequisites
- Node.js >= 18.0.0
- PostgreSQL 16
- GitHub repository with Actions enabled
- Access to deployment environments (staging/production)

---

## CI/CD Pipeline Architecture

### Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         GitHub Actions                          │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │   Trigger    │───▶│   Changes    │───▶│   Install    │    │
│  │ (Push/PR)    │    │  Detection   │    │ Dependencies │    │
│  └──────────────┘    └──────────────┘    └──────────────┘    │
│                                                  │              │
│                           ┌──────────────────────┴─────────┐   │
│                           ▼                                ▼   │
│                    ┌──────────────┐              ┌──────────┐  │
│                    │     Lint     │              │   Type   │  │
│                    │              │              │  Check   │  │
│                    └──────────────┘              └──────────┘  │
│                           │                                │   │
│                           └──────────────┬─────────────────┘   │
│                                          ▼                     │
│                           ┌──────────────────────────┐         │
│                           │         Tests            │         │
│                           │  ┌────────────────────┐  │         │
│                           │  │  Unit Tests        │  │         │
│                           │  │  Integration Tests │  │         │
│                           │  │  E2E Tests         │  │         │
│                           │  │  Database Tests    │  │         │
│                           │  └────────────────────┘  │         │
│                           └──────────────────────────┘         │
│                                          │                     │
│                           ┌──────────────┴─────────────┐       │
│                           ▼                            ▼       │
│                    ┌──────────────┐         ┌──────────────┐  │
│                    │    Build     │         │   Security   │  │
│                    │ Application  │         │    Audit     │  │
│                    └──────────────┘         └──────────────┘  │
│                           │                            │       │
│                           └──────────────┬─────────────┘       │
│                                          ▼                     │
│                           ┌──────────────────────────┐         │
│                           │   Deploy to Staging      │         │
│                           │   (main branch only)     │         │
│                           └──────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### Workflow Files

#### 1. Main CI/CD Pipeline (`.github/workflows/ci.yml`)

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches
- Manual workflow dispatch

**Jobs:**
1. **Changes Detection**: Identifies modified files to optimize job execution
2. **Install Dependencies**: Installs and caches npm packages
3. **Lint**: Runs ESLint with zero warnings tolerance
4. **Type Check**: Validates TypeScript compilation
5. **Unit Tests**: Executes unit tests with coverage reporting
6. **Integration Tests**: Runs integration tests with PostgreSQL service
7. **E2E Tests**: Executes end-to-end test scenarios
8. **Database Tests**: Validates database migrations and schema
9. **Build**: Compiles TypeScript and creates production bundle
10. **Security Audit**: Scans dependencies for vulnerabilities
11. **Coverage Report**: Aggregates test coverage from all test suites
12. **Deploy to Staging**: Deploys to staging environment (main branch only)
13. **Summary**: Generates pipeline execution summary

**Execution Time:** Typically 5-8 minutes for full pipeline

#### 2. Production Deployment (`.github/workflows/deploy-production.yml`)

**Trigger:** Manual workflow dispatch only (requires approval)

**Input Parameters:**
- `version`: Version to deploy (semver tag or commit SHA)
- `rollback`: Flag to rollback to previous version
- `skip_tests`: Emergency flag to skip pre-deployment tests

**Jobs:**
1. **Validate**: Validates deployment request and prerequisites
2. **Pre-Deployment Tests**: Runs critical test suite
3. **Build Image**: Creates and pushes Docker image
4. **Backup Production**: Creates database and configuration backups
5. **Deploy Production**: Deploys to production environment
6. **Verify Deployment**: Runs health checks and smoke tests
7. **Rollback**: Automatic rollback on failure
8. **Finalize**: Updates deployment status and notifications

**Execution Time:** Typically 10-15 minutes for full deployment

### Path-Based Filtering

The pipeline uses intelligent path filtering to skip unnecessary jobs:

```yaml
# Example: Skip tests if only documentation changed
paths-ignore:
  - '**.md'
  - 'docs/**'
  - '.gitignore'
  - '.prettierignore'
  - '.prettierrc'
```

**Optimization Benefits:**
- Documentation changes: ~2 minutes (vs 8 minutes full pipeline)
- Configuration changes: Runs only affected jobs
- Code changes: Full pipeline execution

### Caching Strategy

**Node Modules Cache:**
```yaml
cache-key: v1-${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

**Cache Benefits:**
- First run: ~2 minutes for dependency installation
- Cached run: ~10 seconds for dependency restoration
- Cache hit rate: Typically 85-90%

**Cache Invalidation:**
- Automatic when `package-lock.json` changes
- Manual via cache version bump (`CACHE_VERSION`)

---

## Deployment Environments

### Environment Configuration

| Environment | URL | Purpose | Auto-Deploy | Approval Required |
|------------|-----|---------|-------------|-------------------|
| **Development** | `http://localhost:3000` | Local development | No | No |
| **Staging** | `https://staging.example.com` | Pre-production testing | Yes (main branch) | No |
| **Production** | `https://production.example.com` | Live application | No | Yes |

### Staging Environment

**Purpose:** Pre-production validation and testing

**Characteristics:**
- Mirrors production configuration
- Uses separate database instance
- Automated deployment on main branch merge
- No approval required
- Suitable for QA and stakeholder review

**Deployment Trigger:**
```yaml
if: |
  github.ref == 'refs/heads/main' && 
  github.event_name == 'push' &&
  needs.build.result == 'success'
```

**Access:**
- Available to all team members
- No authentication required for internal access
- Rate limiting enabled

### Production Environment

**Purpose:** Live application serving end users

**Characteristics:**
- Manual deployment only
- Requires approval from authorized personnel
- Comprehensive pre-deployment validation
- Automatic backup before deployment
- Rollback capability enabled

**Deployment Trigger:**
```yaml
on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to deploy'
        required: true
```

**Access:**
- Restricted to production administrators
- Full authentication and authorization
- Enhanced monitoring and alerting

### Environment Variables

**Required Secrets (GitHub Secrets):**

```bash
# Database Configuration
DATABASE_URL                    # PostgreSQL connection string
PRODUCTION_DATABASE_URL         # Production database connection string

# Authentication
JWT_SECRET                      # JWT signing secret (min 32 chars)
JWT_REFRESH_SECRET             # Refresh token secret (min 32 chars)

# Deployment
PRODUCTION_DEPLOY_KEY          # SSH key or deployment token
STAGING_DEPLOY_KEY             # Staging deployment credentials

# Monitoring (Optional)
SENTRY_DSN                     # Error tracking
DATADOG_API_KEY               # Metrics and monitoring
```

**Environment-Specific Configuration:**

```bash
# Staging
NODE_ENV=staging
PORT=3000
LOG_LEVEL=debug
ENABLE_METRICS=true

# Production
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
ENABLE_METRICS=true
RATE_LIMIT_ENABLED=true
```

---

## Automated Deployment Process

### Staging Deployment Flow

**1. Code Merge to Main Branch**
```bash
git checkout main
git merge feature/new-feature
git push origin main
```

**2. Automatic Pipeline Execution**
- Changes detection identifies modified files
- Runs all applicable quality checks
- Executes test suites
- Builds production bundle
- Performs security audit

**3. Deployment to Staging**
```yaml
- name: Deploy to staging
  run: |
    echo "Deploying to staging environment"
    # Deployment commands executed here
```

**4. Verification**
- Health check endpoint validation
- Smoke tests execution
- Deployment status notification

**Timeline:**
- Code push: T+0
- Pipeline start: T+30s
- Tests complete: T+5m
- Build complete: T+6m
- Staging deployment: T+7m
- Verification: T+8m

### Production Deployment Flow

**1. Initiate Deployment**

Navigate to GitHub Actions:
```
Repository → Actions → Production Deployment → Run workflow
```

**Input Parameters:**
- **Version**: `v1.2.3` or commit SHA
- **Rollback**: `false` (default)
- **Skip Tests**: `false` (default, use only in emergencies)

**2. Validation Phase**
```yaml
- Validates version format (semver or SHA)
- Checks deployment prerequisites
- Verifies required secrets are configured
- Confirms current production version
```

**3. Pre-Deployment Tests**
```yaml
- Runs critical test suite
- Validates database migrations (dry-run)
- Builds application bundle
- Uploads build artifacts
```

**4. Image Build**
```yaml
- Creates Docker image with version tag
- Pushes to GitHub Container Registry
- Tags as production-latest
- Verifies image integrity
```

**5. Production Backup**
```yaml
- Creates database snapshot
- Backs up configuration files
- Tags current Docker image as backup
- Stores backup metadata
```

**6. Deployment Execution**
```yaml
- Creates GitHub deployment record
- Updates deployment status to in_progress
- Deploys new application version
- Runs database migrations
- Warms up application caches
```

**7. Post-Deployment Verification**
```yaml
- Waits for deployment stabilization (30s)
- Runs health checks (10 retries)
- Executes smoke tests
- Verifies performance baselines
- Confirms database migration status
```

**8. Finalization**
```yaml
- Updates deployment status (success/failure)
- Generates deployment summary
- Sends notifications
- Updates documentation
```

**Timeline:**
- Workflow initiation: T+0
- Validation: T+1m
- Pre-deployment tests: T+5m
- Image build: T+7m
- Backup: T+8m
- Deployment: T+10m
- Verification: T+12m
- Finalization: T+13m

---

## Manual Deployment

### Prerequisites

**Local Environment Setup:**
```bash
# Install dependencies
npm ci

# Configure environment
cp .env.example .env
# Edit .env with production values

# Verify configuration
npm run type-check
npm run lint
npm run test
```

### Manual Staging Deployment

**1. Build Application:**
```bash
# Set environment
export NODE_ENV=staging

# Build
npm run build

# Verify build output
ls -la dist/
```

**2. Run Database Migrations:**
```bash
# Set database URL
export DATABASE_URL="postgresql://user:pass@staging-db:5432/hr_app"

# Run migrations
npm run migrate:up

# Verify migration status
npm run migrate:status
```

**3. Deploy Application:**
```bash
# Using rsync (example)
rsync -avz --delete \
  dist/ \
  user@staging-server:/var/www/hr-app/

# Using SCP (example)
scp -r dist/* user@staging-server:/var/www/hr-app/

# Restart application service
ssh user@staging-server "sudo systemctl restart hr-app"
```

**4. Verify Deployment:**
```bash
# Health check
curl https://staging.example.com/health

# Smoke test
curl https://staging.example.com/api/v1
```

### Manual Production Deployment

**⚠️ WARNING: Manual production deployments should only be performed in emergency situations.**

**1. Create Backup:**
```bash
# Database backup
pg_dump $PRODUCTION_DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

# Configuration backup
tar -czf config-backup-$(date +%Y%m%d-%H%M%S).tar.gz \
  .env \
  ecosystem.config.js
```

**2. Build and Test:**
```bash
# Clean build
npm run clean
npm ci --production
npm run build

# Run critical tests
npm run test -- --testPathPattern="tests/(unit|integration)"
```

**3. Deploy:**
```bash
# Stop application
ssh user@prod-server "sudo systemctl stop hr-app"

# Deploy files
rsync -avz --delete \
  dist/ \
  user@prod-server:/var/www/hr-app/

# Run migrations
ssh user@prod-server "cd /var/www/hr-app && npm run migrate:up"

# Start application
ssh user@prod-server "sudo systemctl start hr-app"
```

**4. Verify:**
```bash
# Wait for startup
sleep 10

# Health check
curl https://production.example.com/health

# Monitor logs
ssh user@prod-server "sudo journalctl -u hr-app -f"
```

### Emergency Hotfix Deployment

**Scenario:** Critical bug in production requiring immediate fix

**1. Create Hotfix Branch:**
```bash
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug-fix
```

**2. Implement Fix:**
```bash
# Make necessary changes
# Commit with descriptive message
git add .
git commit -m "hotfix: Fix critical authentication bug"
```

**3. Test Locally:**
```bash
npm run test
npm run build
```

**4. Deploy to Staging:**
```bash
git push origin hotfix/critical-bug-fix
# Create PR to main
# Merge after review
# Automatic staging deployment
```

**5. Deploy to Production:**
```bash
# Get commit SHA
COMMIT_SHA=$(git rev-parse HEAD)

# Trigger production deployment
# GitHub Actions → Production Deployment
# Version: $COMMIT_SHA
```

**6. Monitor:**
```bash
# Watch deployment logs
# Monitor error rates
# Verify fix effectiveness
```

---

## Rollback Procedures

### Automatic Rollback

The production deployment workflow includes automatic rollback on failure:

```yaml
rollback:
  name: Rollback Deployment
  needs: [validate, verify-deployment]
  if: failure() || github.event.inputs.rollback == 'true'
  runs-on: ubuntu-latest
```

**Triggers:**
- Health check failures
- Smoke test failures
- Manual rollback request
- Deployment timeout

**Rollback Process:**
1. Identifies previous stable version
2. Deploys previous Docker image
3. Restores database backup (if needed)
4. Restores configuration files
5. Verifies rollback success
6. Sends notifications

### Manual Rollback

**Scenario:** Need to rollback after successful deployment

**1. Identify Previous Version:**
```bash
# List recent deployments
git tag --sort=-creatordate | head -5

# Example output:
# v1.2.3  (current - problematic)
# v1.2.2  (previous - stable)
# v1.2.1
```

**2. Initiate Rollback:**
```
GitHub Actions → Production Deployment → Run workflow
- Version: v1.2.2
- Rollback: true
- Skip Tests: false
```

**3. Monitor Rollback:**
```bash
# Watch workflow execution
# Verify health checks pass
# Monitor application metrics
```

**4. Verify Rollback:**
```bash
# Check application version
curl https://production.example.com/api/v1 | jq '.version'

# Verify functionality
# Run smoke tests
# Check error rates
```

### Database Rollback

**⚠️ CRITICAL: Database rollbacks are complex and risky**

**Scenario:** Database migration caused issues

**1. Assess Impact:**
```bash
# Check migration status
npm run migrate:status

# Review migration logs
# Identify problematic migration
```

**2. Rollback Migration:**
```bash
# Rollback single migration
npm run migrate:down

# Rollback to specific version
npm run migrate:down -- --to 005
```

**3. Restore from Backup (if needed):**
```bash
# Stop application
sudo systemctl stop hr-app

# Restore database
psql $DATABASE_URL < backup-20250112-143000.sql

# Verify restoration
psql $DATABASE_URL -c "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 5;"

# Start application
sudo systemctl start hr-app
```

**4. Verify Data Integrity:**
```bash
# Run database tests
npm run test:db

# Verify critical data
# Check application functionality
```

### Rollback Decision Matrix

| Severity | Issue Type | Rollback Method | Approval Required |
|----------|-----------|-----------------|-------------------|
| **Critical** | Application crash | Automatic | No |
| **Critical** | Data corruption | Manual + DB restore | Yes |
| **High** | Major functionality broken | Manual rollback | Yes |
| **Medium** | Minor feature issue | Hotfix deployment | No |
| **Low** | UI glitch | Next release | No |

---

## Secrets Management

### GitHub Secrets Configuration

**1. Navigate to Repository Settings:**
```
Repository → Settings → Secrets and variables → Actions
```

**2. Add Required Secrets:**

**Database Secrets:**
```
Name: DATABASE_URL
Value: postgresql://user:password@host:5432/database

Name: PRODUCTION_DATABASE_URL
Value: postgresql://prod_user:secure_pass@prod-host:5432/prod_db
```

**Authentication Secrets:**
```
Name: JWT_SECRET
Value: [Generate 32+ character random string]
Command: openssl rand -base64 32

Name: JWT_REFRESH_SECRET
Value: [Generate different 32+ character random string]
Command: openssl rand -base64 32
```

**Deployment Secrets:**
```
Name: PRODUCTION_DEPLOY_KEY
Value: [SSH private key or deployment token]

Name: STAGING_DEPLOY_KEY
Value: [Staging deployment credentials]
```

### Secret Generation

**Generate Secure Secrets:**
```bash
# JWT secrets (32+ characters)
openssl rand -base64 32

# SSH key for deployment
ssh-keygen -t ed25519 -C "github-actions-deploy" -f deploy_key

# Database password (16+ characters)
openssl rand -base64 16 | tr -d "=+/" | cut -c1-16
```

### Secret Rotation

**Recommended Rotation Schedule:**
- JWT secrets: Every 90 days
- Database passwords: Every 180 days
- Deployment keys: Every 365 days

**Rotation Process:**

**1. Generate New Secret:**
```bash
NEW_SECRET=$(openssl rand -base64 32)
echo $NEW_SECRET
```

**2. Update GitHub Secret:**
```
Repository → Settings → Secrets → Edit JWT_SECRET
```

**3. Update Environment:**
```bash
# Update .env files on servers
# Restart applications
# Verify functionality
```

**4. Revoke Old Secret:**
```bash
# After verification period (24-48 hours)
# Remove old secret from backup systems
# Update documentation
```

### Secret Access Control

**GitHub Actions Access:**
```yaml
# Secrets are only available to workflows
# Not exposed in logs
# Masked in output

env:
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

**Environment Protection Rules:**
```
Settings → Environments → production
- Required reviewers: 2
- Wait timer: 5 minutes
- Deployment branches: main only
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Pipeline Failures

**Issue: Lint Errors**
```
Error: ESLint found 3 errors
```

**Solution:**
```bash
# Run lint locally
npm run lint

# Auto-fix issues
npm run lint:fix

# Commit fixes
git add .
git commit -m "fix: Resolve linting errors"
git push
```

**Issue: Type Check Failures**
```
Error: TypeScript compilation failed
```

**Solution:**
```bash
# Run type check locally
npm run type-check

# Fix type errors
# Common issues:
# - Missing type definitions
# - Incorrect type annotations
# - Import errors

# Verify fix
npm run type-check
```

**Issue: Test Failures**
```
Error: 2 tests failed
```

**Solution:**
```bash
# Run tests locally
npm run test

# Run specific test file
npm run test -- tests/unit/auth.test.ts

# Debug test
npm run test -- --verbose --no-coverage

# Fix issues and verify
npm run test
```

#### 2. Deployment Failures

**Issue: Health Check Timeout**
```
Error: Health checks failed after 10 attempts
```

**Solution:**
```bash
# Check application logs
ssh user@server "sudo journalctl -u hr-app -n 100"

# Verify database connectivity
ssh user@server "psql $DATABASE_URL -c 'SELECT 1;'"

# Check port availability
ssh user@server "netstat -tlnp | grep 3000"

# Restart application
ssh user@server "sudo systemctl restart hr-app"
```

**Issue: Database Migration Failure**
```
Error: Migration 006 failed
```

**Solution:**
```bash
# Check migration status
npm run migrate:status

# Review migration file
cat migrations/006_*.js

# Rollback failed migration
npm run migrate:down

# Fix migration
# Re-run migration
npm run migrate:up
```

**Issue: Build Artifact Missing**
```
Error: Build output directory 'dist' not found
```

**Solution:**
```bash
# Clean and rebuild
npm run clean
npm run build

# Verify build output
ls -la dist/

# Check build logs for errors
npm run build 2>&1 | tee build.log
```

#### 3. Performance Issues

**Issue: Slow Pipeline Execution**
```
Pipeline taking 15+ minutes
```

**Solution:**
```bash
# Check cache hit rate
# GitHub Actions → Workflow run → Cache logs

# Clear cache if corrupted
# Update CACHE_VERSION in workflow

# Optimize test execution
# Run tests in parallel
# Skip unnecessary tests for doc changes
```

**Issue: High Memory Usage**
```
Error: JavaScript heap out of memory
```

**Solution:**
```yaml
# Increase Node memory limit
- name: Run tests
  run: NODE_OPTIONS="--max-old-space-size=4096" npm run test
```

#### 4. Security Issues

**Issue: Vulnerability Detected**
```
Error: Found 1 critical vulnerability
```

**Solution:**
```bash
# Review vulnerability
npm audit

# Update vulnerable package
npm update [package-name]

# If no fix available, evaluate risk
# Consider alternative package
# Document exception if acceptable risk

# Verify fix
npm audit
```

**Issue: Secret Exposure**
```
Warning: Potential secret detected in logs
```

**Solution:**
```bash
# Immediately rotate exposed secret
# Update GitHub secret
# Restart affected services
# Review commit history
# Consider force push if in feature branch
```

### Debug Mode

**Enable Verbose Logging:**

```yaml
# In workflow file
- name: Run with debug logging
  run: npm run test
  env:
    DEBUG: '*'
    LOG_LEVEL: debug
```

**Local Debug:**
```bash
# Enable debug mode
export DEBUG='*'
export LOG_LEVEL=debug

# Run application
npm run dev

# Run tests with debug
npm run test -- --verbose
```

### Getting Help

**1. Check Workflow Logs:**
```
GitHub Actions → Failed workflow → Job → Step logs
```

**2. Review Documentation:**
- This deployment guide
- GitHub Actions documentation
- Project README

**3. Contact Team:**
- Create GitHub issue with logs
- Slack #deployments channel
- Email: devops@example.com

---

## Monitoring and Alerts

### Health Checks

**Endpoint:** `GET /health`

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-01-12T14:30:00.000Z",
  "uptime": 86400,
  "environment": "production",
  "version": "1.2.3"
}
```

**Monitoring Frequency:**
- Staging: Every 60 seconds
- Production: Every 30 seconds

### Key Metrics

**Application Metrics:**
- Response time (p50, p95, p99)
- Request rate (requests/second)
- Error rate (errors/total requests)
- Active connections
- Memory usage
- CPU usage

**Database Metrics:**
- Query execution time
- Connection pool usage
- Active queries
- Database size
- Replication lag (if applicable)

**Pipeline Metrics:**
- Build duration
- Test execution time
- Deployment frequency
- Deployment success rate
- Mean time to recovery (MTTR)

### Alert Configuration

**Critical Alerts (Immediate Response):**
- Application down (health check fails)
- Error rate > 5%
- Response time p95 > 2000ms
- Database connection failures
- Deployment failures

**Warning Alerts (Monitor):**
- Error rate > 1%
- Response time p95 > 1000ms
- Memory usage > 80%
- CPU usage > 80%
- Disk space < 20%

**Alert Channels:**
- Email: devops@example.com
- Slack: #alerts channel
- PagerDuty: On-call rotation
- GitHub: Deployment status

### Logging

**Log Levels:**
- **ERROR**: Application errors requiring attention
- **WARN**: Potential issues or degraded performance
- **INFO**: Normal operational messages
- **DEBUG**: Detailed diagnostic information

**Log Aggregation:**
- Centralized logging system (e.g., ELK, Datadog)
- Retention: 30 days for production, 7 days for staging
- Search and filter capabilities
- Correlation ID tracking

**Example Log Entry:**
```json
{
  "timestamp": "2025-01-12T14:30:00.000Z",
  "level": "INFO",
  "correlationId": "req_abc123",
  "service": "hr-app",
  "environment": "production",
  "message": "User login successful",
  "userId": "user_123",
  "email": "user@example.com",
  "executionTimeMs": 45
}
```

---

## Best Practices

### Deployment Checklist

**Pre-Deployment:**
- [ ] All tests passing locally
- [ ] Code reviewed and approved
- [ ] Database migrations tested
- [ ] Environment variables configured
- [ ] Secrets rotated (if scheduled)
- [ ] Backup verified
- [ ] Rollback plan documented
- [ ] Stakeholders notified

**During Deployment:**
- [ ] Monitor pipeline execution
- [ ] Watch application logs
- [ ] Verify health checks
- [ ] Run smoke tests
- [ ] Check error rates
- [ ] Monitor performance metrics

**Post-Deployment:**
- [ ] Verify functionality
- [ ] Check monitoring dashboards
- [ ] Review error logs
- [ ] Update documentation
- [ ] Notify stakeholders
- [ ] Document any issues

### Security Best Practices

1. **Never commit secrets to repository**
2. **Rotate secrets regularly**
3. **Use environment-specific secrets**
4. **Enable branch protection rules**
5. **Require code reviews**
6. **Run security audits regularly**
7. **Keep dependencies updated**
8. **Monitor for vulnerabilities**

### Performance Optimization

1. **Use caching effectively**
2. **Optimize test execution**
3. **Run jobs in parallel**
4. **Use path-based filtering**
5. **Monitor pipeline metrics**
6. **Optimize Docker images**
7. **Use build artifacts**

---

## Additional Resources

### Documentation
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

### Tools
- [act](https://github.com/nektos/act) - Run GitHub Actions locally
- [Docker](https://www.docker.com/) - Container platform
- [PostgreSQL](https://www.postgresql.org/) - Database system

### Support
- GitHub Issues: Report bugs and request features
- Slack: #deployments channel for questions
- Email: devops@example.com for urgent issues

---

**Document Version:** 1.0.0  
**Last Updated:** 2025-01-12  
**Maintained By:** DevOps Team