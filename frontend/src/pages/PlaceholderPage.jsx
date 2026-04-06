import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../styles/pages/PlaceholderPage.css';

const sectionKeyMap = {
  patients: 'shared:labels.patientInformation',
  'lab-results': 'shared:categories.lab_results',
  medications: 'shared:categories.medications',
  immunizations: 'shared:categories.immunizations',
  procedures: 'shared:categories.procedures',
  allergies: 'shared:categories.allergies',
  conditions: 'shared:categories.conditions',
  treatments: 'shared:categories.treatments',
  visits: 'common:visits.title',
};

const PlaceholderPage = () => {
  const { section } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['common', 'shared']);

  const sectionTitle = sectionKeyMap[section]
    ? t(sectionKeyMap[section])
    : t('shared:labels.medicalRecords');

  return (
    <div className="placeholder-container">
      <div className="placeholder-content">
        <h1>{sectionTitle}</h1>
        <p>{t('messages.underDevelopment')}</p>
        <p>{t('messages.checkBackSoon')}</p>
        <button onClick={() => navigate('/dashboard')} className="back-button">
          {t('navigation:menu.backToDashboard')}
        </button>
      </div>
    </div>
  );
};

export default PlaceholderPage;
