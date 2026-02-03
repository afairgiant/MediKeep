# Frequently Asked Questions

Common questions about MediKeep.

---

## General

### What is MediKeep?

MediKeep is an open-source medical records management system that helps individuals and families organize their health information in one secure place.

### Is MediKeep free?

Yes, MediKeep is free and open source. You can self-host it on your own server or use Docker to run it locally.

### Is my data secure?

MediKeep stores all data in your own PostgreSQL database. Your data never leaves your server. The application uses:
- JWT authentication
- Password hashing (bcrypt)
- HTTPS encryption (when configured)
- Role-based access control

### Can I use MediKeep for my family?

Yes! MediKeep supports multiple patient profiles, so you can manage records for yourself, your spouse, children, parents, or anyone else you care for.

---

## Setup & Installation

### What do I need to run MediKeep?

**Minimum requirements:**
- Docker and Docker Compose (recommended), OR
- Python 3.12+ and Node.js 18+
- PostgreSQL 15+
- 2GB RAM, 2 CPU cores, 20GB disk space

### How do I install MediKeep?

The easiest way is with Docker:

```bash
# Clone the repository
git clone https://github.com/afairgiant/MediKeep.git
cd MediKeep

# Copy environment file
cp docker/.env.example .env

# Start the application
docker compose up -d
```

See the [Installation Guide](Installation-Guide) for detailed instructions.

### How do I update MediKeep?

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker compose down
docker compose up -d --build
```

---

## Features

### Can I import data from other systems?

Currently, MediKeep doesn't have automated import from other medical record systems. You can manually enter your data or upload documents.

### Does MediKeep integrate with my doctor's office?

MediKeep is designed for personal record keeping. It doesn't integrate directly with healthcare provider systems (EHRs). You can manually add information from your provider visits.

### Can I export my data?

Yes! You can:
- Generate PDF reports for any patient
- Export data via the API
- Access the PostgreSQL database directly for backups

### Does MediKeep support multiple languages?

The application is currently in English. The internationalization framework is in place for future language support.

---

## Sharing & Access

### How do I share records with someone?

1. Go to **Settings** → **Sharing**
2. Send an invitation to their email
3. They'll receive a link to create an account and accept the invitation

### Can I give someone view-only access?

Yes, when sharing you can choose between:
- **View** - Can see records but not modify
- **Edit** - Can view and modify records

### How do I revoke someone's access?

Go to **Settings** → **Sharing** → Find the person → Click **Revoke Access**

---

## Troubleshooting

### I forgot my password

Click "Forgot Password" on the login page to reset it via email (requires email to be configured).

### The application is slow

Try:
1. Check your server resources (CPU, RAM)
2. Ensure PostgreSQL has adequate memory
3. Check for large numbers of records that may need pagination

### I can't upload files

Check:
1. File size limit (default 15MB)
2. Allowed file types (images, PDFs)
3. Storage permissions on the server

### I'm getting CORS errors

Make sure your frontend URL matches the `CORS_ORIGINS` setting in your environment configuration.

---

## Development

### How can I contribute?

See the [Contributing Guide](Contributing-Guide) for code standards and workflow.

### Where do I report bugs?

Open an issue on [GitHub Issues](https://github.com/afairgiant/MediKeep/issues).

### Is there an API?

Yes! MediKeep has a comprehensive REST API. See the [API Reference](API-Reference) for documentation.

---

## Still have questions?

- [GitHub Discussions](https://github.com/afairgiant/MediKeep/discussions) - Ask the community
- [GitHub Issues](https://github.com/afairgiant/MediKeep/issues) - Report problems
