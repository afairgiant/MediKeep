# Paperless-ngx Integration

MediKeep can integrate with [Paperless-ngx](https://docs.paperless-ngx.com/) to use it as document storage instead of (or alongside) local file storage.

---

## What is Paperless-ngx?

Paperless-ngx is an open-source document management system that scans, indexes, and archives paper documents. When integrated with MediKeep, your uploaded medical documents can be stored and organized in Paperless-ngx, giving you full-text search, tagging, and archival capabilities for your medical files.

---

## Prerequisites

Before configuring the integration, you need:

1. A running **Paperless-ngx instance** accessible from your MediKeep server
2. A **Paperless-ngx API token** (recommended) or username/password credentials

### Getting an API Token

1. Log in to your Paperless-ngx instance
2. Go to **Settings** (or your user profile)
3. Generate an API token
4. Copy the token for use in MediKeep

---

## Configuration

### Step 1: Open Paperless Settings

1. Log in to MediKeep
2. Go to **Settings** > **Paperless** tab

### Step 2: Enter Connection Details

- **Paperless URL** - The full URL of your Paperless-ngx instance (e.g., `https://paperless.example.com`)
- **API Token** (recommended) - Your Paperless-ngx API token
- **Username / Password** (alternative) - If you prefer basic authentication instead of a token

**Security note:** External URLs must use HTTPS. Local network addresses (localhost, 192.168.x.x, 10.x.x.x, 172.16-31.x.x) can use HTTP for development purposes.

### Step 3: Test the Connection

Click **Test Connection** to verify that MediKeep can communicate with your Paperless-ngx instance. On success, MediKeep displays the server information confirming connectivity.

### Step 4: Configure Storage Preferences

After a successful connection, you can configure how MediKeep uses Paperless-ngx for document storage, including automatic upload preferences.

---

## Using Paperless Storage

Once configured, Paperless-ngx works as a storage backend for your medical documents:

- **Uploading documents** - When you upload a file in MediKeep, it can be sent to Paperless-ngx for storage
- **Browsing documents** - View and access documents stored in Paperless-ngx from within MediKeep
- **Downloading documents** - Retrieve documents from Paperless-ngx through MediKeep's interface

Documents linked to medical records (lab results, encounter notes, etc.) can be stored in either local storage or Paperless-ngx based on your preferences.

---

## Troubleshooting

### Connection Failed

- Verify the Paperless-ngx URL is correct and accessible from the MediKeep server
- Check that the URL uses HTTPS for external connections
- Ensure your Paperless-ngx instance is running

### Authentication Error

- Verify your API token is correct and has not expired
- If using username/password, confirm the credentials are valid
- Check that the user account has sufficient permissions in Paperless-ngx

### Timeout Errors

- MediKeep uses a 5-second connection timeout and 30-second request timeout
- If Paperless-ngx is behind a CDN or reverse proxy, connection times may be longer
- Check network connectivity between the MediKeep server and Paperless-ngx

---

## Need Help?

- [User Guide](User-Guide) - General MediKeep usage
- [FAQ](FAQ) - Common questions
- [Installation Guide](Installation-Guide) - MediKeep setup
