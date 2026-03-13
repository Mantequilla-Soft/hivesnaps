# Multi-Account Feature Implementation Plan

## Overview

This document outlines the step-by-step implementation plan for adding multi-account support and active key management to HiveSnaps. The feature set is broken down into small, reviewable PRs that build on each other incrementally.

**Current Status**: Large PR exists with all features combined  
**Goal**: Break into 8-10 smaller PRs that can be reviewed and merged independently  
**Timeline**: Each PR should take 1-3 days of development work

---

## Reference Implementation

The original work for this feature exists in a large branch/PR that contains all the code combined. While this PR is too large to review and merge as-is, it serves as an excellent reference implementation.

**Reference Branch**: (Add branch name here - e.g., `feature/multi-account-all-features`)  
**Reference PR**: (Add PR number/link here)

**How to Use the Reference**:

- Review working code examples for each feature
- Copy proven implementations when building individual PRs
- Verify edge cases that were already handled
- Reference tested patterns and solutions
- Use as a source of truth for functionality requirements

**Important Notes**:

- Reference branch contains all features mixed together
- Extract and adapt code into focused, single-purpose PRs
- Refactor as needed to improve clarity and separation
- Ensure each new PR maintains the same functionality
- Don't copy blindly - review and understand each piece

---

## Feature Summary

### Core Features Being Added

1. **Multi-Account Storage** - Store multiple Hive accounts securely
2. **Account Switching** - Switch between stored accounts
3. **Active Key Support** - Optional active key storage per account
4. **Local Authentication** - Biometric/PIN authentication for sensitive operations
5. **Legacy Migration** - Migrate from old single-account storage
6. **Enhanced Profile UI** - Show account capabilities (posting/active)
7. **Avatar Management** - Update avatar with active key signing

---

## Implementation Phases

### Phase 1: Foundation & Storage (PRs #1-3)

Set up the core infrastructure without changing existing functionality.

### Phase 2: Account Management (PRs #4-5)

Add account switching and selection UI.

### Phase 3: Active Keys (PRs #6-7)

Implement optional active key functionality.

### Phase 4: Migration & Polish (PRs #8-9)

Handle legacy data and complete the feature.

---

## Detailed PR Breakdown

### PR #1: Add Multi-Account Storage Service

**Branch**: `feature/multi-account-storage-service`  
**Dependencies**: None  
**Estimated Time**: 1-2 days

**Description**: Create the `AccountStorageService` that can store multiple accounts in SecureStore, but don't change existing login/auth flows yet.

**Files to Add**:

- `services/AccountStorageService.ts` - Core service for managing multiple accounts
  - `addAccount(username, postingKey, activeKey?)` - Add new account
  - `getAccounts()` - List all stored accounts
  - `getAccount(username)` - Get specific account
  - `removeAccount(username)` - Remove account
  - `getAccountKeys(username)` - Retrieve keys for account
  - `hasActiveKey(username)` - Check if account has active key
  - `updateLastUsed(username)` - Update last used timestamp

**Files to Modify**:

- None (pure addition)

**Testing**:

- Unit tests for all AccountStorageService methods
- Test encryption/decryption of keys
- Test account CRUD operations
- Verify keys are stored separately per account

**Success Criteria**:

- Service can store multiple accounts with separate keys
- Keys are encrypted in SecureStore
- All methods have proper error handling
- Service is tested but not yet integrated

**Notes**:

- Service should support both `postingKey` and optional `activeKey`
- Use SecureStore with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`
- Store keys as: `account:{username}:postingKey` and `account:{username}:activeKey`
- Store account list as: `hive_accounts_v3`
- DO NOT modify existing auth flows yet

---

### PR #2: Add Local Authentication Service

**Branch**: `feature/local-auth-service`  
**Dependencies**: None  
**Estimated Time**: 1 day

**Description**: Add biometric/PIN authentication service using `expo-local-authentication`.

**Files to Add**:

- `services/LocalAuthService.ts` - Wrapper for expo-local-authentication
  - `authenticate(promptMessage)` - Request biometric auth
  - `isAvailable()` - Check if biometric auth is available
  - `getSupportedTypes()` - Get supported auth methods
- `types/expo-local-authentication.d.ts` - TypeScript declarations

**Dependencies to Add**:

- `expo-local-authentication: ~17.0.0`

**Files to Modify**:

- `package.json` - Add expo-local-authentication

**Testing**:

- Test authentication on both iOS and Android
- Test fallback to PIN/password
- Test cancellation handling
- Test error scenarios

**Success Criteria**:

- Service can request biometric authentication
- Proper error handling for cancellation
- Works on both iOS (Face ID/Touch ID) and Android (fingerprint)
- Service is tested but not yet integrated into app flows

**Notes**:

- Keep it simple - just a thin wrapper around expo-local-authentication
- Don't integrate into auth flows yet
- Document the error codes

---

### PR #3: Update Store Types for Multi-Account

**Branch**: `feature/store-multi-account-types`  
**Dependencies**: None  
**Estimated Time**: 1 day

**Description**: Update the Redux-like store to support multi-account state without breaking existing functionality.

**Files to Modify**:

- `store/types.ts`
  - Keep `currentUser: string | null` (no change)
  - Add `hasActiveKey: boolean` to UserState
- `store/userSlice.ts`
  - Add `USER_SET_HAS_ACTIVE_KEY` action
  - Add action handler for hasActiveKey
  - Add selector: `getHasActiveKey()`
- `store/context.tsx`
  - Add `setHasActiveKey` dispatcher
  - Expose `hasActiveKey` in selectors

**Testing**:

- Test that existing functionality still works
- Test new hasActiveKey state management
- Verify no breaking changes to current auth flow

**Success Criteria**:

- Store can track whether current account has active key
- No breaking changes to existing features
- TypeScript types are correct
- All existing screens still work

**Notes**:

- This is purely additive - don't remove or change existing state
- The `hasActiveKey` field will be populated later when accounts are loaded

---

### PR #4: Integrate AccountStorageService into Login

**Branch**: `feature/integrate-account-storage-login`  
**Dependencies**: PR #1, PR #3  
**Estimated Time**: 2 days

**Description**: Modify login screen to use AccountStorageService instead of directly using SecureStore. Add "current account" concept.

**Files to Modify**:

- `app/screens/LoginScreen.tsx`
  - After successful login, call `AccountStorageService.addAccount()`
  - Set as current account with `setCurrentAccountUsername()`
  - Set `hasActiveKey: false` (only posting key at login)
- `hooks/useAuth.ts`
  - Update `authenticate()` to use AccountStorageService
  - Add `getCurrentUser()` method
  - Add `hasActiveKey()` method (returns state.hasActiveKey)
- `app/index.tsx` (app entry point)
  - On app start, load current account from AccountStorageService
  - Set currentUser and hasActiveKey in store
  - If account exists, authenticate silently

**Testing**:

- Test login flow with new storage
- Verify existing users can still log in
- Test app restart with stored account
- Verify keys are accessible after login

**Success Criteria**:

- Login works exactly as before from user perspective
- Accounts are now stored in new multi-account format
- App remembers logged-in user across restarts
- All existing functionality still works

**Notes**:

- This is a behind-the-scenes change - UX should be identical
- Keep legacy storage support for migration (next PR)
- Only posting key is stored at login (active key comes later)

---

### PR #5: Add Account Selection Screen

**Branch**: `feature/account-selection-screen`  
**Dependencies**: PR #1, PR #3, PR #4  
**Estimated Time**: 2 days

**Description**: Create UI to view and switch between stored accounts.

**Files to Add**:

- `app/screens/AccountSelectionScreen.tsx` - List of accounts with switch functionality
- `styles/AccountSelectionScreenStyles.ts` - Styles for the screen
- Navigation route in `app/_layout.tsx`

**Files to Modify**:

- `hooks/useAuth.ts`
  - Add `switchAccount(username)` method
  - Loads keys for selected account
  - Updates store with new currentUser
  - Re-authenticates with backend
- `app/screens/ProfileScreen.tsx`
  - Add "Switch Account" button in settings/menu
  - Navigate to AccountSelectionScreen

**UI Components**:

- List of stored accounts with avatar and username
- Show last used timestamp
- "Add Account" button (navigates to login)
- Long press to delete account (with confirmation)
- Badge showing which account is current

**Testing**:

- Test switching between accounts
- Test adding new account from selection screen
- Test deleting account
- Verify switching re-authenticates properly
- Test with 1, 2, and 5+ accounts

**Success Criteria**:

- Users can see all stored accounts
- Switching accounts works smoothly
- Can add new accounts without losing existing ones
- Data (feed, notifications) updates after switch
- Logout keeps other accounts intact

**Notes**:

- This is the first visible multi-account feature
- Focus on clarity and ease of use
- Make sure switching is fast (<1 second)

---

### PR #6: Add Active Key Management UI

**Branch**: `feature/active-key-management`  
**Dependencies**: PR #2, PR #4  
**Estimated Time**: 2 days

**Description**: Create screen for users to optionally add their active key to an account.

**Files to Add**:

- `app/screens/AddActiveKeyScreen.tsx` - Screen to add/update active key
- `styles/AddActiveKeyScreenStyles.ts` - Styles
- `app/components/profile/ActiveKeyModal.tsx` - Reusable modal component
- Navigation route in `app/_layout.tsx`

**Files to Modify**:

- `services/AccountStorageService.ts`
  - Add `addActiveKey(username, activeKey)` method
  - Add `removeActiveKey(username)` method
  - Validates active key against blockchain before storing
- `hooks/useAuth.ts`
  - Add `requireActiveKey()` method - prompts user to add key if not present
  - Returns true if has key, false if user needs to add it
- `app/screens/ProfileScreen.tsx`
  - Show badge/indicator if account has active key
  - Add "Manage Active Key" option in settings

**UI Features**:

- Secure text input for active key
- "Why do I need this?" explanation
- Validate key with blockchain before saving
- Option to remove active key
- Require biometric auth before showing/removing key

**Testing**:

- Test adding valid active key
- Test adding invalid active key (should show error)
- Test validation against Hive blockchain
- Test removing active key
- Test that key persists across app restarts

**Success Criteria**:

- Users can optionally add active key to any account
- Key validation works correctly
- Keys are encrypted in SecureStore
- Clear explanation of when/why active key is needed
- Can remove key if user wants

**Security Notes**:

- NEVER log active keys
- Require biometric auth for sensitive operations
- Validate keys before storing
- Make it clear this is optional

---

### PR #7: Use Active Key for Avatar Updates

**Branch**: `feature/avatar-update-with-active-key`  
**Dependencies**: PR #6  
**Estimated Time**: 2 days

**Description**: Implement avatar update functionality that uses active key to sign blockchain transactions.

**Files to Modify**:

- `hooks/useAvatarManagement.ts`
  - Add `updateAvatar(newImageUrl)` method
  - Check if active key is available with `requireActiveKey()`
  - If no active key, prompt user to add it
  - Use active key to sign `account_update` operation
  - Broadcast transaction to Hive
- `app/screens/ProfileScreen.tsx`
  - Add "Edit Avatar" button (only on own profile)
  - Show ActiveKeyModal if active key not available
  - Show success/error feedback
- `app/components/profile/EditAvatarModal.tsx`
  - Image picker integration
  - Upload to IPFS or image host
  - Confirm before submitting transaction

**Blockchain Operations**:

- Build `account_update` operation with new `profile_image`
- Sign with active key using dhive
- Broadcast to Hive blockchain
- Handle errors (insufficient RC, invalid key, etc.)

**Testing**:

- Test avatar update with active key
- Test error when no active key (should prompt)
- Test transaction signing and broadcasting
- Test error handling (network issues, etc.)
- Verify avatar updates on blockchain

**Success Criteria**:

- Users with active key can update avatar
- Users without active key are prompted to add it
- Transaction is properly signed and broadcast
- Avatar updates immediately in app
- Proper error messages for all failure cases

**Notes**:

- This demonstrates the value of storing active key
- Keep the UX simple and clear
- Don't block users who don't want to add active key

---

### PR #8: Legacy Account Migration

**Branch**: `feature/legacy-account-migration`  
**Dependencies**: PR #2, PR #4  
**Estimated Time**: 1-2 days

**Description**: Migrate existing users from old storage format to new multi-account storage.

**Files to Add**:

- `app/screens/MigrationScreen.tsx` - One-time migration UI
- `styles/MigrationScreenStyles.ts` - Styles

**Files to Modify**:

- `services/AccountStorageService.ts`
  - Add `getLegacyAccount()` method - reads old storage keys
  - Add `deleteLegacyAccount()` method - removes old keys
  - Legacy keys: `hive_username`, `hive_posting_key`
- `app/index.tsx` (app entry)
  - Check for legacy account on startup
  - If found, navigate to MigrationScreen
  - If not, proceed normally

**Migration Flow**:

1. Detect legacy account on app start
2. Show migration screen explaining the change
3. User taps "Migrate" button
4. Read legacy username and posting key
5. Call `AccountStorageService.addAccount()`
6. Delete legacy keys
7. Set as current account
8. Navigate to feed

**Testing**:

- Test with app that has legacy account
- Test with app that has no account
- Test with app that's already migrated
- Verify migration only happens once
- Test migration success and failure scenarios

**Success Criteria**:

- Existing users seamlessly migrate to new storage
- No data loss during migration
- Migration only runs once per device
- Clear explanation of what's happening
- Fallback if migration fails

**Notes**:

- Make migration feel like a feature upgrade, not a breaking change
- Provide clear messaging about enhanced security
- Don't force migration - allow user to cancel if nervous

---

### PR #9: Profile Screen Enhancements

**Branch**: `feature/profile-active-key-indicator`  
**Dependencies**: PR #3, PR #6  
**Estimated Time**: 1 day

**Description**: Update profile screen to show account capabilities and active key status.

**Files to Modify**:

- `app/screens/ProfileScreen.tsx`
  - Add badge showing "Posting Key Only" or "Full Access"
  - Different badge color based on hasActiveKey
  - Add info modal explaining key types
  - Update settings menu with active key options
- `app/components/profile/ProfileHeader.tsx`
  - Show key type indicator in header
  - Make it subtle but informative

**UI Elements**:

- Small badge near username: "🔑 Full Access" or "📝 Posting Only"
- Tapping badge shows explanation modal
- Color coded: green for full access, yellow for posting only

**Testing**:

- Test display with posting key only
- Test display with both keys
- Test info modal
- Test on own profile vs other profiles

**Success Criteria**:

- Clear visual indicator of account capabilities
- Educational info modal
- Doesn't clutter the UI
- Works on both own and other profiles

**Notes**:

- Keep it subtle - this is informational, not alarming
- Focus on education, not fear
- Make users aware of the benefits of adding active key

---

### PR #10: Documentation & Polish

**Branch**: `feature/multi-account-docs-polish`  
**Dependencies**: All previous PRs  
**Estimated Time**: 1 day

**Description**: Add comprehensive documentation and final polish.

**Files to Add**:

- `docs/MULTI_ACCOUNT_USAGE.md` - User guide
- `docs/MULTI_ACCOUNT_ARCHITECTURE.md` - Technical docs
- `docs/SECURITY_ACTIVE_KEYS.md` - Security explanation

**Files to Modify**:

- `README.md` - Add multi-account feature to feature list
- `docs/HiveSnaps_Security_Explanation.md` - Update with new security features
- All screens - Polish animations, loading states, error messages

**Content to Add**:

- User guide: How to add/switch accounts
- User guide: What is an active key and when to add it
- Developer docs: How AccountStorageService works
- Developer docs: How to check for active key in new features
- Security docs: How keys are protected

**Testing**:

- Full end-to-end testing of all flows
- Test on fresh install
- Test as existing user
- Test edge cases and error scenarios
- Performance testing with many accounts

**Success Criteria**:

- Complete documentation for users and developers
- All flows are polished and smooth
- No rough edges or confusing UX
- Clear error messages everywhere
- Comprehensive test coverage

---

## Testing Strategy

### Per PR Testing

Each PR should include:

- Unit tests for new services/functions
- Integration tests for modified flows
- Manual testing checklist
- Screenshot/video of UI changes

### End-to-End Testing

After all PRs are merged:

- Test complete flow from new install to multi-account usage
- Test migration from legacy storage
- Test all combinations of account states
- Performance testing with 10+ accounts
- Security audit of key storage

### Test Devices

- iOS (iPhone) with Face ID
- Android (Samsung/Pixel) with fingerprint
- Devices without biometric (PIN fallback)

---

## Risk Mitigation

### Critical Risks

1. **Data Loss During Migration**
   - Mitigation: Backup legacy keys before deletion
   - Fallback: Restore from backup if migration fails

2. **Key Encryption Issues**
   - Mitigation: Extensive testing of SecureStore on various Android versions
   - Fallback: Graceful error handling with clear user guidance

3. **Breaking Changes**
   - Mitigation: Each PR maintains backward compatibility until migration
   - Testing: Verify existing users aren't affected until they migrate

4. **Authentication Failures**
   - Mitigation: Robust error handling and retry logic
   - Fallback: Allow re-login if auth fails

### Security Considerations

- Active keys are never logged
- Keys are encrypted at rest using OS-level encryption
- Biometric auth required for sensitive operations
- Keys validated before storage
- Clear audit trail in code reviews

---

## Success Metrics

### User Experience

- Migration success rate: >99%
- Account switch time: <1 second
- Feature adoption: >30% users add multiple accounts
- Active key adoption: >10% users add active key

### Technical

- Zero data loss incidents
- All PRs pass code review on first or second iteration
- Test coverage: >80% for new code
- No performance regression

### Timeline

- Complete all PRs within: 4-6 weeks
- Each PR reviewed within: 2 days
- Each PR merged within: 1 week of opening

---

## Rollout Plan

### Phase 1: Internal Testing (Week 1-2)

- Merge PRs #1-4
- Test with development team
- Fix any critical issues

### Phase 2: Beta Testing (Week 3-4)

- Merge PRs #5-7
- Release to beta testers
- Gather feedback on UX

### Phase 3: Migration (Week 5)

- Merge PR #8 (migration)
- Release to 10% of users
- Monitor for issues
- Gradual rollout to 100%

### Phase 4: Polish (Week 6)

- Merge PRs #9-10
- Address feedback
- Final release to all users

---

## Open Questions

1. **Maximum Accounts**: Should we limit the number of stored accounts?
   - Recommendation: Soft limit of 10, with warning beyond that

2. **Active Key Encryption**: Should we use additional encryption layer beyond SecureStore?
   - Recommendation: SecureStore is sufficient for most users; add option for advanced users later

3. **Account Color Coding**: Should accounts have colors/icons for quick identification?
   - Recommendation: Add in future enhancement PR

4. **Cloud Backup**: Should account metadata (not keys) sync across devices?
   - Recommendation: Out of scope for initial implementation

---

## Future Enhancements (Post-MVP)

These features are explicitly out of scope for the initial implementation:

1. **Account Grouping** - Organize accounts by use case
2. **Custom Account Nicknames** - Friendly names for accounts
3. **Quick Account Switcher** - Swipe gesture or dropdown in header
4. **Activity Isolation** - Separate feed/notifications per account
5. **Account-Specific Settings** - Different preferences per account
6. **Advanced Encryption** - User-provided passphrase for additional security
7. **Export/Import Accounts** - Move accounts between devices
8. **Posting Key Rotation** - Update keys without blockchain transaction
9. **Key Expiry/Reminders** - Prompt to rotate keys periodically
10. **Enterprise Features** - Support for shared/managed accounts

---

## Conclusion

This implementation plan breaks the multi-account feature into manageable, reviewable PRs while ensuring each step is tested and can be merged independently. The phased approach minimizes risk and allows for course correction based on feedback.

Each PR builds on previous ones but can be developed and tested independently, making code review manageable and reducing the risk of introducing bugs.

**Target Timeline**: 4-6 weeks from start to full rollout  
**Team Size**: 2-3 developers (parallel work on independent PRs)  
**Review Time**: 2-4 hours per PR

---

## Document Version

- **Version**: 1.0
- **Date**: February 26, 2026
- **Author**: Development Team
- **Status**: Approved for Implementation
