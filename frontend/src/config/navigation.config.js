import logger from '../services/logger';

import { ENTITY_TYPES } from '../utils/entityRelationships';
import { buildEntityUrl } from '../utils/entityNavigation';

// Breakpoint definitions
export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  laptop: 1200,
  desktop: 1440,
};

/**
 * Navigation sections shared across all viewports
 *
 * NOTE: The 'name' and 'title' fields now contain the actual translated text.
 * Components using this config should use getTranslatedNavigationSections() helper
 * to get the translated navigation structure.
 */
export const NAVIGATION_SECTIONS = {
  medicalRecords: {
    titleKey: 'sidebarNav.sections.medicalRecords',
    title: 'Medical Records',
    priority: 2,
    items: [
      {
        nameKey: 'sidebarNav.items.patientInfo',
        name: 'Patient Info',
        path: buildEntityUrl(ENTITY_TYPES.PATIENT, 'me'),
        icon: '👤',
        id: 'patient-info',
        alwaysVisible: true,
      },
      {
        nameKey: 'sidebarNav.items.medications',
        name: 'Medications',
        path: buildEntityUrl(ENTITY_TYPES.MEDICATION),
        icon: '💊',
        id: 'medications',
        featured: true,
      },
      {
        nameKey: 'sidebarNav.items.labResults',
        name: 'Lab Results',
        path: buildEntityUrl(ENTITY_TYPES.LAB_RESULT),
        icon: '🧪',
        id: 'lab-results',
        featured: true,
      },
      {
        nameKey: 'sidebarNav.items.conditions',
        name: 'Conditions',
        path: buildEntityUrl(ENTITY_TYPES.CONDITION),
        icon: '🩺',
        id: 'conditions',
      },
      {
        nameKey: 'sidebarNav.items.allergies',
        name: 'Allergies',
        path: buildEntityUrl(ENTITY_TYPES.ALLERGY),
        icon: '⚠️',
        id: 'allergies',
        featured: true,
      },
      {
        nameKey: 'sidebarNav.items.vitalSigns',
        name: 'Vital Signs',
        path: buildEntityUrl(ENTITY_TYPES.VITALS),
        icon: '❤️',
        id: 'vitals',
      },
      {
        nameKey: 'sidebarNav.items.symptoms',
        name: 'Symptoms',
        path: buildEntityUrl(ENTITY_TYPES.SYMPTOM),
        icon: '🤒',
        id: 'symptoms',
      },
      {
        nameKey: 'sidebarNav.items.injuries',
        name: 'Injuries',
        path: buildEntityUrl(ENTITY_TYPES.INJURY),
        icon: '🩹',
        id: 'injuries',
      },
    ],
  },
  careAndTreatment: {
    titleKey: 'sidebarNav.sections.careAndTreatment',
    title: 'Care & Treatment',
    priority: 3,
    items: [
      {
        nameKey: 'sidebarNav.items.treatments',
        name: 'Treatments',
        path: buildEntityUrl(ENTITY_TYPES.TREATMENT),
        icon: '🏥',
        id: 'treatments',
      },
      {
        nameKey: 'sidebarNav.items.procedures',
        name: 'Procedures',
        path: buildEntityUrl(ENTITY_TYPES.PROCEDURE),
        icon: '⚕️',
        id: 'procedures',
      },
      {
        nameKey: 'sidebarNav.items.immunizations',
        name: 'Immunizations',
        path: buildEntityUrl(ENTITY_TYPES.IMMUNIZATION),
        icon: '💉',
        id: 'immunizations',
      },
      {
        nameKey: 'sidebarNav.items.visitHistory',
        name: 'Visit History',
        path: buildEntityUrl(ENTITY_TYPES.ENCOUNTER),
        icon: '📅',
        id: 'visits',
        featured: true,
      },
      {
        nameKey: 'sidebarNav.items.familyHistory',
        name: 'Family History',
        path: buildEntityUrl(ENTITY_TYPES.FAMILY_MEMBER),
        icon: '👨‍👩‍👧‍👦',
        id: 'family-history',
      },
    ],
  },
  providers: {
    titleKey: 'sidebarNav.sections.misc',
    title: 'Misc.',
    priority: 4,
    items: [
      {
        nameKey: 'sidebarNav.items.practitioners',
        name: 'Practitioners',
        path: buildEntityUrl(ENTITY_TYPES.PRACTITIONER),
        icon: '👨‍⚕️',
        id: 'practitioners',
      },
      {
        nameKey: 'sidebarNav.items.pharmacies',
        name: 'Pharmacies',
        path: buildEntityUrl(ENTITY_TYPES.PHARMACY),
        icon: '🏪',
        id: 'pharmacies',
      },
      {
        nameKey: 'sidebarNav.items.insurance',
        name: 'Insurance',
        path: buildEntityUrl(ENTITY_TYPES.INSURANCE),
        icon: '💳',
        id: 'insurance',
      },
      {
        nameKey: 'sidebarNav.items.emergencyContacts',
        name: 'Emergency Contacts',
        path: buildEntityUrl(ENTITY_TYPES.EMERGENCY_CONTACT),
        icon: '🚨',
        id: 'emergency-contacts',
        alwaysVisible: true,
      },
    ],
  },
  tools: {
    titleKey: 'sidebarNav.sections.tools',
    title: 'Tools',
    priority: 5,
    items: [
      {
        nameKey: 'sidebarNav.items.tagManagement',
        name: 'Tag Management',
        path: '/tools/tags',
        icon: '🏷️',
        id: 'tag-management',
      },
      {
        nameKey: 'sidebarNav.items.customReports',
        name: 'Custom Reports',
        path: '/reports/builder',
        icon: '📊',
        id: 'custom-reports',
        featured: true,
      },
      {
        nameKey: 'sidebarNav.items.exportRecords',
        name: 'Export Records',
        path: '/export',
        icon: '📤',
        id: 'export',
      },
      {
        nameKey: 'sidebarNav.items.settings',
        name: 'Settings',
        path: '/settings',
        icon: '⚙️',
        id: 'settings',
        alwaysVisible: true,
      },
    ],
  },
};

// Admin section (conditionally added based on user role)
export const ADMIN_SECTION = {
  titleKey: 'sidebarNav.sections.administration',
  title: 'Administration',
  priority: 6,
  requiresAdmin: true,
  items: [
    {
      nameKey: 'sidebarNav.items.adminDashboard',
      name: 'Admin Dashboard',
      path: '/admin',
      icon: '🔧',
      id: 'admin-dashboard',
    },
    {
      nameKey: 'sidebarNav.items.dataModels',
      name: 'Data Models',
      path: '/admin/data-models',
      icon: '🗃️',
      id: 'data-models',
    },
    {
      nameKey: 'sidebarNav.items.backupManagement',
      name: 'Backup Management',
      path: '/admin/backup',
      icon: '💾',
      id: 'backup',
    },
    {
      nameKey: 'sidebarNav.items.systemHealth',
      name: 'System Health',
      path: '/admin/system-health',
      icon: '🔍',
      id: 'system-health',
    },
  ],
};

// Viewport-specific configurations
export const VIEWPORT_CONFIGS = {
  mobile: {
    maxSections: 5,
    layout: 'sidebar',
    showLabels: true,
    featuredOnly: false, // Show all items in mobile sidebar
    bottomNavItems: [
      'dashboard',
      'medications',
      'lab-results',
      'visits',
      'settings',
    ], // For future bottom nav
  },
  tablet: {
    maxSections: 5,
    layout: 'dropdown',
    compactMode: true,
  },
  laptop: {
    maxSections: 6,
    layout: 'dropdown',
    showAllSections: true,
  },
  desktop: {
    maxSections: 7,
    layout: 'dropdown',
    showAllSections: true,
    expandedMode: true,
  },
};

// Helper function to get navigation sections based on viewport and user role
export const getNavigationSections = (viewport, isAdmin = false) => {
  // Removed frequent navigation logging for performance

  const sections = { ...NAVIGATION_SECTIONS };

  // Add admin section if user is admin
  if (isAdmin) {
    sections.admin = ADMIN_SECTION;
  }

  // Apply viewport-specific modifications
  const config = VIEWPORT_CONFIGS[viewport];

  if (config?.hideSections) {
    config.hideSections.forEach(sectionKey => {
      delete sections[sectionKey];
    });
  }

  return sections;
};

// Helper to get featured items for quick access
export const getFeaturedItems = () => {
  const featured = [];

  Object.values(NAVIGATION_SECTIONS).forEach(section => {
    section.items.forEach(item => {
      if (item.featured || item.alwaysVisible) {
        featured.push({
          ...item,
          sectionTitle: section.title,
        });
      }
    });
  });

  return featured;
};
