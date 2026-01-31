<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# HiveSnaps Code Guidelines

This project is a React Native app using Expo (managed workflow) and TypeScript. It is intended for Android and iOS, and will use Expo Camera and Media Library, as well as dhive for Hive blockchain integration.

## Code Quality Standards

### TypeScript
- Always use strict TypeScript types - avoid `any` type
- Prefer interfaces over types for object definitions
- Use proper error handling with typed error objects
- Ensure all functions have proper return type annotations

### React Native Best Practices
- Always use SafeAreaView for screen components
- Use KeyboardAvoidingView for forms and inputs
- Implement proper loading states and error handling
- Follow React Native performance best practices (FlatList for large lists, etc.)

### Architecture
- Keep components modular and focused on single responsibilities
- Use proper separation of concerns (services, utils, components)
- **CRITICAL: Always use static imports - dynamic imports cause build failures**
- Follow the existing store/context pattern for state management
- **UI code belongs in components/screens only - never in hooks**
- **Business logic belongs in hooks/services - never directly in UI components**

### Code Review Focus Areas
- Check for memory leaks (useEffect cleanup, ref management)
- Verify proper error handling and user feedback
- Ensure accessibility considerations (screen readers, etc.)
- Review performance implications of changes
- Validate TypeScript types are properly defined
- Check for proper input validation and sanitization

### Critical Build Requirements (MUST FOLLOW)
- **Static Imports Only**: Never use dynamic imports (`import()` or `await import()`). They cause Metro bundler failures in EAS builds. Always use static imports at the top of files.
- **Separation of Concerns**: 
  - UI components and screens should only contain JSX, styling, and event handlers
  - All business logic, state management, and side effects must be in hooks or services
  - Hooks should never contain JSX or UI-related code
  - Components should be "dumb" - they receive props and render UI

### Theming & Colors (MUST FOLLOW)
- **NO hardcoded colors**: Never use hex values like `#1DA1F2` or `#15202B` directly in components or styles
- **Use the centralized theme**: Import colors from `constants/Colors.ts`
  - In components/screens: `import { useTheme } from '../hooks/useTheme'` then `const theme = useTheme()`
  - In style factories: `import { getTheme } from '../constants/Colors'` then `const theme = getTheme(isDark ? 'dark' : 'light')`
  - For raw palette colors (rare): `import { palette } from '../constants/Colors'`
- **Adding new colors**: If a new color is needed, add it to `constants/Colors.ts` in the `palette` object and update the `Theme` interface if it's a semantic color

### Mobile UI Guidelines
- Design for both iOS and Android platforms
- Consider different screen sizes and orientations
- Use platform-appropriate navigation patterns
- Implement proper touch targets (minimum 44px)
- Follow platform design guidelines (Material Design / Human Interface Guidelines)

### Security Considerations
- Never log sensitive user data
- Validate all user inputs
- Use secure storage for sensitive information (expo-secure-store)
- Follow blockchain security best practices for Hive integration
