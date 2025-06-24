# Emergency Admin User Creation

This directory contains scripts to create emergency admin users in case all admin access is lost.

## 🚨 When to Use This

Use these scripts **ONLY** when:

- All admin users have been accidentally deleted
- You're locked out of the admin interface
- The system has no admin users (fresh installation)

## 📋 Available Scripts

### 1. Python Script (Cross-platform)

```bash
python app/scripts/create_emergency_admin.py
```

### 2. Shell Script (Linux/Mac/Docker)

```bash
./app/scripts/emergency_admin.sh
```

### 3. Windows PowerShell

```powershell
python app/scripts/create_emergency_admin.py
```

## 🐳 Docker Usage

### If your app is running in Docker:

```bash
# Basic usage (creates admin/admin123)
docker exec medical-records-app python app/scripts/create_emergency_admin.py

# With custom credentials
docker exec medical-records-app python app/scripts/create_emergency_admin.py --username emergency_admin --password your_secure_password

# Force creation even if admin users exist
docker exec medical-records-app python app/scripts/create_emergency_admin.py --force
```

### Using the shell wrapper in Docker:

```bash
docker exec medical-records-app ./app/scripts/emergency_admin.sh
docker exec medical-records-app ./app/scripts/emergency_admin.sh --username custom_admin
```

## 🖥️ Local Development Usage

### From project root directory:

```bash
# Default admin user (admin/admin123)
python app/scripts/create_emergency_admin.py

# Custom credentials
python app/scripts/create_emergency_admin.py --username my_admin --password secure_password123

# Force creation
python app/scripts/create_emergency_admin.py --force
```

## 📖 Command Line Options

| Option       | Description                       | Default    |
| ------------ | --------------------------------- | ---------- |
| `--username` | Username for the emergency admin  | `admin`    |
| `--password` | Password for the emergency admin  | `admin123` |
| `--force`    | Create admin even if others exist | `false`    |

## 🛡️ Security Notes

1. **Change Default Password**: Always change the password immediately after logging in
2. **Delete Emergency User**: Create a proper admin user and delete the emergency one
3. **Limited Use**: Only use in genuine emergencies
4. **Monitor Access**: Check activity logs after using emergency access

## 📝 Example Scenarios

### Scenario 1: Complete Admin Lockout

```bash
# Check current status first
docker exec medical-records-app python app/scripts/create_emergency_admin.py

# If no admin users exist, script will create one automatically
# Login with admin/admin123 and immediately:
# 1. Change the password
# 2. Create a proper admin user
# 3. Delete the emergency admin user
```

### Scenario 2: Custom Emergency User

```bash
# Create with strong credentials
docker exec medical-records-app python app/scripts/create_emergency_admin.py \
  --username recovery_admin \
  --password "MyStr0ng!P@ssw0rd"
```

### Scenario 3: Force Creation (Advanced)

```bash
# Only use if you need another admin despite existing ones
docker exec medical-records-app python app/scripts/create_emergency_admin.py \
  --force \
  --username backup_admin
```

## 🔍 What the Script Does

1. **Checks database connection** - Ensures the database is accessible
2. **Counts admin users** - Reports current admin user count
3. **Validates username** - Checks if the username already exists
4. **Creates admin user** - Creates the user with admin privileges
5. **Creates patient record** - Automatically creates associated patient data
6. **Provides feedback** - Shows clear success/failure messages

## ⚠️ Important Warnings

- **NOT for regular use** - This is for emergencies only
- **Security risk** - Default passwords are insecure
- **Change immediately** - Update credentials after first login
- **Audit trail** - All actions are logged in the activity system

## 🔧 Troubleshooting

### Database Connection Issues

```bash
# Check if container is running
docker ps | grep medical-records

# Check logs
docker logs medical-records-app

# Verify database is accessible
docker exec medical-records-app python -c "from app.core.database import check_database_connection; print(check_database_connection())"
```

### Import Errors

```bash
# Make sure you're in the right directory
docker exec medical-records-app pwd

# Check if app modules can be imported
docker exec medical-records-app python -c "from app.core.config import settings; print('OK')"
```

### Permission Errors

```bash
# On Linux/Mac, ensure scripts are executable
chmod +x app/scripts/emergency_admin.sh
chmod +x app/scripts/create_emergency_admin.py
```
