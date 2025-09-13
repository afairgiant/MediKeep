import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import UserRegistrationForm from '../../components/forms/UserRegistrationForm';
import { Card, Text, Group, ThemeIcon, Container, Button } from '@mantine/core';
import { IconUserPlus, IconArrowLeft } from '@tabler/icons-react';

const UserCreation = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSuccess = async ({ userData, formData }) => {
    // Public context success - auto-login and redirect to dashboard
    try {
      const result = await login({
        username: formData.username,
        password: formData.password
      });
      
      if (result.success) {
        // Add a small delay to ensure auth state is fully saved before navigation
        await new Promise(resolve => setTimeout(resolve, 500));
        
        navigate('/dashboard', { 
          state: { 
            message: `Welcome ${formData.firstName}! Your account has been created successfully.` 
          } 
        });
      } else {
        // If login result indicates failure, redirect to login page
        navigate('/login', { 
          state: { 
            message: `Account created successfully! Please log in with your credentials.` 
          } 
        });
      }
    } catch (error) {
      // If auto-login fails, redirect to login page with success message
      navigate('/login', { 
        state: { 
          message: `Account created successfully! Please log in with your credentials.` 
        } 
      });
    }
  };

  const handleCancel = () => {
    navigate('/login');
  };

  return (
    <Container size="md" py="xl">
      <div style={{ minHeight: '100vh', paddingTop: '2rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <Group mb="sm">
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate('/login')}
              color="gray"
            >
              Back to Login
            </Button>
          </Group>
          
          <Group align="center" mb="xs">
            <ThemeIcon size="xl" variant="light" color="blue">
              <IconUserPlus size={24} />
            </ThemeIcon>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.875rem', fontWeight: 600, color: '#1f2937' }}>
                Create Your Account
              </h1>
              <p style={{ margin: '0.5rem 0 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
                Join us today and get access to your personal medical records
              </p>
            </div>
          </Group>
        </div>

        {/* Main Form Card */}
        <Card shadow="sm" p="xl" withBorder>
          <Group mb="md">
            <ThemeIcon size="lg" variant="light" color="green">
              <IconUserPlus size={20} />
            </ThemeIcon>
            <div>
              <Text size="lg" fw={600}>
                Account Details
              </Text>
              <Text size="sm" c="dimmed">
                Fill out the form below to create your new account
              </Text>
            </div>
          </Group>

          <UserRegistrationForm
            onSuccess={handleSuccess}
            onCancel={handleCancel}
            isAdminContext={false}
          />

          {/* Info Card */}
          <Card p="md" withBorder mt="lg" bg="blue.0">
            <Group>
              <ThemeIcon size="md" variant="light" color="blue">
                <IconUserPlus size={16} />
              </ThemeIcon>
              <div>
                <Text size="sm" fw={500}>
                  What happens next?
                </Text>
                <Text size="xs" c="dimmed">
                  • Your patient record will be automatically created<br/>
                  • You'll be logged in immediately after account creation<br/>
                  • You can start managing your medical information right away<br/>
                  • All your data is secure and private
                </Text>
              </div>
            </Group>
          </Card>
        </Card>
      </div>
    </Container>
  );
};

export default UserCreation;