# Quick Guide: Extracting Features from Multi-Account Branch

This guide shows you how to extract specific features from the `feature/multi-account-pin-auth` branch and create focused PRs.

---

## 🎯 Before You Start

1. Review `MULTI_ACCOUNT_STATUS.md` to see what's next
2. Check dependencies for the PR you're working on
3. Read the corresponding section in `MULTI_ACCOUNT_IMPLEMENTATION_PLAN.md`

---

## 📝 Step-by-Step Process

### 1. Create a New Feature Branch

```bash
# Make sure you're on main and up to date
git checkout main
git pull origin main

# Create new branch for the feature
git checkout -b feat/[feature-name]

# Example:
git checkout -b feat/local-auth-service
```

### 2. View Files in Multi-Account Branch

```bash
# List all files changed in the multi-account branch
git diff main feature/multi-account-pin-auth --name-only

# View a specific file from that branch
git show feature/multi-account-pin-auth:path/to/file.ts

# Example:
git show feature/multi-account-pin-auth:services/LocalAuthService.ts
```

### 3. Extract Specific Files

```bash
# Copy a file from the multi-account branch to your current branch
git checkout feature/multi-account-pin-auth -- path/to/file.ts

# Example for PR #2 (LocalAuthService):
git checkout feature/multi-account-pin-auth -- services/LocalAuthService.ts
git checkout feature/multi-account-pin-auth -- types/expo-local-authentication.d.ts
```

### 4. Review and Adapt the Code

- **Check imports**: Make sure extracted files don't import from unmerged features
- **Remove dependencies**: If the file uses features not yet merged, adapt it
- **Follow guidelines**: Ensure code follows project standards (see `.github/copilot-instructions.md`)
- **Update for main**: The code might reference things that changed since the branch was created

### 5. Test Thoroughly

```bash
# Run tests
npm test

# Run specific test file
npm test -- AccountStorageService.test

# Start the app
npx expo start
```

### 6. Create PR

```bash
# Stage your changes
git add .

# Commit with clear message
git commit -m "feat: Add LocalAuthService for biometric authentication

Implements PR #2 from multi-account implementation plan.
Provides wrapper for expo-local-authentication.

Related to #190 (multi-account storage service)"

# Push to origin
git push origin feat/local-auth-service
```

Then create a PR on GitHub with:

- Clear description
- Reference to the implementation plan
- Testing checklist
- Dependencies noted

---

## 🔍 Example: Extracting PR #2 (LocalAuthService)

### Files Needed:

- `services/LocalAuthService.ts`
- `types/expo-local-authentication.d.ts`

### Commands:

```bash
# Create branch
git checkout main
git checkout -b feat/local-auth-service

# Extract files
git checkout feature/multi-account-pin-auth -- services/LocalAuthService.ts
git checkout feature/multi-account-pin-auth -- types/expo-local-authentication.d.ts

# Add dependency to package.json
npm install expo-local-authentication@~17.0.0

# Review the code
code services/LocalAuthService.ts

# Test
npm test

# Commit
git add .
git commit -m "feat: Add LocalAuthService for biometric authentication"
git push origin feat/local-auth-service
```

---

## 🔧 Common Scenarios

### Scenario 1: File Depends on Unmerged Feature

**Problem**: Extracted file imports from `AccountSelectionScreen` which isn't merged yet.

**Solution**:

1. Remove or comment out the dependency
2. Add a TODO comment
3. Document in PR that this will be uncommented later

```typescript
// import { AccountSelectionScreen } from '../screens/AccountSelectionScreen';
// TODO: Uncomment when PR #5 is merged
```

### Scenario 2: File Has Conflicts with Main

**Problem**: File structure changed since multi-account branch was created.

**Solution**:

1. Extract the file
2. Use `git diff` to see what changed in main
3. Manually merge the changes
4. Test thoroughly

```bash
# See what changed in main for a specific file
git diff main feature/multi-account-pin-auth -- path/to/file.ts
```

### Scenario 3: Need Only Part of a File

**Problem**: A file has multiple features, but you only need one part.

**Solution**:

1. Extract the full file
2. Manually remove the unneeded parts
3. Keep TODO comments for what's coming later

Example:

```typescript
// useAuth.ts - Extract only the authentication logic, not switching yet

export const useAuth = () => {
  // ... existing auth code ...
  // TODO: Add switchAccount() in PR #5
  // const switchAccount = () => { ... }
};
```

---

## ✅ Pre-PR Checklist

Before creating a PR, verify:

- [ ] All files extracted and working
- [ ] No imports to unmerged features
- [ ] Tests added/passing
- [ ] Follows project guidelines:
  - [ ] No hardcoded colors (use theme)
  - [ ] Business logic in hooks, not components
  - [ ] Static imports only
  - [ ] TypeScript types defined
- [ ] Documentation updated if needed
- [ ] Tested on both iOS and Android (if UI changes)
- [ ] No breaking changes to existing features
- [ ] Git commit message follows convention

---

## 🚨 Common Mistakes to Avoid

1. **Don't extract too much at once** - Stick to the PR scope
2. **Don't skip testing** - Even if "it worked in the other branch"
3. **Don't forget dependencies** - Check package.json changes
4. **Don't break existing features** - Test the whole app, not just your feature
5. **Don't ignore TypeScript errors** - Fix them, don't use `any`

---

## 🎓 Tips for Success

1. **Start small**: PR #2 and #3 are good starting points
2. **Test incrementally**: Don't extract everything before testing
3. **Read the plan**: Each PR section has important notes
4. **Ask for help**: If something's unclear, ask before guessing
5. **Document changes**: Update this guide if you find issues

---

## 📞 Need Help?

- Check `MULTI_ACCOUNT_STATUS.md` for current state
- Review `MULTI_ACCOUNT_IMPLEMENTATION_PLAN.md` for details
- Look at merged PR #1 (#190) as an example
- Check the multi-account branch for working code reference

---

## 🎯 Quick Reference: File Locations by PR

### PR #2: LocalAuthService

```
services/LocalAuthService.ts
types/expo-local-authentication.d.ts
```

### PR #3: Store Updates

```
store/types.ts (modify)
store/userSlice.ts (modify)
store/context.tsx (modify)
```

### PR #4: Integration

```
app/screens/LoginScreen.tsx (modify)
hooks/useAuth.ts (modify)
app/index.tsx (modify)
```

### PR #5: Account Selection

```
app/screens/AccountSelectionScreen.tsx
styles/AccountSelectionScreenStyles.ts
hooks/useAuth.ts (modify - add switchAccount)
app/screens/ProfileScreen.tsx (modify)
app/_layout.tsx (modify - add route)
```

### PR #6: Active Key Management

```
app/screens/AddActiveKeyScreen.tsx
styles/AddActiveKeyScreenStyles.ts
hooks/useAuth.ts (modify - add requireActiveKey)
app/screens/ProfileScreen.tsx (modify)
```

### PR #7: Avatar Updates

```
hooks/useAvatarManagement.ts (modify)
app/screens/ProfileScreen.tsx (modify)
```

### PR #8: Migration

```
app/screens/MigrationScreen.tsx
styles/MigrationScreenStyles.ts
app/index.tsx (modify - add migration check)
```

### PR #9: Profile Enhancements

```
app/screens/ProfileScreen.tsx (modify)
styles/ProfileScreenStyles.ts (modify)
```

### PR #10: Documentation

```
docs/MULTI_ACCOUNT_USAGE.md
docs/MULTI_ACCOUNT_ARCHITECTURE.md
docs/SECURITY_ACTIVE_KEYS.md
README.md (modify)
```
