# Notification Setup Guide

MediKeep can send you notifications through various channels when important events occur, like completed backups, new sharing invitations, or security alerts.

## Accessing Notification Settings

1. Click on **Settings** in the sidebar navigation
2. Select the **Notifications** tab

## Supported Channels

MediKeep supports four notification channel types:

### Discord

Send notifications to a Discord server channel via webhooks.

**Setup:**

1. In Discord, go to **Server Settings > Integrations > Webhooks**
2. Click **New Webhook** and select a channel
3. Copy the Webhook URL
4. In MediKeep Settings > Notifications, click **Add Channel**
5. Select **Discord** as the channel type
6. Paste the webhook URL and give the channel a name
7. Click **Save**

**Optional Settings:**
- **Bot Username**: Custom name for the notification bot (default: MediKeep)
- **Avatar URL**: Custom avatar image for the bot

### Email (SMTP)

Send notifications to an email address via SMTP.

**Setup:**

1. You'll need SMTP credentials from your email provider
2. In MediKeep, click **Add Channel** and select **Email**
3. Enter your SMTP settings:
   - **SMTP Server**: Your email provider's server
   - **SMTP Port**: Usually 587 (TLS) or 465 (SSL)
   - **SMTP Username**: Your email address
   - **SMTP Password**: Your email password or app password
   - **From Email**: The sender address
   - **To Email**: Where to send notifications

**Common SMTP Settings:**

| Provider | Server | Port | Notes |
|----------|--------|------|-------|
| Gmail | smtp.gmail.com | 587 | Use [App Password](https://support.google.com/accounts/answer/185833) |
| Outlook/Hotmail | smtp.office365.com | 587 | May need 2FA app password |
| Yahoo | smtp.mail.yahoo.com | 587 | Use [App Password](https://help.yahoo.com/kb/generate-third-party-passwords-sln15241.html) |

**Important:** For Gmail and other providers with 2-factor authentication, you'll need to generate an App Password instead of using your regular password.

### Gotify

Self-hosted push notifications via a Gotify server.

**Prerequisites:**
- A running [Gotify](https://gotify.net/) server

**Setup:**

1. In your Gotify web interface, create an **Application**
2. Copy the application token
3. In MediKeep, click **Add Channel** and select **Gotify**
4. Enter:
   - **Server URL**: Your Gotify server URL (e.g., `https://gotify.example.com`)
   - **App Token**: The application token from Gotify
   - **Priority** (optional): Message priority 1-10 (default: 5)

### Webhook

Send JSON payloads to any URL for custom integrations.

**Setup:**

1. Click **Add Channel** and select **Webhook**
2. Enter:
   - **Webhook URL**: Your endpoint URL
   - **HTTP Method**: POST (recommended) or GET
   - **Headers** (optional): Custom headers as JSON
   - **Auth Token** (optional): Bearer token or API key

**Payload Format:**

MediKeep sends notifications in this JSON format:

```json
{
  "title": "Notification Title",
  "message": "Notification message content",
  "event_type": "backup_completed",
  "timestamp": "2026-01-27T15:30:00Z",
  "data": {
    "additional": "event-specific data"
  }
}
```

## Configuring Event Notifications

After adding channels, you can configure which events trigger notifications:

1. Go to **Settings > Notifications**
2. In the **Event Notifications** section, you'll see a matrix of events and channels
3. Toggle the checkbox for each event-channel combination you want to enable

### Available Events

| Event | Description | Category |
|-------|-------------|----------|
| Backup Completed | When a backup completes successfully | System |
| Backup Failed | When a backup fails | System |
| Lab Results Available | When new lab results are added | Medical |
| Abnormal Lab Results | When lab results are outside normal range | Medical |
| Immunization Due | When an immunization is coming due | Medical |
| Immunization Overdue | When an immunization is past due | Medical |
| Invitation Received | When someone shares records with you | Sharing |
| Invitation Accepted | When your sharing invitation is accepted | Sharing |
| Share Revoked | When access to shared records is revoked | Sharing |
| New Device Login | When your account is accessed from a new device | Security |
| Password Changed | When your password is changed | Security |

## Testing Channels

Before relying on notifications:

1. Click the **Test** button next to any channel
2. Check that you receive the test notification
3. A successful test will mark the channel as "Verified"

If the test fails:
- Check your channel configuration settings
- Verify your credentials are correct
- Ensure the target service (Discord server, email, Gotify server) is accessible

## Notification History

View recent notifications in the **Notification History** section:

- Click the header to expand/collapse the history
- See delivery status for each notification (Sent, Failed, Pending)
- View error messages for failed notifications
- Use pagination to browse older notifications

## Troubleshooting

### Discord notifications not arriving

- Verify the webhook URL is correct and hasn't been regenerated
- Check that the Discord channel still exists
- Ensure the webhook wasn't deleted from Discord

### Email notifications not arriving

- Check your spam/junk folder
- Verify SMTP credentials are correct
- For Gmail: Make sure you're using an App Password, not your regular password
- Try using port 587 with TLS enabled

### Gotify notifications not arriving

- Verify the server URL is accessible
- Check that the app token is correct
- Ensure your Gotify server is running

### Webhook notifications failing

- Verify the endpoint URL is correct and accessible
- Check that your server is accepting the expected HTTP method
- Review any authentication requirements

## Tips

1. **Test channels after creating them** to verify they work before relying on them
2. **Start with important events only** to avoid notification fatigue
3. **Use multiple channels** for critical events like backup failures
4. **Review notification history** periodically to ensure deliveries are succeeding
5. **Keep credentials secure** - notification settings are encrypted but consider using app-specific passwords where available
