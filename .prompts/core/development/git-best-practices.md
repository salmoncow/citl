# Git Best Practices Prompt

## Version Control Strategy for Professional Development

When working with Git in this project, follow these well-architected patterns for maintainable, collaborative, and traceable version control. These practices ensure clear history, easy rollbacks, and effective team collaboration.

---

## Commit Message Convention

### Conventional Commits Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification for clear, semantic commit messages:

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Commit Types

- **feat**: New feature or functionality
- **fix**: Bug fix
- **docs**: Documentation changes only
- **style**: Code style changes (formatting, whitespace, no logic changes)
- **refactor**: Code restructuring without changing behavior
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Maintenance tasks (dependencies, build config, etc.)
- **ci**: CI/CD pipeline changes
- **build**: Build system or external dependency changes
- **revert**: Reverting a previous commit

#### Good Commit Messages

```bash
# ✅ Good: Clear, specific, follows convention
feat(auth): add Google OAuth sign-in integration

Implements Firebase Authentication with Google provider.
Users can now sign in using their Google accounts.

- Add auth.js module with signIn/signOut functions
- Update UI to show user profile after authentication
- Add error handling for failed sign-in attempts

Closes #42

# ✅ Good: Descriptive with context
fix(ui): resolve avatar fallback display issue

Avatar images now properly fall back to default-avatar.svg
when user profile photo fails to load or is missing.

Fixes #58

# ✅ Good: Breaking change clearly marked
feat(api)!: migrate to Firebase SDK v10

BREAKING CHANGE: Firebase SDK upgraded from v9 to v10.
Update import statements from 'firebase/compat' to modular SDK.

Migration guide: docs/firebase-v10-migration.md

# ✅ Good: Simple change, concise message
docs: update README with deployment instructions

# ✅ Good: Multiple related changes grouped logically
chore: update dependencies and fix vulnerabilities

- Update firebase from 12.0.0 to 12.3.0
- Update all dev dependencies to latest versions
- Fix 3 security vulnerabilities identified by npm audit
```

#### Bad Commit Messages

```bash
# ❌ Bad: Vague, no context
fix: fixed bug

# ❌ Bad: Too generic
update code

# ❌ Bad: Multiple unrelated changes
feat: add login, update README, fix CSS, and refactor utils

# ❌ Bad: Not following convention
Added new feature for users

# ❌ Bad: No description of what or why
wip

# ❌ Bad: Commit message doesn't match changes
fix(auth): update documentation
```

---

## Branch Naming Strategy

### Branch Name Format

```
<type>/<short-description>
```

#### Branch Naming Rules

Follow these conventions for consistent, readable branch names:

- **Use lowercase only** - No uppercase letters (`feat/oauth`, not `feat/OAuth`)
- **Use hyphens as separators** - Not underscores or spaces (`feat/google-oauth`, not `feat/google_oauth`)
- **Keep descriptions concise** - Aim for 2-5 words, max 50 characters total
- **Be descriptive** - Name should clearly indicate the purpose
- **Use only alphanumeric and hyphens** - Avoid special characters except hyphens and forward slash
- **No trailing slashes** - End with the description, not a slash

```bash
# ✅ Good: Follows all rules
feat/add-user-dashboard
fix/login-timeout-error
docs/update-api-guide

# ❌ Bad: Violates rules
feat/Add-User-Dashboard      # Uppercase
fix/login_timeout_error      # Underscores
feat/really-long-branch-name-that-describes-everything-in-detail  # Too long
docs/update                  # Too vague
feat/new-feature!            # Special character
```

#### Branch Types

**Primary Types:**
- **feat/** - New features
- **fix/** - Bug fixes
- **docs/** - Documentation updates
- **refactor/** - Code refactoring
- **test/** - Test additions or updates
- **chore/** - Maintenance tasks
- **hotfix/** - Urgent production fixes
- **release/** - Release preparation

**Special Case Types:**
- **experiment/** (or **spike/**) - Exploratory/proof-of-concept work
- **deps/** - Dependency updates and package management
- **perf/** - Performance improvements
- **security/** - Security patches and improvements

**Temporary Branches:**
Temporary branches for testing or investigation should still follow the naming convention but be clearly identified and deleted promptly after use. Prefix with the appropriate type and use descriptive names:
```bash
# ✅ Acceptable temporary branches
test/investigate-memory-leak
experiment/alternative-auth-approach
fix/debug-cors-issue

# Remember to delete after investigation/testing is complete
```

#### Good Branch Names

```bash
# ✅ Good: Clear feature branch
feat/google-oauth-integration

# ✅ Good: Specific bug fix
fix/avatar-fallback-display

# ✅ Good: Descriptive refactoring
refactor/modularize-auth-logic

# ✅ Good: Documentation update
docs/add-deployment-guide

# ✅ Good: Hotfix with issue number
hotfix/security-vulnerability-#123

# ✅ Good: Release branch
release/v1.2.0
```

#### Issue Number Integration

For better traceability, include issue/ticket numbers in branch names when working on tracked tasks:

**Recommended Format:**
```
<type>/<description>-#<issue-number>
```

**When to Include Issue Numbers:**
- ✅ Bug fixes tracked in issue tracker
- ✅ Features planned in issues/tickets
- ✅ Hotfixes for reported problems
- ✅ Work linked to project management tools

**When Optional:**
- Small documentation updates
- Minor chores without associated issues
- Exploratory/experimental work

```bash
# ✅ Good: With issue numbers
feat/google-oauth-integration-#42
fix/avatar-fallback-display-#58
hotfix/security-vulnerability-#123
refactor/auth-module-#89

# ✅ Also acceptable: Without issue numbers (when appropriate)
docs/update-readme
chore/update-dependencies
experiment/new-ui-approach

# ✅ Good: Multiple issue references
fix/auth-and-profile-bugs-#45-#46

# ❌ Bad: Inconsistent formats
feat/42-google-oauth          # Number at start
fix/issue-58-avatar           # Word "issue" unnecessary
hotfix/#123                   # No description
```

#### Bad Branch Names

```bash
# ❌ Bad: Too vague
fix/bugs

# ❌ Bad: Personal branch (use feat/ or fix/ instead)
john-dev

# ❌ Bad: No context
temp

# ❌ Bad: Spaces in name
feat/new feature

# ❌ Bad: Random naming
my-branch-123
```

---

## Commit Granularity

### Atomic Commits Principle

Each commit should represent a single, logical change that can be understood and potentially reverted independently.

#### Good Commit Granularity

```bash
# ✅ Good: Single logical change
git add firebase.json .firebaserc
git commit -m "feat: add Firebase Hosting configuration"

git add package.json
git commit -m "feat: add deployment scripts for Firebase"

git add README.md
git commit -m "docs: add Firebase Hosting deployment guide"

# ✅ Good: Related changes grouped
git add src/js/modules/auth.js src/js/modules/ui.js
git commit -m "feat(auth): implement Google sign-in with UI integration"
```

#### Bad Commit Granularity

```bash
# ❌ Bad: Too many unrelated changes
git add .
git commit -m "feat: add hosting, update docs, fix bugs, refactor code"

# ❌ Bad: Incomplete change (won't work without other files)
git add src/js/modules/auth.js
git commit -m "feat: add authentication"
# (Missing firebase-config.js, UI updates, etc.)

# ❌ Bad: Too granular (changes are inseparable)
git add src/js/modules/auth.js
git commit -m "feat: add import statement"
git add src/js/modules/auth.js
git commit -m "feat: add signIn function"
git add src/js/modules/auth.js
git commit -m "feat: add signOut function"
# These should be one commit
```

### Organizing Mixed Changes into Logical Commits

When you have accumulated multiple unrelated changes in your working directory, organize them into logical commits by **change category** rather than committing everything at once.

#### Step 1: Categorize Your Changes

First, analyze what changed and group by logical purpose:

```bash
# Review all changes
git status
git diff --stat

# Categorize changes mentally:
# - Documentation updates
# - Dependency changes
# - Source code changes
# - Configuration files
# - CI/CD infrastructure
# - Testing changes
```

#### Step 2: Commit by Category

Create commits in a logical order (dependencies before code that uses them):

```bash
# ✅ Good: Organized sequence
# 1. Infrastructure/tooling changes first
git add .nvmrc
git commit -m "chore: add Node.js version pinning"

# 2. Dependency updates
git add package.json package-lock.json
git commit -m "chore: update dependencies"

# 3. Source code changes that depend on new dependencies
git add src/js/main.js src/js/modules/auth.js
git commit -m "feat: implement authentication module"

# 4. Configuration changes
git add firebase.json .firebaserc
git commit -m "feat: add Firebase Hosting configuration"

# 5. CI/CD pipelines
git add .github/workflows/
git commit -m "ci: add deployment workflows"

# 6. Documentation last
git add README.md docs/
git commit -m "docs: update deployment guide"
```

#### Step 3: Apply the Logical Grouping Test

**Ask for each commit:**
1. ✅ **Single Purpose**: Does this commit serve one clear purpose?
2. ✅ **Self-Contained**: Can a reviewer understand this commit in isolation?
3. ✅ **Independently Revertible**: Could we safely revert just this commit?
4. ✅ **Semantic Type**: Does the commit type accurately reflect all changes?

#### Common Change Categories and Commit Order

**Recommended commit sequence for complex features:**

```bash
# 1. Documentation/Guidance (can be first or last)
# - Prompt updates
# - Architecture decision records
# Commit type: docs

# 2. Infrastructure Setup
# - Version managers (.nvmrc, .ruby-version)
# - Build tools
# - Environment configuration
# Commit type: chore

# 3. Dependency Management
# - package.json changes
# - lock file regeneration
# Commit type: chore or build

# 4. Configuration Files
# - App configuration
# - Service configuration (Firebase, AWS, etc.)
# Commit type: feat or chore

# 5. Source Code Implementation
# - Core business logic
# - New features
# - Bug fixes
# Commit type: feat, fix, or refactor

# 6. Tests
# - Unit tests
# - Integration tests
# - E2E tests
# Commit type: test

# 7. CI/CD Pipelines
# - Workflow files
# - Deployment scripts
# Commit type: ci

# 8. Documentation (if not done first)
# - README updates
# - API documentation
# - User guides
# Commit type: docs
```

#### Example: Organizing a Feature Branch with Mixed Changes

**Scenario**: You've been working on GitHub Actions deployment and have:
- Updated 3 prompt files
- Modified package.json (engines + removed dependency)
- Regenerated package-lock.json
- Updated Firebase SDK version in 2 source files
- Added 4 GitHub workflow files
- Added .nvmrc
- Modified CLAUDE.md

**❌ Bad approach:**
```bash
git add .
git commit -m "feat: add GitHub Actions deployment"
# Mixes docs, dependencies, source code, CI/CD - reviewer nightmare!
```

**✅ Good approach:**
```bash
# Commit 1: Version management
git add .nvmrc package.json
git commit -m "chore: standardize Node.js version to 24 LTS"

# Commit 2: Dependency cleanup
git add package.json package-lock.json
git commit -m "chore: remove firebase npm dependency"

# Commit 3: SDK version update
git add src/js/main.js src/js/modules/auth.js
git commit -m "chore: update Firebase SDK to 10.13.2"

# Commit 4: Documentation metadata
git add .prompts/deployment-cicd.md .prompts/firebase-best-practices.md .prompts/testing-qa.md
git commit -m "docs: add version tracking metadata to prompts"

# Commit 5: CI/CD guidance updates
git add .prompts/deployment-cicd.md
git commit -m "docs: migrate CI/CD guidance to service accounts"

# Commit 6: GitHub Actions implementation
git add .github/
git commit -m "ci: add GitHub Actions deployment workflows"

# Commit 7: Guidance framework
git add .prompts/prompt-maintenance.md CLAUDE.md
git commit -m "docs: add prompt maintenance framework"
```

**Benefits of this approach:**
- Each commit has a clear, single purpose
- Changes can be reviewed individually
- Easy to cherry-pick specific changes
- Clear project evolution history
- Simple to revert specific aspects

#### Using `git add -p` for Partial File Commits

When a single file has multiple unrelated changes, use interactive staging:

```bash
# Stage parts of a file interactively
git add -p src/js/main.js

# Interactive prompt allows you to:
# - y: stage this hunk
# - n: don't stage this hunk
# - s: split into smaller hunks
# - e: manually edit the hunk

# Example workflow:
git add -p package.json  # Stage only engines addition
git commit -m "chore: add Node.js version requirement"

git add package.json     # Stage dependency removal
git commit -m "chore: remove firebase npm dependency"
```

#### Quick Reference: Commit Organization Checklist

Before committing, ask:
- [ ] Have I reviewed what changed? (`git status`, `git diff --stat`)
- [ ] Can I group changes into logical categories?
- [ ] Am I mixing unrelated change types? (docs + code + ci)
- [ ] Would each commit make sense in isolation?
- [ ] Is the commit order logical? (dependencies → code → tests → docs)
- [ ] Does each commit have an accurate, descriptive message?
- [ ] Could a reviewer understand each commit independently?

---

## Branch Protection Policies

**CRITICAL**: This project uses branch protection on `main` to ensure code quality and prevent accidental changes.

### Protected Branch Rules

**main branch is protected:**
- ❌ **NO direct commits to main**
- ❌ **NO direct merges to main** (via `git merge`)
- ❌ **NO force pushes to main**
- ✅ **ALL changes must go through Pull Requests**
- ✅ **Pull Requests require review and approval**
- ✅ **Status checks must pass before merge**

### Why Branch Protection Matters

**Prevents accidents:**
- Protects production code from untested changes
- Prevents accidental overwrites or deletions
- Ensures all code is reviewed before merging

**Enforces quality:**
- Requires CI/CD checks to pass
- Requires peer review
- Maintains clean, linear history

**Enables collaboration:**
- Clear review and approval process
- Discussion and feedback on changes
- Traceable decision-making

### How to Work With Protected Branches

**Always use feature branches:**
```bash
# ✅ Correct workflow
git checkout main
git pull origin main
git checkout -b feat/my-feature
# ... make changes ...
git push -u origin feat/my-feature
# Create PR via GitHub UI
```

**Never try to merge directly:**
```bash
# ❌ WRONG - Will be rejected by branch protection
git checkout main
git merge feat/my-feature  # This will fail!
git push origin main       # Branch protection prevents this

# ✅ CORRECT - Use Pull Requests
# Merge happens via GitHub UI after approval
```

---

## Git Workflow Patterns

### Feature Branch Workflow (With Branch Protection)

```bash
# 1. Start from main branch
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feat/google-oauth-integration

# 3. Make changes and commit atomically
git add src/js/modules/auth.js
git commit -m "feat(auth): add Google OAuth sign-in logic"

git add src/js/modules/ui.js
git commit -m "feat(ui): add user profile display after sign-in"

git add README.md
git commit -m "docs: document Google sign-in setup"

# 4. Push feature branch
git push -u origin feat/google-oauth-integration

# 5. Create pull request for review
# Go to GitHub UI and create PR from feat/google-oauth-integration to main
# - Fill out PR template
# - Request reviewers
# - Link related issues

# 6. Address review feedback (if any)
# Make additional commits based on review comments
git add src/js/modules/auth.js
git commit -m "fix(auth): address PR feedback on error handling"
git push origin feat/google-oauth-integration

# 7. After PR approval and CI passes, merge via GitHub UI
# - Choose merge strategy (squash, merge commit, or rebase)
# - Click "Merge pull request" button
# - Delete branch via GitHub UI

# 8. Clean up local branch
git checkout main
git pull origin main
git branch -d feat/google-oauth-integration
```

### Hotfix Workflow

```bash
# 1. Create hotfix branch from main
git checkout main
git checkout -b hotfix/security-patch-#123

# 2. Make fix
git add src/js/modules/auth.js
git commit -m "fix(auth): patch authentication vulnerability CVE-2024-1234"

# 3. Push and create urgent PR
git push -u origin hotfix/security-patch-#123

# 4. After merge, tag the release
git checkout main
git pull origin main
git tag -a v1.0.1 -m "Security patch release v1.0.1"
git push origin v1.0.1
```

---

## Merge vs Rebase

### When to Merge

**Use merge when:**
- Integrating feature branches into main (via Pull Request)
- Preserving complete branch history is important
- Working on shared/collaborative branches
- Creating explicit merge commits for tracking

**IMPORTANT**: Merges to protected branches (like `main`) **MUST** happen via Pull Request, not via git commands:

```bash
# ❌ WRONG - Direct merge to main (blocked by branch protection)
git checkout main
git merge feat/new-feature --no-ff

# ✅ CORRECT - Merge via Pull Request
# 1. Push feature branch
git push -u origin feat/new-feature

# 2. Create PR via GitHub UI

# 3. After approval, merge via GitHub's "Merge pull request" button
# GitHub will perform the merge on the server
```

### When to Rebase

**Use rebase when:**
- Updating feature branch with latest main changes
- Cleaning up local commit history before pushing
- Creating linear history for easier navigation

```bash
# Update feature branch with main changes
git checkout feat/my-feature
git fetch origin
git rebase origin/main

# Interactive rebase to clean up commits
git rebase -i HEAD~3
# Allows squashing, reordering, editing commits
```

### ⚠️ Never Rebase Public Branches

**CRITICAL**: Never rebase `main` or other shared branches. Always use Pull Requests for integrating changes.

```bash
# ❌ NEVER do this on main/shared branches
git checkout main
git rebase feat/my-feature  # DON'T!

# ❌ ALSO WRONG - Direct merge blocked by branch protection
git checkout main
git merge feat/my-feature  # Branch protection will prevent this!

# ✅ CORRECT - Use Pull Requests for all changes to main
git push origin feat/my-feature
# Then create PR via GitHub UI and merge after approval
```

---

## Git Hooks

### Pre-commit Hook Example

Automatically run checks before committing:

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running pre-commit checks..."

# Run linter
npm run lint
if [ $? -ne 0 ]; then
  echo "❌ Lint errors found. Please fix before committing."
  exit 1
fi

# Run tests
npm run test
if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Please fix before committing."
  exit 1
fi

echo "✅ Pre-commit checks passed"
exit 0
```

### Pre-push Hook for Branch Name Validation

Enforce branch naming conventions automatically:

```bash
#!/bin/bash
# .git/hooks/pre-push

# Get the current branch name
current_branch=$(git symbolic-ref --short HEAD)

# Define valid branch name pattern
# Matches: <type>/<description> or <type>/<description>-#<number>
branch_pattern="^(feat|fix|docs|refactor|test|chore|hotfix|release|experiment|spike|deps|perf|security)/[a-z0-9-]+(#[0-9]+)?$"

# Skip validation for main/master branches
if [[ "$current_branch" == "main" ]] || [[ "$current_branch" == "master" ]]; then
  exit 0
fi

# Validate branch name
if [[ ! $current_branch =~ $branch_pattern ]]; then
  echo "❌ Invalid branch name: '$current_branch'"
  echo ""
  echo "Branch names must follow the pattern: <type>/<description>"
  echo ""
  echo "Valid types: feat, fix, docs, refactor, test, chore, hotfix, release,"
  echo "             experiment, spike, deps, perf, security"
  echo ""
  echo "Examples:"
  echo "  ✅ feat/google-oauth-integration"
  echo "  ✅ fix/avatar-display-#58"
  echo "  ✅ docs/update-readme"
  echo ""
  echo "Rules:"
  echo "  - Use lowercase letters and numbers only"
  echo "  - Use hyphens (-) to separate words"
  echo "  - Optional issue number at end: -#123"
  echo ""
  exit 1
fi

echo "✅ Branch name validation passed: $current_branch"
exit 0
```

### Using Husky for Git Hooks

```bash
# Install husky
npm install --save-dev husky

# Initialize husky
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run lint && npm test"

# Add pre-push hook for branch name validation
npx husky add .husky/pre-push '.git/hooks/pre-push'
```

### Pre-commit Configuration

```json
// package.json
{
  "scripts": {
    "prepare": "husky install",
    "lint": "eslint src/",
    "test": "jest"
  },
  "husky": {
    "hooks": {
      "pre-commit": "npm run lint && npm test",
      "pre-push": ".git/hooks/pre-push",
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  }
}
```

---

## Working with Remotes

### Remote Management

```bash
# View remotes
git remote -v

# Add remote
git remote add upstream https://github.com/original/repo.git

# Fetch from remote
git fetch origin

# Pull with rebase (cleaner history)
git pull --rebase origin main

# Push to remote
git push origin feat/my-feature

# Push tags
git push origin --tags

# Force push (use with caution!)
git push --force-with-lease origin feat/my-feature
# --force-with-lease is safer than --force
```

---

## Stashing Changes

### Save Work in Progress

```bash
# Save current changes
git stash

# Save with descriptive message
git stash save "WIP: authentication refactoring"

# List stashes
git stash list

# Apply most recent stash
git stash apply

# Apply specific stash
git stash apply stash@{2}

# Apply and remove stash
git stash pop

# Drop stash
git stash drop stash@{1}

# Clear all stashes
git stash clear
```

---

## Undoing Changes

### Safe Undo Patterns

```bash
# Undo unstaged changes to a file
git checkout -- src/js/modules/auth.js

# Undo all unstaged changes
git checkout -- .

# Unstage file (keep changes)
git reset HEAD src/js/modules/auth.js

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes) ⚠️
git reset --hard HEAD~1

# Revert a specific commit (creates new commit)
git revert abc1234

# Amend last commit (only if not pushed!)
git add forgotten-file.js
git commit --amend --no-edit
```

### ⚠️ Dangerous Operations

```bash
# ❌ Use with extreme caution - destructive!
git reset --hard HEAD~5  # Loses 5 commits permanently
git clean -fd             # Deletes untracked files
git push --force         # Can overwrite others' work

# ✅ Safer alternatives
git reset --soft HEAD~5  # Keep changes, undo commits
git clean -fdn           # Dry-run to see what would be deleted
git push --force-with-lease  # Only force if no one else pushed
```

---

## Tagging Releases

### Semantic Versioning Tags

```bash
# Create annotated tag
git tag -a v1.0.0 -m "Release version 1.0.0"

# Create lightweight tag
git tag v1.0.0

# List tags
git tag -l

# Show tag details
git show v1.0.0

# Push single tag
git push origin v1.0.0

# Push all tags
git push origin --tags

# Delete local tag
git tag -d v1.0.0

# Delete remote tag
git push origin --delete v1.0.0
```

### Tag Naming Convention

```bash
# ✅ Good: Semantic versioning
v1.0.0    # Major release
v1.1.0    # Minor release (new features)
v1.1.1    # Patch release (bug fixes)

# ✅ Good: Pre-release tags
v2.0.0-alpha.1
v2.0.0-beta.1
v2.0.0-rc.1

# ❌ Bad: Inconsistent naming
release-1
version_2
final
```

---

## .gitignore Best Practices

### Comprehensive .gitignore

```gitignore
# Dependencies
node_modules/
package-lock.json  # Only if using yarn

# Environment variables
.env
.env.local
.env.*.local

# Build outputs
dist/
build/
public/js/
public/assets/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Firebase
.firebase/
*-debug.log
firebase-debug.log

# Testing
coverage/
.nyc_output/

# Temporary
*.tmp
*.temp
.cache/
```

### Check Ignored Files

```bash
# See what's being ignored
git status --ignored

# Check if file is ignored
git check-ignore -v src/file.js

# List all ignored files
git ls-files --others --ignored --exclude-standard
```

---

## Git Aliases for Efficiency

### Useful Aliases

```bash
# Configure aliases
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.st status
git config --global alias.unstage 'reset HEAD --'
git config --global alias.last 'log -1 HEAD'
git config --global alias.visual 'log --oneline --graph --decorate --all'
git config --global alias.amend 'commit --amend --no-edit'

# View configured aliases
git config --get-regexp alias
```

### Advanced Aliases

```bash
# Pretty log
git config --global alias.lg "log --color --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit"

# Show branches sorted by last commit
git config --global alias.recent "branch --sort=-committerdate --format='%(committerdate:short) %(refname:short)'"

# Undo last commit but keep changes
git config --global alias.undo 'reset --soft HEAD~1'
```

---

## Code Review Best Practices

### Creating Pull Requests

**Good PR Description:**
```markdown
## Summary
Add Firebase Hosting deployment configuration with preview channels

## Changes
- Add firebase.json with hosting config, caching headers, and security rules
- Add .firebaserc with project configuration
- Add deployment scripts: `deploy`, `deploy:preview`, `firebase:open`
- Update README with deployment documentation

## Testing
- ✅ Preview deployment successful
- ✅ Google authentication works on live URL
- ✅ Caching headers verified in DevTools

## Related Issues
Closes #42
Related to #38

## Screenshots
[Screenshot of deployed site]
```

### Reviewing Commits

```bash
# Review changes in PR branch
git diff main...feat/new-feature

# Review specific commit
git show abc1234

# Review changes to specific file
git log -p src/js/modules/auth.js

# Review branch commits
git log main..feat/new-feature --oneline
```

---

## Git Best Practices Checklist

### Before Committing
- [ ] Review changes: `git diff`
- [ ] Stage only related files: `git add <specific-files>`
- [ ] Run tests: `npm test`
- [ ] Run linter: `npm run lint`
- [ ] Write clear commit message following convention
- [ ] Commit message explains "why", not just "what"

### Before Pushing
- [ ] Commits are atomic and logical
- [ ] No secrets or sensitive data in commits
- [ ] Pull latest changes: `git pull --rebase origin main`
- [ ] Resolve any merge conflicts
- [ ] Verify all tests pass after rebase

### Before Creating PR
- [ ] Branch is up to date with main
- [ ] All commits follow commit message convention
- [ ] PR has clear title and description
- [ ] Related issues are linked
- [ ] Self-review completed
- [ ] Tests added for new features

### After PR Approval
- [ ] Squash commits if history is messy
- [ ] Merge using appropriate strategy
- [ ] Delete feature branch after merge
- [ ] Verify deployment was successful
- [ ] Close related issues

---

## Common Git Anti-Patterns to Avoid

- ❌ Committing directly to main branch
- ❌ Using `git add .` without reviewing changes
- ❌ Large commits with many unrelated changes
- ❌ Commit messages like "fix", "update", "wip"
- ❌ Committing generated files (node_modules, build artifacts)
- ❌ Committing secrets (.env files, API keys)
- ❌ Force pushing to shared branches
- ❌ Rebasing public/shared branches
- ❌ Not pulling before pushing
- ❌ Leaving merge conflict markers in code
- ❌ Creating overly long-lived feature branches
- ❌ Mixing formatting changes with logic changes

---

## Git Commands Quick Reference

```bash
# Essential Commands
git status                  # Check working directory status
git add <file>             # Stage file
git commit -m "message"    # Commit staged changes
git push                   # Push to remote
git pull                   # Pull from remote

# Branching
git branch                 # List branches
git branch <name>          # Create branch
git checkout <name>        # Switch branch
git checkout -b <name>     # Create and switch
git branch -d <name>       # Delete branch

# History
git log                    # View commit history
git log --oneline          # Compact history
git log --graph            # Visual branch history
git show <commit>          # Show commit details

# Undoing
git reset HEAD <file>      # Unstage file
git checkout -- <file>     # Discard changes
git revert <commit>        # Revert commit
git reset --soft HEAD~1    # Undo last commit

# Remote
git remote -v              # List remotes
git fetch                  # Fetch from remote
git pull --rebase          # Pull with rebase
git push origin <branch>   # Push branch

# Stashing
git stash                  # Save changes
git stash pop              # Apply and remove
git stash list             # List stashes
```

---

## Troubleshooting Common Issues

### Merge Conflicts

```bash
# View conflicted files
git status

# Resolve conflicts in editor, then:
git add <resolved-file>
git commit

# Abort merge
git merge --abort
```

### Accidentally Committed to Wrong Branch

```bash
# Move commit to new branch
git branch new-branch
git reset --hard HEAD~1
git checkout new-branch
```

### Need to Undo Pushed Commit

```bash
# Use revert (creates new commit)
git revert <commit-hash>
git push origin main

# ❌ Avoid force push to shared branches
```

### Forgot to Add File to Commit

```bash
# Amend last commit (only if not pushed!)
git add forgotten-file.js
git commit --amend --no-edit
```

---

## Resources

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Official Documentation](https://git-scm.com/doc)
- [Semantic Versioning](https://semver.org/)
- [Pro Git Book](https://git-scm.com/book/en/v2)
- [GitHub Flow](https://guides.github.com/introduction/flow/)
