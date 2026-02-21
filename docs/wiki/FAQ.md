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

# Copy and edit environment file (change passwords and SECRET_KEY)
cp docker/.env.example .env

# Start the application
cd docker
docker compose up -d
```

See the [Installation Guide](Installation-Guide) for detailed instructions.

### How do I update MediKeep?

```bash
cd docker
docker compose pull
docker compose up -d
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

Yes. MediKeep supports 6 languages: English, French, German, Spanish, Italian, and Portuguese.

---

## Sharing & Access

### How do I share records with someone?

The recipient must already have an account on your MediKeep instance. To share:

1. Go to the patient's page → **Sharing**
2. Enter the recipient's username or email to look them up
3. Choose a permission level and send the invitation
4. The recipient will see the invitation in their account and can accept or decline

### What permission levels are available?

- **View** - Can see records but not modify
- **Edit** - Can view and modify records
- **Full** - Full access to the patient's records

### How do I revoke someone's access?

Go to the patient's sharing settings and remove their access.

---

## Troubleshooting

### I forgot my password

There is no self-service password reset. An administrator can reset your password through the admin panel.

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

CORS is configured to allow all origins. If you're seeing CORS errors in development, make sure the backend is actually running on port 8000.

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
