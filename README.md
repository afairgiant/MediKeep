# Medical Records Management System - V2

A comprehensive FastAPI-based medical records management system for individual users.

## 🏥 Features

### ✅ Completed - Patient Management
- **User Authentication** - JWT-based login/register system
- **Patient Records** - Complete CRUD operations for patient information
- **Data Validation** - Comprehensive validation for all patient fields
- **Secure Access** - Each user manages their own patient record only
- **RESTful API** - Clean API endpoints with proper HTTP methods

### 📋 Patient Record Fields
- **Personal Info**: First name, last name, birth date, gender
- **Contact**: Address information
- **Validation**: Age limits, gender normalization, address requirements
- **Security**: User-specific access, no cross-user data access

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- pip

### Installation

1. **Clone and navigate to project**
```bash
cd "Medical Records-V2"
```

2. **Install dependencies**
```bash
pip install -r requirements.txt
```

3. **Start the server**
```bash
python run.py
```

4. **Test the system**
```bash
python test_patients.py
```

### Access Points
- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health
- **Base API**: http://localhost:8000/api/v1

## 📚 API Usage

### Authentication

#### Register a new user
```bash
POST /api/v1/auth/register
{
  "username": "john_doe",
  "email": "john@example.com", 
  "password": "secure123",
  "full_name": "John Doe",
  "role": "user"
}
```

#### Login
```bash
POST /api/v1/auth/login
Content-Type: application/x-www-form-urlencoded

username=john_doe&password=secure123
```

Returns JWT token for authenticated requests.

### Patient Management

All patient endpoints require Authorization header: `Bearer <token>`

#### Create patient record
```bash
POST /api/v1/patients/me
{
  "first_name": "John",
  "last_name": "Doe",
  "birthDate": "1990-01-15", 
  "gender": "M",
  "address": "123 Main St, City, ST 12345"
}
```

#### Get patient record
```bash
GET /api/v1/patients/me
```

#### Update patient record
```bash
PUT /api/v1/patients/me
{
  "address": "456 New St, City, ST 54321"
}
```

#### Delete patient record
```bash
DELETE /api/v1/patients/me
```

## 🏗️ Architecture

### Database Models
- **User**: Authentication and account management
- **Patient**: Medical record holder (1:1 with User)
- **Practitioner**: Healthcare providers (shared resource)
- **Medication**: Patient medications with prescriber tracking

### API Structure
```
/api/v1/
├── auth/          # Authentication endpoints
├── users/         # User management  
├── patients/      # Patient record management
└── (planned)      # medications, encounters, etc.
```

### Security Features
- **Password Hashing**: bcrypt for secure password storage
- **JWT Tokens**: Stateless authentication with expiration
- **User Isolation**: Each user only accesses their own data
- **Input Validation**: Comprehensive Pydantic schemas

## 🗂️ Project Structure

```
app/
├── main.py              # FastAPI application
├── api/
│   ├── deps.py          # Authentication dependencies
│   └── v1/
│       ├── api.py       # Main API router
│       └── endpoints/   # Individual route handlers
├── core/
│   ├── config.py        # App configuration
│   ├── database.py      # Database setup
│   └── security.py      # JWT & password handling
├── crud/                # Database operations
├── models/              # SQLAlchemy models
└── schemas/             # Pydantic validation schemas
```

## 🧪 Testing

### Automated Testing
```bash
python test_patients.py
```

### Manual Testing
1. Visit http://localhost:8000/docs
2. Use the interactive API documentation
3. Register a user, login, and test patient operations

## 🔧 Configuration

Environment variables (optional):
- `DATABASE_URL`: Database connection string (default: SQLite)
- `SECRET_KEY`: JWT signing key (set in production!)
- `DEBUG`: Enable debug mode (default: False)

## 📈 Development Status

### ✅ Completed
- Core architecture (models, schemas, CRUD)
- User authentication system
- Patient management (complete CRUD)
- API documentation
- Basic testing framework

### 🚧 Next Phase (Planned)
- Medical record entities (encounters, conditions, procedures)
- Medication management API
- Lab results tracking
- Immunization records
- Treatment history
- Advanced search and filtering

## 🛡️ Security Notes

- Always use HTTPS in production
- Set a strong SECRET_KEY environment variable
- Regularly update dependencies
- Consider rate limiting for production use
- Database backups are essential for medical data

## 📝 Contributing

1. Focus on individual user experience (not family/multi-user)
2. Maintain comprehensive input validation
3. Follow FastAPI best practices
4. Add tests for new features
5. Update documentation

---

**Current Focus**: Patient section is complete and fully functional. Ready for testing and use!