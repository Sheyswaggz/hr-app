#### Uptime Monitoring
**Recommended**: Pingdom, UptimeRobot, or StatusCake

**Checks**:
- Health endpoint every 1 minute
- Alert if down for >2 minutes
- Check from multiple regions

### Alert Configuration

#### Critical Alerts (Page On-Call)
- Application down (health check fails)
- Error rate >5%
- Response time >5 seconds (P95)
- Database connection failures
- Disk usage >90%

#### Warning Alerts (Notify Team)
- Error rate >1%
- Response time >2 seconds (P95)
- Memory usage >80%
- Failed deployments
- Security vulnerabilities

#### Informational Alerts (Log Only)
- Successful deployments
- Configuration changes
- Scheduled maintenance

### Incident Response

#### Severity Levels

**SEV-1 (Critical)**:
- Production completely down
- Data loss or corruption
- Security breach
- Response: Immediate page, all hands on deck

**SEV-2 (High)**:
- Partial outage
- Degraded performance
- Failed deployment
- Response: Page on-call, investigate within 15 minutes

**SEV-3 (Medium)**:
- Minor issues
- Non-critical features affected
- Response: Investigate during business hours

**SEV-4 (Low)**:
- Cosmetic issues
- Documentation updates
- Response: Add to backlog

#### Incident Response Process
1. **Detect**: Alert triggers or user report
2. **Acknowledge**: On-call engineer acknowledges
3. **Assess**: Determine severity and impact
4. **Mitigate**: Implement immediate fix or rollback
5. **Communicate**: Update status page and stakeholders
6. **Resolve**: Verify issue is fixed
7. **Post-Mortem**: Document and learn

---

## Appendix

### Deployment Checklist

#### Pre-Deployment
- [ ] All tests passing in staging
- [ ] Security scan completed
- [ ] Database migrations tested
- [ ] Rollback plan prepared
- [ ] Team notified
- [ ] Monitoring dashboards ready
- [ ] Deployment window confirmed
- [ ] Backup completed

#### During Deployment
- [ ] Version validated
- [ ] Pre-deployment tests passed
- [ ] Build artifacts created
- [ ] Security scan passed
- [ ] Database migrations executed
- [ ] Application deployed
- [ ] Health checks passed
- [ ] Smoke tests passed

#### Post-Deployment
- [ ] Monitoring active
- [ ] Error rates normal
- [ ] Response times acceptable
- [ ] User feedback positive
- [ ] Deployment documented
- [ ] Team notified of completion

### Useful Commands