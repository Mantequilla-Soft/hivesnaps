/**
 * Video Error Parser Utility
 * 
 * Safely parses video playback errors from react-native-video and other sources.
 * Handles platform-specific error codes and normalizes error information.
 */

export interface ParsedVideoError {
    /** Error message extracted from the error object */
    message: string;
    /** Whether this appears to be a network-related error */
    isNetworkError: boolean;
    /** Platform-specific error code if available */
    code?: string | number;
}

/**
 * Network error indicators to check for in error messages and codes
 */
const NETWORK_ERROR_INDICATORS = [
    'network',
    'unknownhost',
    'no address',
    'connection',
    'timeout',
    'unreachable',
    'dns',
    '22001', // ExoPlayer network error code (Android)
    'NSURLErrorDomain', // iOS network error domain
    '-1009', // iOS no internet connection
    '-1001', // iOS request timeout
] as const;

/**
 * Safely converts an error object to a string for analysis.
 * Handles null, undefined, non-objects, and circular references.
 * 
 * @param err - The error object to stringify
 * @returns A safe string representation of the error
 */
function safeStringify(err: unknown): string {
    if (err === null) return 'null';
    if (err === undefined) return 'undefined';

    // Handle primitive types
    if (typeof err === 'string') return err;
    if (typeof err === 'number') return String(err);
    if (typeof err === 'boolean') return String(err);

    // Handle Error objects with message property
    if (err instanceof Error) {
        return err.message || err.toString();
    }

    // Handle objects with toString method
    if (typeof err === 'object' && err !== null) {
        // Try to use toString first for better readability
        if (typeof (err as any).toString === 'function' && (err as any).toString !== Object.prototype.toString) {
            try {
                return (err as any).toString();
            } catch {
                // Fall through to JSON.stringify
            }
        }

        // Try JSON.stringify with error handling
        try {
            return JSON.stringify(err);
        } catch {
            // Handle circular references or other stringify errors
            return '[Object with circular reference or unstringifiable content]';
        }
    }

    return String(err);
}

/**
 * Extracts error code from various error object structures.
 * 
 * @param err - The error object
 * @returns The error code if found, undefined otherwise
 */
function extractErrorCode(err: unknown): string | number | undefined {
    if (err === null || err === undefined) return undefined;

    if (typeof err === 'object') {
        const errorObj = err as any;

        // Common error code properties
        if (errorObj.code !== undefined) return errorObj.code;
        if (errorObj.errorCode !== undefined) return errorObj.errorCode;
        if (errorObj.status !== undefined) return errorObj.status;
        if (errorObj.statusCode !== undefined) return errorObj.statusCode;

        // React Native Video specific (Android ExoPlayer errors)
        if (errorObj.error?.code !== undefined) return errorObj.error.code;
        if (errorObj.error?.errorCode !== undefined) return errorObj.error.errorCode;
    }

    return undefined;
}

/**
 * Parses a video playback error and returns normalized error information.
 * Safe to use with any error type - handles null, undefined, and non-objects.
 * 
 * @param err - The error from video playback (can be anything)
 * @returns Normalized error information with message and network error detection
 * 
 * @example
 * ```typescript
 * const handleVideoError = (err: unknown) => {
 *   const parsed = parseVideoError(err);
 *   if (parsed.isNetworkError) {
 *     // Show offline message
 *   } else {
 *     console.error('Video error:', parsed.message);
 *   }
 * };
 * ```
 */
export function parseVideoError(err: unknown): ParsedVideoError {
    const message = safeStringify(err);
    const code = extractErrorCode(err);

    // Check for network error indicators in the message (case-insensitive)
    const lowerMessage = message.toLowerCase();
    const codeString = code !== undefined ? String(code).toLowerCase() : '';

    const isNetworkError = NETWORK_ERROR_INDICATORS.some(
        indicator => lowerMessage.includes(indicator.toLowerCase()) || codeString.includes(indicator.toLowerCase())
    );

    return {
        message,
        isNetworkError,
        code,
    };
}
