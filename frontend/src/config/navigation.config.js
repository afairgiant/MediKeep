import { ENTITY_TYPES } from '../utils/entityRelationships';
import { buildEntityUrl } from '../utils/entityNavigation';

// Breakpoint definitions
export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  laptop: 1200,
  desktop: 1440,
};

// Navigation sections shared across all viewports
export const NAVIGATION_SECTIONS = {
  medicalRecords: {
    title: 'Medical Records',
    priority: 2,
    items: [
      {
        name: 'Patient Info',
        path: buildEntityUrl(ENTITY_TYPES.PATIENT, 'me'),
        icon: '👤',
        id: 'patient-info',
        alwaysVisible: true,
      },
      {
        name: 'Medications',
        path: buildEntityUrl(ENTITY_TYPES.MEDICATION),
        icon: '💊',
        id: 'medications',
        featured: true,
      },
      {
        name: 'Lab Results',
        path: buildEntityUrl(ENTITY_TYPES.LAB_RESULT),
        icon: '🧪',
        id: 'lab-results',
        featured: true,
      },
      {
        name: 'Conditions',
        path: buildEntityUrl(ENTITY_TYPES.CONDITION),
        icon: '🩺',
        id: 'conditions',
      },
      {
        name: 'Allergies',
        path: buildEntityUrl(ENTITY_TYPES.ALLERGY),
        icon: '⚠️',
        id: 'allergies',
        featured: true,
      },
      {
        name: 'Vital Signs',
        path: buildEntityUrl(ENTITY_TYPES.VITALS),
        icon: '❤️',
        id: 'vitals',
      },
    ],
  },
  careAndTreatment: {
    title: 'Care & Treatment',
    priority: 3,
    items: [
      {
        name: 'Treatments',
        path: buildEntityUrl(ENTITY_TYPES.TREATMENT),
        icon: '🏥',
        id: 'treatments',
      },
      {
        name: 'Procedures',
        path: buildEntityUrl(ENTITY_TYPES.PROCEDURE),
        icon: '⚕️',
        id: 'procedures',
      },
      {
        name: 'Immunizations',
        path: buildEntityUrl(ENTITY_TYPES.IMMUNIZATION),
        icon: '💉',
        id: 'immunizations',
      },
      {
        name: 'Visit History',
        path: buildEntityUrl(ENTITY_TYPES.ENCOUNTER),
        icon: '📅',
        id: 'visits',
        featured: true,
      },
      {
        name: 'Family History',
        path: buildEntityUrl(ENTITY_TYPES.FAMILY_MEMBER),
        icon: '👨‍👩‍👧‍👦',
        id: 'family-history',
      },
    ],
  },
  providers: {
    title: 'Misc.',
    priority: 4,
    items: [
      {
        name: 'Practitioners',
        path: buildEntityUrl(ENTITY_TYPES.PRACTITIONER),
        icon: '👨‍⚕️',
        id: 'practitioners',
      },
      {
        name: 'Pharmacies',
        path: buildEntityUrl(ENTITY_TYPES.PHARMACY),
        icon: '🏪',
        id: 'pharmacies',
      },
      {
        name: 'Insurance',
        path: buildEntityUrl(ENTITY_TYPES.INSURANCE),
        icon: '💳',
        id: 'insurance',
      },
      {
        name: 'Emergency Contacts',
        path: buildEntityUrl(ENTITY_TYPES.EMERGENCY_CONTACT),
        icon: '🚨',
        id: 'emergency-contacts',
        alwaysVisible: true,
      },
    ],
  },
  tools: {
    title: 'Tools',
    priority: 5,
    items: [
      {
        name: 'Custom Reports',
        path: '/reports/builder',
        icon: '📊',
        id: 'custom-reports',
        featured: true,
      },
      {
        name: 'Export Records',
        path: '/export',
        icon: '📤',
        id: 'export',
      },
      {
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
  title: 'Administration',
  priority: 6,
  requiresAdmin: true,
  items: [
    {
      name: 'Admin Dashboard',
      path: '/admin',
      icon: '🔧',
      id: 'admin-dashboard',
    },
    {
      name: 'Data Models',
      path: '/admin/data-models',
      icon: '🗃️',
      id: 'data-models',
    },
    {
      name: 'Backup Management',
      path: '/admin/backup',
      icon: '💾',
      id: 'backup',
    },
    {
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
  console.log('🧭 NAV_CONFIG: Getting navigation sections', {
    viewport,
    isAdmin,
    timestamp: new Date().toISOString(),
  });

  const sections = { ...NAVIGATION_SECTIONS };

  // Add admin section if user is admin
  if (isAdmin) {
    sections.admin = ADMIN_SECTION;
    console.log('🧭 NAV_CONFIG: Admin section added', {
      adminSection: ADMIN_SECTION,
      totalSections: Object.keys(sections).length,
      timestamp: new Date().toISOString(),
    });
  } else {
    console.log('🧭 NAV_CONFIG: Admin section NOT added (user not admin)', {
      isAdmin,
      timestamp: new Date().toISOString(),
    });
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
