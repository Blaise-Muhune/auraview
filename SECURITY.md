# Security Report & Recommendations

## Vulnerabilities Fixed

### 1. **Admin email hardcoded**
- **Issue:** Admin email was hardcoded in `src/app/api/admin/stats/route.ts`
- **Fix:** Moved to `ADMIN_EMAIL` environment variable
- **Action:** Add `ADMIN_EMAIL=your@email.com` to `.env`

### 2. **Input validation gaps**
- **Issue:** Ratings API accepted unbounded `reason` and `toUserDisplayName` lengths
- **Fix:** Added max length validation (500 chars for reason, 100 for display name)

### 3. **HTML injection in emails**
- **Issue:** Notify API inserted user-provided data into email HTML without escaping
- **Fix:** Added `escapeHtml()` and URL validation for links

### 4. **Missing security headers**
- **Issue:** No X-Frame-Options, X-Content-Type-Options, etc.
- **Fix:** Added security headers in `next.config.ts`

### 5. **Firestore userProfiles over-permissive**
- **Issue:** `userProfiles` had `allow read: if true` (anyone could read)
- **Fix:** Restricted to `request.auth != null`; write requires owner

---

## NPM Dependencies (run manually)

```bash
npm audit fix
```

**Known vulnerabilities:**
- `js-yaml` (moderate) – prototype pollution
- `next` (moderate) – DoS via Image Optimizer
- `tar` (high) – path traversal

After fix, run `npm run build` to verify nothing broke.

---

## Recommendations

### High priority

1. **Add `ADMIN_EMAIL` to `.env`**
   ```
   ADMIN_EMAIL=your-admin@email.com
   ```

2. **Rate limiting on Ratings API**
   - Consider adding per-user rate limits (e.g. Vercel, Upstash, or custom)

3. **Review Firestore rules**
   - `groups` and `ratings` allow public read – acceptable if group codes are meant to be shareable
   - Consider restricting `ratings` read if you want to hide who rated whom

### Medium priority

4. **CSP (Content Security Policy)**
   - Add a Content-Security-Policy header for stronger XSS protection

5. **API route validation**
   - Validate `groupId` and `toUserId` format (e.g. Firebase document ID format)

6. **Secrets**
   - Ensure `.env` and `service-account.json` are never committed
   - Use platform secrets (Vercel, etc.) for production

### Low priority

7. **Logging**
   - Avoid logging tokens or PII in production

8. **CORS**
   - If you add custom API domains, configure CORS explicitly
