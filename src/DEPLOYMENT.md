# Deployment Guide

Complete guide for deploying the Float Plan Safety Manager to production.

## 📋 Pre-Deployment Checklist

Before deploying, ensure you have:
- [ ] A Supabase account and project created
- [ ] Project ID and API keys from Supabase
- [ ] A hosting service account (Vercel, Netlify, or similar)
- [ ] Tested the application locally
- [ ] All environment variables documented

## 🔧 Configuration Steps

### 1. Supabase Setup

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Click "New Project"
   - Choose organization and region
   - Set database password (save securely)
   - Wait for project initialization

2. **Get API Credentials**
   - Navigate to Project Settings > API
   - Copy the following:
     - Project URL (e.g., `https://xxxxx.supabase.co`)
     - `anon/public` key
     - `service_role` key (keep secret!)
   - Project ID from URL

3. **Update Application Config**
   ```typescript
   // /utils/supabase/info.tsx
   export const projectId = 'your-project-id'
   export const publicAnonKey = 'your-anon-key'
   ```

4. **Environment Variables** (for server)
   - In Supabase Dashboard > Edge Functions
   - Add these secrets:
     ```
     SUPABASE_URL=https://xxxxx.supabase.co
     SUPABASE_ANON_KEY=your-anon-key
     SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
     SUPABASE_DB_URL=your-db-connection-string
     ```

### 2. Build Application

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Build for Production**
   ```bash
   npm run build
   ```

3. **Test Production Build Locally**
   ```bash
   npm run preview
   ```

### 3. Deploy Frontend

#### Option A: Vercel

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   vercel --prod
   ```

3. **Configure**
   - Set environment variables in Vercel dashboard
   - Configure custom domain (optional)

#### Option B: Netlify

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Deploy**
   ```bash
   netlify deploy --prod --dir=dist
   ```

3. **Configure**
   - Set environment variables in Netlify dashboard
   - Configure custom domain (optional)

#### Option C: Supabase Hosting

1. **Link Project**
   ```bash
   supabase link --project-ref your-project-id
   ```

2. **Deploy**
   ```bash
   supabase deploy
   ```

### 4. Deploy Backend (Edge Functions)

1. **Install Supabase CLI**
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**
   ```bash
   supabase login
   ```

3. **Link Project**
   ```bash
   supabase link --project-ref your-project-id
   ```

4. **Deploy Functions**
   ```bash
   supabase functions deploy server
   ```

5. **Verify Deployment**
   - Check Supabase Dashboard > Edge Functions
   - Ensure function is deployed and active
   - Test with curl:
     ```bash
     curl https://your-project.supabase.co/functions/v1/make-server-4ab53527/boats \
       -H "Authorization: Bearer your-anon-key"
     ```

## 🔐 Security Configuration

### 1. CORS Setup

Edit `/supabase/functions/server/index.tsx` to restrict origins:

```typescript
app.use('*', cors({
  origin: [
    'https://your-domain.com',
    'http://localhost:5173' // Remove in production
  ]
}))
```

### 2. Rate Limiting (Optional)

Add rate limiting to prevent abuse:

```typescript
import { rateLimiter } from 'npm:hono-rate-limiter'

app.use('*', rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}))
```

### 3. Authentication Setup

1. **Configure Email Templates** (optional)
   - Supabase Dashboard > Authentication > Email Templates
   - Customize confirmation and reset password emails

2. **Set Up Email Provider** (optional)
   - Supabase Dashboard > Project Settings > Auth
   - Configure SMTP settings for transactional emails

3. **Social Login** (if needed)
   - Supabase Dashboard > Authentication > Providers
   - Enable Google, GitHub, etc.
   - Follow setup instructions for each provider

## 🧪 Testing Production Deployment

### 1. Smoke Tests

Test these critical flows:

1. **Authentication**
   - [ ] Sign up new account
   - [ ] Sign in existing account
   - [ ] Sign out

2. **Boats**
   - [ ] Add new boat
   - [ ] Edit boat
   - [ ] Delete boat

3. **Float Plans**
   - [ ] Create float plan (with boat selection)
   - [ ] Create float plan (manual entry)
   - [ ] Edit float plan
   - [ ] Check in on float plan
   - [ ] View float plan details

4. **Other Features**
   - [ ] Add emergency contact
   - [ ] Add inventory item
   - [ ] Create seasonal task

### 2. Performance Testing

```bash
# Test API response times
curl -w "@curl-format.txt" -o /dev/null -s \
  https://your-project.supabase.co/functions/v1/make-server-4ab53527/boats
```

Create `curl-format.txt`:
```
time_total: %{time_total}s
```

### 3. Error Monitoring

Set up error tracking:
- Sentry (recommended)
- LogRocket
- Supabase Logs (built-in)

## 📊 Monitoring

### 1. Supabase Dashboard

Monitor in real-time:
- Database activity
- Edge Function invocations
- Authentication events
- Storage usage

### 2. Application Metrics

Track:
- User sign-ups
- Float plans created
- Check-ins performed
- Error rates

### 3. Alerts

Set up alerts for:
- High error rates
- Failed edge function deployments
- Database connection issues
- High API usage

## 🔄 Updates and Maintenance

### Regular Updates

1. **Update Dependencies**
   ```bash
   npm update
   npm audit fix
   ```

2. **Rebuild and Redeploy**
   ```bash
   npm run build
   vercel --prod  # or your deployment method
   ```

3. **Update Edge Functions**
   ```bash
   supabase functions deploy server
   ```

### Database Maintenance

The KV store is self-managed, but monitor:
- Storage usage
- Query performance
- Data integrity

### Backup Strategy

1. **Export User Data**
   - Use Supabase dashboard to export data
   - Schedule regular backups

2. **Version Control**
   - Keep all code in Git
   - Tag releases
   - Document changes

## 🐛 Troubleshooting

### Common Issues

#### Edge Function Not Responding
```bash
# Check function logs
supabase functions logs server

# Redeploy
supabase functions deploy server --no-verify-jwt
```

#### CORS Errors
- Verify CORS configuration in `/supabase/functions/server/index.tsx`
- Check browser console for exact error
- Ensure frontend URL is allowed

#### Authentication Failing
- Verify API keys are correct
- Check Supabase Auth settings
- Ensure email confirmation is disabled (or SMTP is configured)

#### Data Not Persisting
- Check edge function logs for errors
- Verify authentication token is being sent
- Test KV store directly in Supabase

### Debug Mode

Enable detailed logging:

```typescript
// Add to edge functions
console.log('Debug:', { userId, requestData, response })
```

View logs:
```bash
supabase functions logs server --tail
```

## 📱 Mobile Considerations

### PWA Setup (Optional)

1. **Add manifest.json**
   ```json
   {
     "name": "Float Plan Manager",
     "short_name": "Float Plan",
     "start_url": "/",
     "display": "standalone",
     "background_color": "#0a192f",
     "theme_color": "#0ea5e9",
     "icons": [
       {
         "src": "/icon-192.png",
         "sizes": "192x192",
         "type": "image/png"
       }
     ]
   }
   ```

2. **Add Service Worker**
   - Cache static assets
   - Offline fallback page
   - Background sync for check-ins

### Responsive Testing

Test on:
- iOS Safari (iPhone)
- Android Chrome
- Tablet devices
- Desktop browsers

## 🎉 Launch Checklist

Before going live:
- [ ] All tests passing
- [ ] Error monitoring active
- [ ] Backups configured
- [ ] Analytics setup (optional)
- [ ] Documentation updated
- [ ] Support email configured
- [ ] Domain configured (if custom)
- [ ] SSL certificate valid
- [ ] Performance optimized
- [ ] Accessibility tested
- [ ] Security review completed

## 📞 Support

For deployment issues:
1. Check Supabase status page
2. Review edge function logs
3. Check browser console
4. Test API endpoints directly
5. Contact Supabase support

## 🚀 Post-Launch

After deployment:
1. Monitor error rates first 24 hours
2. Collect user feedback
3. Fix critical bugs immediately
4. Plan feature iterations
5. Update documentation

---

**Good luck with your deployment! ⚓🌊**
