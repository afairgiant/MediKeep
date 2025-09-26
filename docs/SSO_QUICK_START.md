# SSO Quick Start Guide

## 🚀 5-Minute Setup for Google/GitHub

MediKeep has **built-in support** for Google and GitHub OAuth - no complex configuration needed!

## Google Setup (Recommended)

### Step 1: Get Google OAuth Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select a project
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client IDs**
5. Set **Application type** to "Web application"
6. Add **Authorized redirect URI**: `http://localhost:8000/auth/sso/callback`
7. Copy the **Client ID** and **Client Secret**

### Step 2: Configure Environment
Add to your `.env` file:
```bash
SSO_ENABLED=true
SSO_PROVIDER_TYPE=google
SSO_CLIENT_ID=your-google-client-id-here
SSO_CLIENT_SECRET=your-google-client-secret-here
SSO_REDIRECT_URI=http://localhost:8000/auth/sso/callback
# DO NOT set SSO_ISSUER_URL for Google - it's built-in!
```

**For Docker users:** Use the same port as your `docker-compose.yml` configuration:
```bash
SSO_REDIRECT_URI=http://localhost:8005/auth/sso/callback  # if using port 8005
```

### Step 3: Restart & Test
1. Restart your application
2. Go to login page - you'll see "Continue with Google"
3. Go to Admin Settings to test the connection

**That's it!** 🎉

---

## GitHub Setup (Alternative)

### Step 1: Get GitHub OAuth Credentials  
1. Go to GitHub → **Settings** → **Developer settings** → **OAuth Apps**
2. Click **New OAuth App**
3. Fill in:
   - **Application name**: MediKeep
   - **Homepage URL**: `http://localhost:8000`
   - **Authorization callback URL**: `http://localhost:8000/auth/sso/callback`
4. Copy the **Client ID** and **Client Secret**

### Step 2: Configure Environment
Add to your `.env` file:
```bash
SSO_ENABLED=true
SSO_PROVIDER_TYPE=github
SSO_CLIENT_ID=your-github-client-id-here
SSO_CLIENT_SECRET=your-github-client-secret-here
SSO_REDIRECT_URI=http://localhost:8000/auth/sso/callback
```

### Step 3: Restart & Test
Same as Google - restart and test!

**GitHub Note:** If users have private email settings in GitHub, they'll see a manual linking modal to connect with existing accounts using their local credentials.

---

## What You DON'T Need to Configure

❌ Authorization endpoints (built-in)  
❌ Token endpoints (built-in)  
❌ API URLs (built-in)  
❌ OAuth scopes (pre-configured)  
❌ Response parsing (handled automatically)

## What Happens Next

✅ **New Users**: Automatically get accounts (if registration enabled)  
✅ **Existing Users (email matches)**: Shows linking modal with choice to link or create separate account  
✅ **GitHub Users (private email)**: Shows manual linking modal to connect with existing account  
✅ **Security**: CSRF protection, secure token handling  
✅ **Flexibility**: Users can still use local passwords after linking  

## Production Setup

For production, just update the redirect URI:
```bash
SSO_REDIRECT_URI=https://yourdomain.com/auth/sso/callback
```

And add the same URL to your Google/GitHub app settings.

## Need Help?

- Check the **Admin Settings** page for SSO status
- Use **"Test SSO Connection"** to verify setup
- See [SSO_SETUP_GUIDE.md](SSO_SETUP_GUIDE.md) for detailed instructions
- Check logs if something isn't working

## Advanced Options

### Restrict to Family Domains (Optional)
```bash
# Allow any Google account (most common)
SSO_ALLOWED_DOMAINS=[]

# OR restrict to specific domains  
SSO_ALLOWED_DOMAINS=["gmail.com", "smithfamily.org"]
```

### Disable New User Creation
This is controlled in the **Admin Settings** page, not environment variables:

1. Login as admin
2. Go to **Admin Settings** → **User Management** 
3. Toggle **"Allow New User Registration"** to **OFF**

This will block new SSO users but allow existing users to link accounts.

---

**The app handles all the OAuth complexity - you just provide the credentials!** 🎯