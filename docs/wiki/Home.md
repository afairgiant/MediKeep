# MediKeep Wiki

Welcome to the MediKeep documentation wiki - your comprehensive resource for using and developing with MediKeep, the open-source medical records management system.

---

## Quick Links

| I want to... | Go here |
|--------------|---------|
| **Use MediKeep** | [User Guide](User-Guide) |
| **Set up MediKeep** | [Installation Guide](Installation-Guide) |
| **Administer MediKeep** | [Admin Guide](Admin-Guide) |
| **Develop/Contribute** | [Developer Guide](Developer-Guide) |
| **Deploy to production** | [Deployment Guide](Deployment-Guide) |
| **Get help** | [FAQ](FAQ) |

---

## About MediKeep

MediKeep is a comprehensive medical records management system designed for individuals and families to organize and track their health information.

### Key Features

- **Patient Profiles** - Manage records for yourself and family members
- **Medical Records** - Track 14 categories: medications, allergies, conditions, vitals, lab results, treatments, immunizations, procedures, injuries, symptoms, encounters, medical equipment, insurance, and emergency contacts
- **Document Storage** - Upload and organize medical documents and images
- **Paperless-ngx Integration** - Use [Paperless-ngx](Paperless-Integration) as a document storage backend
- **Lab Result Parsing** - [Automatically extract results](Lab-Result-Parsing) from PDF lab reports
- **PDF Reports** - Generate comprehensive health summaries
- **Data Sharing** - Securely share patient records and family history with other users
- **SSO Support** - Sign in with Google, GitHub, or Microsoft
- **Notifications** - Get alerts via Discord, Email, Gotify, or Webhooks

### Technology Stack

- **Frontend**: React 18.3 with Mantine UI 8.x
- **Backend**: FastAPI (Python 3.12+)
- **Database**: PostgreSQL 15+
- **Deployment**: Docker

---

## Documentation Sections

### For Users

- [User Guide](User-Guide) - How to use MediKeep
- [Paperless-ngx Integration](Paperless-Integration) - Document storage with Paperless-ngx
- [Lab Result PDF Parsing](Lab-Result-Parsing) - Automatic lab result extraction
- [FAQ](FAQ) - Frequently asked questions

### For Administrators

- [Admin Guide](Admin-Guide) - User management, backups, system health
- [Installation Guide](Installation-Guide) - Set up your own instance
- [Deployment Guide](Deployment-Guide) - Production deployment
- [SSO Setup](SSO-Quick-Start) - Configure single sign-on
- [Backup & Recovery](Deployment-Guide#backup--disaster-recovery) - Data protection

### For Developers

- [Developer Guide](Developer-Guide) - Start contributing
- [Quick Start](Quick-Start-Guide) - Development environment setup
- [Architecture](Architecture) - System design overview
- [API Reference](API-Reference) - Complete API documentation
- [Database Schema](Database-Schema) - Data model reference
- [Contributing](Contributing-Guide) - Code standards and workflow

---

## Getting Help

- **GitHub Issues**: [Report bugs or request features](https://github.com/afairgiant/MediKeep/issues)
- **GitHub Discussions**: [Ask questions and share ideas](https://github.com/afairgiant/MediKeep/discussions)
- **FAQ**: [Common questions answered](FAQ)

---

## Contributing

MediKeep is open source and welcomes contributions! See the [Contributing Guide](Contributing-Guide) to get started.

---

**MediKeep** | [GitHub](https://github.com/afairgiant/MediKeep) | [Docker Hub](https://github.com/afairgiant/MediKeep/pkgs/container/medikeep)
