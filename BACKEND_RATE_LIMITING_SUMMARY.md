# Rate Limiting Implementation Summary

## Changes Made

### 1. Dependencies
- `express-rate-limit` was already installed in `package.json`.

### 2. Middleware Creation
- Created `backend/src/middleware/rateLimit.ts` with two rate limiters:
  - `loginLimiter`: 5 requests per 15 minutes per IP and email combination
    - Uses custom key generator combining IP and email (lowercased, trimmed)
    - Prevents brute-force password attacks and throttles distributed attacks against a single account
    - Returns 429 with error: "Too many login attempts, please try again later."
  - `refreshLimiter`: 20 requests per 15 minutes per IP
    - Standard IP-based limiting for token refresh endpoint
    - More lenient as legitimate clients refresh tokens periodically
    - Returns 429 with error: "Too many token refresh requests, please try again later."

### 3. Route Protection
- Applied `loginLimiter` to `/api/login` route in `backend/src/routes/auth.ts`
- Applied `refreshLimiter` to `/api/refresh` route in `backend/src/routes/auth.ts`

### 4. Proxy Configuration
- Added `app.set('trust proxy', true);` in `backend/src/app.ts`
- Ensures rate limiting uses the real client IP when behind a reverse proxy/load balancer
- Uses headers like X-Forwarded-For to determine client IP

### 5. Response Format
- Both limiters return JSON responses with 429 status code
- Include clear error messages for clients
- Utilize standard RateLimit-* headers (via `standardHeaders: true`)

## Security Considerations

### Login Endpoint Protection
- Stricter limit (5/15min) reflects higher risk of password brute-force attacks
- Keyed by IP+email prevents both single IP brute-force and distributed attacks targeting one account
- Email is normalized (lowercase, trimmed) for consistent key generation

### Refresh Endpoint Protection
- More lenient limit (20/15min) accommodates legitimate token refresh behavior
- Still provides protection against refresh token abuse
- IP-based keying sufficient as refresh tokens are typically tied to specific devices/clients

### Proxy Handling
- Trust proxy configuration ensures correct IP detection in proxied environments
- Critical for accurate rate limiting in production deployments behind load balancers
- Set to `true` for simple proxy setups; can be adjusted to specific trusted IPs if needed

## Implementation Details

### Rate Limiter Configuration
- Window: 15 minutes (900,000 milliseconds)
- Standard headers enabled (RateLimit-* headers) for client awareness
- Legacy headers disabled (X-RateLimit-*) for consistency
- Custom error handlers return JSON responses instead of default text/html

### Key Generation
- Login: `${IP}:${normalized_email}` (empty strings for missing values)
- Refresh: `${IP}` (empty string for missing values)
- Falls back to `req.socket.remoteAddress` if `req.ip` unavailable

## Verification Steps

To verify the implementation works correctly:

1. **Login Endpoint**:
   - Make 6 login requests within 15 minutes with same IP and email
   - 6th request should return 429 with appropriate error message
   - Requests with different emails or IPs should have separate counters

2. **Refresh Endpoint**:
   - Make 21 refresh requests within 15 minutes from same IP
   - 21st request should return 429 with appropriate error message

3. **Proxy Testing** (if applicable):
   - Verify that when behind a proxy, the limiter uses the client IP from X-Forwarded-For
   - Confirm that direct connections still work correctly

4. **Normal Operation**:
   - Ensure requests within limits succeed normally
   - Verify that existing authentication functionality remains intact

## Future Tuning

The limits (5/15min for login, 20/15min for refresh) can be adjusted based on:
- Observed attack patterns
- Legitimate usage metrics
- Security requirements
- Performance considerations

To adjust limits, modify the `windowMs` and `max` values in `backend/src/middleware/rateLimit.ts`.

## Files Modified

- `backend/src/middleware/rateLimit.ts` (new file)
- `backend/src/routes/auth.ts` (imports and middleware application)
- `backend/src/app.ts` (trust proxy configuration)

No changes were made to `package.json` as the dependency was already present.