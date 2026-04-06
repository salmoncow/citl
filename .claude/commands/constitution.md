Read `.specs/constitution.md` and present a concise **project state dashboard**.

## What to display

### 1. Architectural State (from §II.1)
Summarize the current state table — domain, status, and any notable changes since last review.

### 2. Key Metrics
Report the metrics block: active users, SPA views, modules, repositories, types, data files, team size, Firebase usage.

### 3. Evolution Triggers (from §II.2)
For each trigger, show current value vs. threshold and whether it's approaching:
- Modules: current count vs. 10 (testing trigger)
- DNS cutover status (CI/CD trigger)
- Firebase free tier usage vs. 70% alert threshold

### 4. Forbidden Patterns Reminder (from §IV.2)
List the forbidden patterns as a quick-scan checklist — just the pattern and the fix, one line each.

### 5. Quality Standards Quick Reference (from §III)
- Skeleton loading requirement (§III.3)
- File size limits (§II.3): target <500, hard limit 750
- Dependency direction: components → modules → services → repositories
- Performance targets: <3s load, <250 kB JS gzipped

## Format
Present as a compact dashboard with section headers. Use tables where they save space. Do not reproduce the full constitution — this is a summary for quick orientation.
