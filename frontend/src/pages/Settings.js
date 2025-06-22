import React from 'react';
import Header from '../components/layout/Header';
import Container from '../components/layout/Container';
import { Card } from '../components/ui';
import '../styles/pages/Settings.css';

const Settings = () => {
  return (
    <Container>
      <Header 
        title="Settings" 
        subtitle="Manage your application preferences and settings"
        showBackButton={true}
      />
      
      <div className="settings-content">
        <Card>
          <div className="settings-placeholder">
            <h3>Settings Page</h3>
            <p>This is where your application settings will be configured.</p>
            <p>Settings functionality will be added here in the next phase.</p>
          </div>
        </Card>
      </div>
    </Container>
  );
};

export default Settings; 