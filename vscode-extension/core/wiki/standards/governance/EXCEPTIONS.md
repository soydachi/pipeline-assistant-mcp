# Exception Process for Pipeline Standards

This document defines the formal process for requesting and managing exceptions to pipeline standards.

## Overview

Exceptions allow teams to temporarily deviate from standards when:
- Technical constraints prevent compliance
- Legacy systems require gradual migration
- Third-party limitations exist
- Business urgency requires temporary workarounds

**Important:** Exceptions are temporary. All teams must work toward full compliance.

## Exception Types

### Type 1: Technical Exception

**Reason:** Technical limitation prevents implementation

**Examples:**
- Language/framework not supported by tool
- Cloud provider limitation
- Build system constraint

**Max Duration:** 90 days

### Type 2: Security Exception

**Reason:** Security control cannot be implemented

**Examples:**
- False positives blocking pipeline
- Tool incompatibility
- Performance impact

**Max Duration:** 60 days (low risk) / 30 days (high risk)

### Type 3: Migration Exception

**Reason:** Team needs time to migrate

**Examples:**
- Large codebase migration
- Complex refactoring needed
- Resource constraints

**Max Duration:** 90 days

### Type 4: Emergency Exception

**Reason:** Critical business need

**Examples:**
- Production hotfix
- Regulatory deadline
- Customer commitment

**Max Duration:** 14 days

## Request Process

### Step 1: Prepare Request

Complete the exception request form:

```yaml
# Exception Request Form
---
request_id: EXC-YYYY-NNN  # Assigned by system
date: YYYY-MM-DD
requestor:
  name: John Doe
  email: john.doe@company.com
  team: Team Alpha

standard:
  id: SEC-003
  name: Dependency Scanning

exception_type: technical  # technical|security|migration|emergency

reason: |
  Brief description of why the exception is needed.
  Include technical details.

impact:
  severity: medium  # low|medium|high|critical
  scope: single_project  # single_project|team|organization
  affected_systems:
    - project-name-1

risk_mitigation: |
  Describe how you will mitigate the risk while
  the exception is active.

timeline:
  start_date: YYYY-MM-DD
  end_date: YYYY-MM-DD
  compliance_plan: |
    Steps to achieve full compliance by end date.

approvals:
  tech_lead: pending
  security: pending  # Required for security exceptions
  standards_owner: pending  # Required for high/critical
```

### Step 2: Submit Request

**Submission channels:**
- GitHub Issue: Create issue with `exception-request` label
- Email: platform-engineering@company.com
- ServiceNow: Pipeline Standards Exception queue

### Step 3: Initial Review

Platform Engineering will:
1. Validate completeness (1 business day)
2. Assess impact and risk
3. Route to appropriate approvers
4. Request additional information if needed

### Step 4: Approval

**Approval matrix:**

| Severity | Required Approvers | SLA |
|----------|-------------------|-----|
| Low | Tech Lead | 2 days |
| Medium | Tech Lead + Security | 3 days |
| High | Security + Standards Owner | 5 days |
| Critical | CISO + Standards Owner | 3 days |

### Step 5: Implementation

Once approved:
1. Exception registered in tracking system
2. Pipeline updated with exception flag
3. Monitoring configured
4. Compliance timeline tracked

## Approval Criteria

### Must Have
- [ ] Clear technical justification
- [ ] Risk mitigation plan
- [ ] Compliance timeline
- [ ] Owner identified

### Evaluated
- Business impact of delay
- Security risk level
- Duration reasonableness
- Mitigation effectiveness
- Team's compliance history

### Rejection Reasons
- Insufficient justification
- No mitigation plan
- Unreasonable timeline
- Better alternatives exist
- Repeated requests without progress

## Exception Tracking

### Registry

All exceptions tracked in central registry with:
- Request ID
- Team/Project
- Standard exempted
- Start/End dates
- Status
- Compliance progress

### Status Values

| Status | Description |
|--------|-------------|
| Pending | Awaiting approval |
| Approved | Active exception |
| In Progress | Working toward compliance |
| Compliant | Full compliance achieved |
| Expired | Past end date, needs renewal or escalation |
| Revoked | Exception cancelled |

### Notifications

| Event | Recipient | Timing |
|-------|-----------|--------|
| Approval | Requestor, Team | Immediate |
| 75% duration | Requestor | 7 days before |
| 90% duration | Requestor + Tech Lead | 3 days before |
| Expiration | Requestor + Tech Lead + Manager | Day of |

## Renewal Process

### When to Renew

- Additional time needed for compliance
- Circumstances have changed
- Blocking issue not yet resolved

### Renewal Requirements

1. Progress report on compliance efforts
2. Updated compliance timeline
3. Justification for extension
4. New risk assessment

### Renewal Limits

| Exception Type | Max Renewals | Max Total Duration |
|----------------|--------------|-------------------|
| Technical | 2 | 180 days |
| Security | 1 | 90 days |
| Migration | 2 | 180 days |
| Emergency | 1 | 30 days |

**Note:** Exceptions exceeding limits require executive approval.

## Escalation

### Automatic Escalation

| Condition | Escalated To | Action |
|-----------|--------------|--------|
| No response in 48h | Tech Lead | Follow up |
| Expired without renewal | Manager | Review required |
| > 2 renewals | Director | Executive review |
| Security high risk | CISO | Immediate review |

### Manual Escalation

Requestors can escalate if:
- Approval delayed beyond SLA
- Urgent business need
- Disagreement with decision

Escalation path:
1. Platform Engineering Lead
2. Engineering Director
3. CTO

## Compliance Reporting

### Team Dashboard

Each team sees:
- Active exceptions
- Upcoming expirations
- Compliance progress
- Historical exceptions

### Management Reports

Monthly report includes:
- Total exceptions by type
- Compliance rate trends
- Average exception duration
- Teams with most exceptions
- Overdue exceptions

### Executive Summary

Quarterly summary:
- Organization compliance rate
- Risk exposure from exceptions
- Improvement recommendations

## Best Practices

### For Requestors

1. **Plan ahead** - Request before you need it
2. **Be specific** - Clearly describe the limitation
3. **Propose solutions** - Show compliance path
4. **Stay engaged** - Provide progress updates
5. **Close promptly** - Report compliance achieved

### For Approvers

1. **Respond quickly** - Meet SLA commitments
2. **Ask questions** - Ensure understanding
3. **Be consistent** - Apply criteria fairly
4. **Document decisions** - Record reasoning
5. **Follow up** - Monitor compliance progress

## Examples

### Example 1: Technical Exception

```yaml
standard: SEC-003 (Dependency Scanning)
reason: |
  Our project uses a custom internal framework that
  Snyk doesn't support. Getting false positives on
  all internal packages.
risk_mitigation: |
  - Running manual dependency audit weekly
  - Configured Snyk to ignore internal packages
  - Will switch to supported framework in Q2
timeline: 60 days
```

### Example 2: Migration Exception

```yaml
standard: SEC-010 (SBOM Generation)
reason: |
  Legacy build system doesn't support Docker.
  Migrating to new build system next sprint.
risk_mitigation: |
  - Generating manual SBOM using npm list
  - Storing in release artifacts
  - Full automation after migration
timeline: 45 days
```

### Example 3: Emergency Exception

```yaml
standard: SEC-007 (DAST)
reason: |
  Critical production bug requires immediate fix.
  DAST scan adding 30 minutes to deployment.
risk_mitigation: |
  - Security team reviewed code changes
  - Manual security testing performed
  - DAST will run post-deployment
timeline: 24 hours
```

## FAQ

**Q: Can I bypass security scans for urgent fixes?**
A: Emergency exceptions are available but require security team review and have strict limits.

**Q: What if my exception expires before I'm compliant?**
A: Submit a renewal request before expiration with progress report. Expired exceptions may block deployments.

**Q: Do exceptions appear on team metrics?**
A: Yes, exception rate is a tracked KPI. Aim for < 5% exception rate.

**Q: Can I get a permanent exception?**
A: No. All exceptions are temporary. For permanent changes, propose a standards modification.

**Q: Who can view my exceptions?**
A: Your team, Platform Engineering, Security, and leadership can view exceptions.
