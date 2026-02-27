import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../components/admin/AdminLayout';
import UserRegistrationForm from '../../components/forms/UserRegistrationForm';
import { Card, Text, Group, ThemeIcon } from '@mantine/core';
import { IconUserPlus } from '@tabler/icons-react';
import './ModelEdit.css'; // Reuse existing admin styles

const AdminUserCreate = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('admin');

  const handleSuccess = ({ formData }) => {
    navigate('/admin', {
      state: {
        message: t('createUser.successRedirect', {
          username: formData.username,
          defaultValue: `User "${formData.username}" created successfully!`,
        }),
      },
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
                <h1>{t('createUser.pageTitle', 'Create New User')}</h1>
                <p>{t('createUser.pageSubtitle', 'Create a new user account with patient profile')}</p>
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
                {t('createUser.cardTitle', 'User Account Details')}
              </Text>
              <Text size="sm" c="dimmed">
                {t('createUser.cardSubtitle', 'Fill out the form below to create a new user account')}
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
                    {t('createUser.autoFeaturesTitle', 'Auto-Generated Features')}
                  </Text>
                  <Text size="xs" c="dimmed">
                    &bull; {t('createUser.autoFeatures.patientRecord', 'Patient record will be automatically created (or link to an existing one)')}<br/>
                    &bull; {t('createUser.autoFeatures.linkExisting', 'Use "Link to existing patient" to transfer a patient record to the new user')}<br/>
                    &bull; {t('createUser.autoFeatures.editAccess', 'Original owner will keep edit access to linked patients')}<br/>
                    &bull; {t('createUser.autoFeatures.timestamps', 'Account timestamps will be set automatically')}<br/>
                    &bull; {t('createUser.autoFeatures.immediateLogin', 'User can log in immediately after creation')}
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