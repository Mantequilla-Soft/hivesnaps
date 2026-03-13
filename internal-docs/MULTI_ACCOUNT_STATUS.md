# Multi-Account Feature - Current Status & Roadmap

**Last Updated**: March 13, 2026  
**Status**: Phase 1 Complete, Phase 2-4 In Progress

---

## 📋 Overview

The multi-account feature is being implemented in stages following the plan in `MULTI_ACCOUNT_IMPLEMENTATION_PLAN.md`. The complete implementation exists in the `feature/multi-account-pin-auth` branch but is too large to merge as-is. This document tracks our progress in breaking it down into reviewable PRs.

---

## ✅ Completed Work

### PR #1: Multi-Account Storage Service ✅ MERGED

**Branch**: `feature/multi-account-storage-service` (#190)  
**Status**: ✅ Merged to main  
**Commit**: `0ee169e`

**What Was Delivered**:

- `services/AccountStorageService.ts` - Full multi-account storage service
- Complete test suite in `services/__tests__/AccountStorageService.test.ts`
- Support for multiple accounts with separate posting/active keys
- Legacy migration support built-in
- Thread-safe operations with internal locking

**Integration Status**: ⚠️ **SERVICE EXISTS BUT NOT YET USED BY APP**

- The app still uses old storage format (`hive_username`, `hive_posting_key`)
- LoginScreen.tsx uses old SecureStore directly
- useAuth.ts uses old keys
- This is intentional - service will be integrated in PR #4

---

## 🚧 Work In Progress

### Reference Branch: feature/multi-account-pin-auth

This branch contains the **COMPLETE** implementation of all features from PRs #2-10. We need to extract from it in stages.

**What's In This Branch**:

- ✅ LocalAuthService (PR #2)
- ✅ Store updates with hasActiveKey (PR #3)
- ✅ AccountStorageService integration in login (PR #4)
- ✅ AccountSelectionScreen (PR #5)
- ✅ AddActiveKeyScreen (PR #6)
- ✅ Avatar management with active key (PR #7)
- ✅ MigrationScreen (PR #8)
- ✅ Profile enhancements (PR #9)
- ✅ All documentation (PR #10)

---

## 📝 Roadmap: Next Steps

### Phase 1: Core Services (Week 1-2)

#### PR #2: Local Authentication Service ⏳ NEXT

**Branch**: `feat/local-auth-service` (to be created)  
**Dependencies**: None  
**Estimated Time**: 1 day  
**Priority**: High

**Files to Extract from feature/multi-account-pin-auth**:

- `services/LocalAuthService.ts`
- `types/expo-local-authentication.d.ts`

**Dependencies to Add**:

```json
"expo-local-authentication": "~17.0.0"
```

**Testing Checklist**:

- [ ] Works on iOS (Face ID/Touch ID)
- [ ] Works on Android (fingerprint)
- [ ] Handles cancellation gracefully
- [ ] Proper error messages

**Success Criteria**:

- Service exists but not integrated yet
- Can authenticate via biometric/PIN
- Unit tests pass
- Documented

---

#### PR #3: Store Updates for Multi-Account ⏳ READY

**Branch**: `feat/store-multi-account-types` (to be created)  
**Dependencies**: None  
**Estimated Time**: 1 day  
**Priority**: High

**Files to Extract/Modify**:

- `store/types.ts` - Add `hasActiveKey: boolean` to UserState
- `store/userSlice.ts` - Add `USER_SET_HAS_ACTIVE_KEY` action + handler
- `store/context.tsx` - Add `setHasActiveKey` dispatcher and selector

**Testing Checklist**:

- [ ] Existing functionality unchanged
- [ ] New state management works
- [ ] TypeScript types correct
- [ ] All screens still work

**Success Criteria**:

- Store can track hasActiveKey state
- No breaking changes
- Backward compatible

---

### Phase 2: Integration (Week 2-3)

#### PR #4: Integrate AccountStorageService into Login ⏳ PENDING

**Branch**: `feat/integrate-account-storage` (to be created)  
**Dependencies**: PR #1 (merged), PR #3  
**Estimated Time**: 2 days  
**Priority**: Critical

**Files to Modify**:

```
app/screens/LoginScreen.tsx
hooks/useAuth.ts
app/index.tsx
```

**Key Changes**:

1. LoginScreen: Use `AccountStorageService.addAccount()` instead of direct SecureStore
2. useAuth: Load keys from AccountStorageService
3. app/index.tsx: Load current account on startup

**Testing Checklist**:

- [ ] Login works exactly as before (UX unchanged)
- [ ] Keys stored in new format
- [ ] App remembers logged-in user
- [ ] Can restart app and stay logged in
- [ ] Old users can still log in (before migration)

**Success Criteria**:

- Behind-the-scenes change only
- No visible UX difference
- All existing functionality works
- Ready for account switching

---

#### PR #5: Account Selection Screen ⏳ PENDING

**Branch**: `feat/account-selection-screen` (to be created)  
**Dependencies**: PR #4  
**Estimated Time**: 2 days  
**Priority**: High

**Files to Extract**:

```
app/screens/AccountSelectionScreen.tsx
styles/AccountSelectionScreenStyles.ts
```

**Files to Modify**:

```
hooks/useAuth.ts - Add switchAccount()
app/screens/ProfileScreen.tsx - Add "Switch Account" button
app/_layout.tsx - Add route
```

**Features**:

- List all stored accounts
- Switch between accounts
- Add new account
- Delete account
- Show current account indicator

**Testing Checklist**:

- [ ] Can view all accounts
- [ ] Switching works smoothly
- [ ] Can add account from selection screen
- [ ] Can delete account with confirmation
- [ ] Current account shows correctly

**Success Criteria**:

- First visible multi-account feature
- Smooth switching experience (<1s)
- Clear UX

---

### Phase 3: Active Key Features (Week 3-4)

#### PR #6: Active Key Management UI ⏳ PENDING

**Branch**: `feat/active-key-management` (to be created)  
**Dependencies**: PR #2, PR #4, PR #5  
**Estimated Time**: 2 days  
**Priority**: Medium

**Files to Extract**:

```
app/screens/AddActiveKeyScreen.tsx
styles/AddActiveKeyScreenStyles.ts
```

**Files to Modify**:

```
hooks/useAuth.ts - Add requireActiveKey()
app/screens/ProfileScreen.tsx - Add "Manage Active Key" option
```

**Features**:

- Add active key to account
- Validate key against blockchain
- Remove active key
- Require biometric auth for sensitive operations

**Testing Checklist**:

- [ ] Can add valid active key
- [ ] Invalid key shows error
- [ ] Key validation works
- [ ] Can remove key
- [ ] Biometric auth required

**Success Criteria**:

- Optional active key support
- Clear explanation of benefits
- Secure key handling

---

#### PR #7: Avatar Updates with Active Key ⏳ PENDING

**Branch**: `feat/avatar-update-active-key` (to be created)  
**Dependencies**: PR #6  
**Estimated Time**: 2 days  
**Priority**: Medium

**Files to Modify**:

```
hooks/useAvatarManagement.ts - Add updateAvatar()
app/screens/ProfileScreen.tsx - Add "Edit Avatar" button
```

**Features**:

- Update avatar using active key
- Sign account_update operation
- Broadcast to blockchain
- Prompt for active key if not available

**Testing Checklist**:

- [ ] Avatar update works with active key
- [ ] Prompts when no active key
- [ ] Transaction signs correctly
- [ ] Error handling works

**Success Criteria**:

- Demonstrates active key value
- Clear UX for key requirement

---

### Phase 4: Migration & Polish (Week 4-5)

#### PR #8: Legacy Migration ⏳ PENDING

**Branch**: `feat/legacy-migration` (to be created)  
**Dependencies**: PR #4  
**Estimated Time**: 1-2 days  
**Priority**: Critical

**Files to Extract**:

```
app/screens/MigrationScreen.tsx
styles/MigrationScreenStyles.ts
```

**Files to Modify**:

```
services/AccountStorageService.ts - Already has migration logic!
app/index.tsx - Check for legacy account on startup
```

**Migration Flow**:

1. Detect old `hive_username` / `hive_posting_key` on startup
2. Show MigrationScreen explaining upgrade
3. Migrate to new format using AccountStorageService
4. Delete old keys
5. Navigate to feed

**Testing Checklist**:

- [ ] Detects legacy accounts
- [ ] Migration succeeds
- [ ] No data loss
- [ ] Runs only once
- [ ] Handles failures gracefully

**Success Criteria**:

- Seamless upgrade for existing users
- Clear messaging
- No data loss

---

#### PR #9: Profile UI Enhancements ⏳ PENDING

**Branch**: `feat/profile-active-key-indicator` (to be created)  
**Dependencies**: PR #6  
**Estimated Time**: 1 day  
**Priority**: Low

**Files to Modify**:

```
app/screens/ProfileScreen.tsx
styles/ProfileScreenStyles.ts
```

**Features**:

- Show "🔑 Full Access" or "📝 Posting Only" badge
- Info modal explaining key types
- Color-coded indicators

**Testing Checklist**:

- [ ] Badge shows correctly based on key type
- [ ] Info modal helpful
- [ ] Doesn't clutter UI

**Success Criteria**:

- Clear visual indicator
- Educational
- Subtle design

---

#### PR #10: Documentation & Final Polish ⏳ PENDING

**Branch**: `feat/multi-account-docs` (to be created)  
**Dependencies**: All previous PRs  
**Estimated Time**: 1 day  
**Priority**: Medium

**Files to Add**:

```
docs/MULTI_ACCOUNT_USAGE.md
docs/MULTI_ACCOUNT_ARCHITECTURE.md
docs/SECURITY_ACTIVE_KEYS.md
```

**Content**:

- User guide for multi-account
- Developer docs for AccountStorageService
- Security explanation
- Migration guide

---

## 🎯 Current Priority Order

1. **PR #2: LocalAuthService** - Standalone, needed for PR #6
2. **PR #3: Store Updates** - Standalone, needed for PR #4
3. **PR #4: Integration** - Critical for everything else
4. **PR #8: Migration** - Should come soon after PR #4
5. **PR #5: Account Selection** - First visible feature
6. **PR #6: Active Key Management** - Needs PR #2
7. **PR #7: Avatar Updates** - Demonstrates active key value
8. **PR #9: Profile Enhancements** - Polish
9. **PR #10: Documentation** - Final step

---

## 📊 Extraction Strategy

### For Each PR:

1. **Create new branch from main**

   ```bash
   git checkout main
   git pull
   git checkout -b feat/[feature-name]
   ```

2. **Extract files from feature/multi-account-pin-auth**

   ```bash
   git checkout feature/multi-account-pin-auth -- [file-path]
   ```

3. **Review and adapt extracted code**
   - Remove dependencies on other unmerged features
   - Ensure it works as standalone
   - Update imports if needed

4. **Test thoroughly**
   - Unit tests
   - Integration tests
   - Manual testing

5. **Create PR with clear description**
   - Reference this plan
   - Explain what's included
   - Note dependencies

---

## 🚨 Critical Notes

### DO NOT Include in Early PRs:

- Account switching UI (wait for PR #5)
- Active key features (wait for PR #6)
- Migration screens (wait for PR #8)

### Maintain Backward Compatibility:

- PRs #2-3 are pure additions
- PR #4 is behind-the-scenes only
- PR #8 handles migration
- Old users should work until PR #8

### Testing Strategy:

- Each PR includes its own tests
- No breaking changes until PR #8
- Test with fresh install AND existing users

---

## 📈 Success Metrics

- [ ] All 10 PRs merged
- [ ] Zero data loss incidents
- [ ] Migration success rate >99%
- [ ] Account switch time <1 second
- [ ] No performance regression
- [ ] All tests pass

---

## 🤝 Review Checklist (For Each PR)

- [ ] Code follows project guidelines
- [ ] TypeScript types are correct
- [ ] No hardcoded colors (use theme)
- [ ] Business logic in hooks, not components
- [ ] Static imports only (no dynamic imports)
- [ ] Tests included and passing
- [ ] Documentation updated
- [ ] No breaking changes (before PR #8)
- [ ] Works on iOS and Android

---

## 📞 Questions?

If you need to reference the original implementation, check:

- Branch: `feature/multi-account-pin-auth`
- Original plan: `internal-docs/MULTI_ACCOUNT_IMPLEMENTATION_PLAN.md`
