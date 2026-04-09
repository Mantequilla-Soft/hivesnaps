/**
 * Authenticated API Request Utility
 * Handles JWT token inclusion and automatic refresh on 401 errors
 */

import { accountStorageService } from './AccountStorageService';
import { makeRequest, NetworkTarget } from './networking';
import { authService } from './AuthService';

interface AuthenticatedRequestOptions extends Omit<NetworkTarget, 'headers'> {
  headers?: Record<string, string>;
  requireAuth?: boolean; // If true, request fails if no token available
}

interface AuthenticatedResponse {
  body: any;
  status: number;
  headers?: Record<string, string>;
}

/**
 * Make an authenticated API request with automatic JWT token refresh
 */
export async function makeAuthenticatedRequest(
  options: AuthenticatedRequestOptions
): Promise<AuthenticatedResponse> {
  const { headers = {}, requireAuth = true, ...networkOptions } = options;
  
  // Get current JWT token
  let token = authService.getToken();
  
  // If no token and auth is required, fail early
  if (!token && requireAuth) {
    throw new Error('Authentication required but no token available');
  }
  
  // Prepare headers with JWT token
  const authHeaders = token 
    ? { ...headers, 'Authorization': `Bearer ${token}` }
    : headers;
  
  const requestOptions: NetworkTarget = {
    ...networkOptions,
    headers: authHeaders,
  };
  
  try {
    // Attempt the API request
    const response = await makeRequest(requestOptions);
    return response;
  } catch (error: any) {
    // Parse the error to extract status and body information
    let status: number | undefined;
    let errorBody: any;
    
    if (error.message && typeof error.message === 'string') {
      // Parse errors like "HTTP 401: {"error":"expired"}"
      const httpMatch = error.message.match(/HTTP (\d+): (.+)/);
      if (httpMatch) {
        status = parseInt(httpMatch[1], 10);
        try {
          errorBody = JSON.parse(httpMatch[2]);
        } catch {
          errorBody = { message: httpMatch[2] };
        }
      }
    }
    
    console.log('[AuthenticatedRequest] Parsed error - Status:', status, 'Body:', errorBody);
    
    // Check if it's a 401 Unauthorized error with "expired" message
    if (status === 401 && token) {
      console.log('[AuthenticatedRequest] 401 error, checking if token expired...', errorBody);
      
      // Check if this is specifically an "expired" token error
      // Handle both possible response formats: {error: "expired"} or {message: "expired"}
      const isExpiredToken = (errorBody?.error && 
        errorBody.error.toLowerCase().includes('expired')) ||
        (errorBody?.message && 
        errorBody.message.toLowerCase().includes('expired'));
      
      if (isExpiredToken) {
        console.log('[AuthenticatedRequest] Token expired, attempting refresh...');
        
        try {
          // Try to refresh the token using refresh token
          const newToken = await authService.refreshTokenWithRefreshToken();
          
          // Retry the original request with the new token
          const retryHeaders = { ...headers, 'Authorization': `Bearer ${newToken}` };
          const retryOptions: NetworkTarget = {
            ...networkOptions,
            headers: retryHeaders,
          };
          
          console.log('[AuthenticatedRequest] Token refreshed, retrying request...');
          const retryResponse = await makeRequest(retryOptions);
          return retryResponse;
          
        } catch (refreshError) {
          console.error('[AuthenticatedRequest] Token refresh failed:', refreshError);
          
          // Refresh failed - logout user and clear stored credentials
          console.log('[AuthenticatedRequest] Logging out user due to refresh failure');
          authService.logout();
          
          // Clear stored current account
          try {
            await accountStorageService.clearCurrentAccountUsername();
            console.log('[AuthenticatedRequest] Cleared stored credentials');
          } catch (clearError) {
            console.error('[AuthenticatedRequest] Failed to clear credentials:', clearError);
          }
          
          // Throw authentication error to force re-login
          throw new Error('Authentication expired. Please log in again.');
        }
      } else {
        console.log('[AuthenticatedRequest] 401 error but not expired token, passing through:', errorBody);
      }
    } else {
      console.log('[AuthenticatedRequest] Non-401 error or no token available:', status, errorBody);
    }
    
    // For non-401 errors or if refresh is not possible, throw the original error
    throw error;
  }
}

/**
 * Check if a request needs authentication based on its path
 */
export function isAuthenticatedEndpoint(path: string): boolean {
  const authenticatedPaths = [
    '/report',           // Report submission
    '/blacklisted',        // Blacklist access
    '/auth/challenge',   // Challenge request (actually doesn't need auth)
    '/auth/verify',      // Signature verification (actually doesn't need auth)
  ];
  
  // Challenge and verify endpoints don't actually need authentication
  if (path === '/auth/challenge' || path === '/auth/verify') {
    return false;
  }
  
  return authenticatedPaths.some(authPath => path.startsWith(authPath));
}

/**
 * Utility to add authentication to existing API calls
 * Wrapper around makeAuthenticatedRequest for common use cases
 */
export async function authenticatedApiCall(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any,
  additionalHeaders?: Record<string, string>
): Promise<AuthenticatedResponse> {
  const requireAuth = isAuthenticatedEndpoint(path);
  
  const options: AuthenticatedRequestOptions = {
    path,
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...additionalHeaders,
    },
    body,
    timeoutMs: 12000,
    requireAuth,
  };
  
  return makeAuthenticatedRequest(options);
}
