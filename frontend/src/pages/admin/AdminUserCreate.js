import React from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import UserRegistrationForm from '../../components/forms/UserRegistrationForm';
import { Card, Text, Group, ThemeIcon } from '@mantine/core';
import { IconUserPlus } from '@tabler/icons-react';
import './ModelEdit.css'; // Reuse existing admin styles

const AdminUserCreate = () => {
  const navigate = useNavigate();

  const handleSuccess = ({ userData, formData }) => {
    // Admin context success - don't auto-login, redirect to admin area
    navigate('/admin', { 
      state: { 
        message: `User "${formData.username}" created successfully!` 
      } 
    });
  };

  const handleCancel = () => {
    navigate('/admin');
  };

  return (
    <AdminLayout>
      <div className="model-edit">
        <div className="model-edit-header">
          <div className="edit-title">
            <Group align="center" mb="xs">
              <ThemeIcon size="xl" variant="light" color="blue">
                <IconUserPlus size={24} />
              </ThemeIcon>
              <div>
                <h1>Create New User</h1>
                <p>Create a new user account with patient profile</p>
              </div>
            </Group>
          </div>
        </div>

        <Card shadow="sm" p="xl" withBorder>
          <Group mb="md">
            <ThemeIcon size="lg" variant="light" color="green">
              <IconUserPlus size={20} />
            </ThemeIcon>
            <div>
              <Text size="lg" fw={600}>
                User Account Details
              </Text>
              <Text size="sm" c="dimmed">
                Fill out the form below to create a new user account
              </Text>
            </div>
          </Group>

          <UserRegistrationForm
            onSuccess={handleSuccess}
            onCancel={handleCancel}
            isAdminContext={true}
          />

          <div className="admin-create-user-info">
            <Card p="md" withBorder mt="lg" bg="blue.0">
              <Group>
                <ThemeIcon size="md" variant="light" color="blue">
                  <IconUserPlus size={16} />
                </ThemeIcon>
                <div>
                  <Text size="sm" fw={500}>
                    Auto-Generated Features
                  </Text>
                  <Text size="xs" c="dimmed">
                    • Patient record will be automatically created<br/>
                    • User will have default "user" role<br/>
                    • Account timestamps will be set automatically<br/>
                    • User can log in immediately after creation
                  </Text>
                </div>
              </Group>
            </Card>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminUserCreate;