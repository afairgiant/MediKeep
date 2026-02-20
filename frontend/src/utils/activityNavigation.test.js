import {
  getActivityNavigationUrl,
  getActivityIcon,
  getActionBadgeColor,
  getActionIcon,
  formatActivityDescription,
  getModelDisplayName,
  getActionDisplayName,
  isActivityClickable,
  getActivityTooltip,
  getActivityFilterOptions,
  getActionFilterOptions,
  filterActivities,
  groupActivities,
} from './activityNavigation';

import {
  IconPill,
  IconFlask,
  IconMedicalCross,
  IconBrain,
  IconAlertTriangle,
  IconVaccine,
  IconHeartbeat,
  IconPhoneCall,
  IconClipboardList,
  IconCalendarEvent,
  IconUser,
  IconPlus,
  IconEdit,
  IconTrash,
} from '@tabler/icons-react';

describe('Activity Navigation Utils', () => {
  describe('getActivityNavigationUrl', () => {
    it('should return correct URL with hash for medication', () => {
      const activity = { id: 1, model_name: 'medication', action: 'created' };
      expect(getActivityNavigationUrl(activity)).toBe('/medications?view=1');
    });

    it('should return correct URL with hash for lab_result', () => {
      const activity = { id: 2, model_name: 'lab_result', action: 'updated' };
      expect(getActivityNavigationUrl(activity)).toBe('/lab-results?view=2');
    });

    it('should return URL without hash when includeHash is false', () => {
      const activity = { id: 1, model_name: 'medication', action: 'created' };
      expect(getActivityNavigationUrl(activity, false)).toBe('/medications');
    });

    it('should return URL without hash when no id provided', () => {
      const activity = { model_name: 'medication', action: 'created' };
      expect(getActivityNavigationUrl(activity)).toBe('/medications');
    });

    it('should return null for unknown model', () => {
      const activity = { id: 3, model_name: 'unknown_model', action: 'created' };
      expect(getActivityNavigationUrl(activity)).toBe(null);
    });

    it('should return null for invalid activity', () => {
      expect(getActivityNavigationUrl(null)).toBe(null);
      expect(getActivityNavigationUrl({})).toBe(null);
    });

    it('should handle patient model specially', () => {
      const activity = { id: 4, model_name: 'patient', action: 'updated' };
      expect(getActivityNavigationUrl(activity)).toBe('/patients/me');
    });
  });

  describe('getActivityIcon', () => {
    it('should return correct icon for medication', () => {
      expect(getActivityIcon('medication')).toBe(IconPill);
    });

    it('should return correct icon for lab_result', () => {
      expect(getActivityIcon('lab_result')).toBe(IconFlask);
    });

    it('should return null for unknown model', () => {
      expect(getActivityIcon('unknown_model')).toBe(null);
    });

    it('should handle case insensitive input', () => {
      expect(getActivityIcon('MEDICATION')).toBe(IconPill);
      expect(getActivityIcon('Lab_Result')).toBe(IconFlask);
    });
  });

  describe('getActionBadgeColor', () => {
    it('should return correct colors for standard actions', () => {
      expect(getActionBadgeColor('created')).toBe('green');
      expect(getActionBadgeColor('updated')).toBe('blue');
      expect(getActionBadgeColor('deleted')).toBe('red');
    });

    it('should return gray for unknown actions', () => {
      expect(getActionBadgeColor('unknown_action')).toBe('gray');
      expect(getActionBadgeColor('')).toBe('gray');
      expect(getActionBadgeColor(null)).toBe('gray');
    });

    it('should handle case insensitive input', () => {
      expect(getActionBadgeColor('CREATED')).toBe('green');
      expect(getActionBadgeColor('Updated')).toBe('blue');
    });
  });

  describe('getActionIcon', () => {
    it('should return correct icons for standard actions', () => {
      expect(getActionIcon('created')).toBe(IconPlus);
      expect(getActionIcon('updated')).toBe(IconEdit);
      expect(getActionIcon('deleted')).toBe(IconTrash);
    });

    it('should return null for unknown actions', () => {
      expect(getActionIcon('unknown_action')).toBe(null);
      expect(getActionIcon('')).toBe(null);
      expect(getActionIcon(null)).toBe(null);
    });
  });

  describe('getModelDisplayName', () => {
    it('should return correct display names', () => {
      expect(getModelDisplayName('medication')).toBe('Medication');
      expect(getModelDisplayName('lab_result')).toBe('Lab Result');
      expect(getModelDisplayName('emergency_contact')).toBe('Emergency Contact');
    });

    it('should handle unknown models gracefully', () => {
      expect(getModelDisplayName('unknown_model')).toBe('unknown_model');
      expect(getModelDisplayName('')).toBe('Record');
      expect(getModelDisplayName(null)).toBe('Record');
    });
  });

  describe('getActionDisplayName', () => {
    it('should return correct display names', () => {
      expect(getActionDisplayName('created')).toBe('Created');
      expect(getActionDisplayName('updated')).toBe('Updated');
      expect(getActionDisplayName('deleted')).toBe('Deleted');
    });

    it('should handle unknown actions gracefully', () => {
      expect(getActionDisplayName('unknown_action')).toBe('unknown_action');
      expect(getActionDisplayName('')).toBe('Modified');
      expect(getActionDisplayName(null)).toBe('Modified');
    });
  });

  describe('isActivityClickable', () => {
    it('should return true for valid activities', () => {
      const activity = { id: 1, model_name: 'medication', action: 'created' };
      expect(isActivityClickable(activity)).toBe(true);
    });

    it('should return false for deleted activities', () => {
      const activity = { id: 1, model_name: 'medication', action: 'deleted' };
      expect(isActivityClickable(activity)).toBe(false);
    });

    it('should return false for unknown models', () => {
      const activity = { id: 1, model_name: 'unknown_model', action: 'created' };
      expect(isActivityClickable(activity)).toBe(false);
    });

    it('should return false for invalid activities', () => {
      expect(isActivityClickable(null)).toBe(false);
      expect(isActivityClickable({})).toBe(false);
    });
  });

  describe('formatActivityDescription', () => {
    it('should return description as is if well formatted', () => {
      const activity = {
        model_name: 'medication',
        action: 'created',
        description: 'This is a long description that provides good context and details about what happened',
      };
      expect(formatActivityDescription(activity)).toBe(activity.description);
    });

    it('should enhance short descriptions with context', () => {
      const activity = {
        model_name: 'medication',
        action: 'created',
        description: 'Aspirin 81mg',
      };
      const result = formatActivityDescription(activity);
      expect(result).toContain('Created');
      expect(result).toContain('medication');
      expect(result).toContain('Aspirin 81mg');
    });

    it('should handle invalid activities gracefully', () => {
      expect(formatActivityDescription(null)).toBe('Unknown activity');
      expect(formatActivityDescription({})).toBe('Unknown activity');
    });
  });

  describe('getActivityTooltip', () => {
    it('should return clickable tooltip for valid activities', () => {
      const activity = { id: 1, model_name: 'medication', action: 'created' };
      const tooltip = getActivityTooltip(activity);
      expect(tooltip).toContain('Click to go to');
      expect(tooltip).toContain('medication');
    });

    it('should return deleted tooltip for deleted activities', () => {
      const activity = { id: 1, model_name: 'medication', action: 'deleted' };
      const tooltip = getActivityTooltip(activity);
      expect(tooltip).toContain('was deleted');
    });

    it('should handle invalid activities gracefully', () => {
      expect(getActivityTooltip(null)).toBe('');
      expect(getActivityTooltip({})).toContain('View');
    });
  });

  describe('Phase 3A: Filtering Functions', () => {
    describe('getActivityFilterOptions', () => {
      it('should return array of filter options', () => {
        const options = getActivityFilterOptions();
        expect(Array.isArray(options)).toBe(true);
        expect(options.length).toBeGreaterThan(0);
        expect(options[0]).toEqual({ value: 'all', label: 'All Activity' });
        expect(options.find(opt => opt.value === 'medication')).toBeTruthy();
      });
    });

    describe('getActionFilterOptions', () => {
      it('should return array of action filter options', () => {
        const options = getActionFilterOptions();
        expect(Array.isArray(options)).toBe(true);
        expect(options.length).toBeGreaterThan(0);
        expect(options[0]).toEqual({ value: 'all', label: 'All Actions' });
        expect(options.find(opt => opt.value === 'created')).toBeTruthy();
      });
    });

    describe('filterActivities', () => {
      const sampleActivities = [
        { id: 1, model_name: 'medication', action: 'created' },
        { id: 2, model_name: 'lab_result', action: 'updated' },
        { id: 3, model_name: 'medication', action: 'deleted' },
        { id: 4, model_name: 'procedure', action: 'created' },
      ];

      it('should return all activities when no filters applied', () => {
        const result = filterActivities(sampleActivities);
        expect(result).toHaveLength(4);
      });

      it('should filter by type correctly', () => {
        const result = filterActivities(sampleActivities, 'medication');
        expect(result).toHaveLength(2);
        expect(result.every(a => a.model_name === 'medication')).toBe(true);
      });

      it('should filter by action correctly', () => {
        const result = filterActivities(sampleActivities, 'all', 'created');
        expect(result).toHaveLength(2);
        expect(result.every(a => a.action === 'created')).toBe(true);
      });

      it('should filter by both type and action', () => {
        const result = filterActivities(sampleActivities, 'medication', 'created');
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ id: 1, model_name: 'medication', action: 'created' });
      });

      it('should handle empty array', () => {
        const result = filterActivities([]);
        expect(result).toHaveLength(0);
      });

      it('should handle null input', () => {
        const result = filterActivities(null);
        expect(result).toHaveLength(0);
      });
    });

    describe('groupActivities', () => {
      const sampleActivities = [
        { 
          id: 1, 
          model_name: 'medication', 
          action: 'created',
          timestamp: '2024-01-15T10:30:00Z'
        },
        { 
          id: 2, 
          model_name: 'lab_result', 
          action: 'updated',
          timestamp: '2024-01-15T14:20:00Z'
        },
        { 
          id: 3, 
          model_name: 'medication', 
          action: 'deleted',
          timestamp: '2024-01-14T09:15:00Z'
        },
      ];

      it('should group by date correctly', () => {
        const result = groupActivities(sampleActivities, 'date');
        const dates = Object.keys(result);
        expect(dates.length).toBe(2);
        expect(result[dates[0]]).toHaveLength(2); // 2 activities on first date
        expect(result[dates[1]]).toHaveLength(1); // 1 activity on second date
      });

      it('should group by model_name correctly', () => {
        const result = groupActivities(sampleActivities, 'model_name');
        expect(result['Medication']).toHaveLength(2);
        expect(result['Lab Result']).toHaveLength(1);
      });

      it('should group by action correctly', () => {
        const result = groupActivities(sampleActivities, 'action');
        expect(result['Created']).toHaveLength(1);
        expect(result['Updated']).toHaveLength(1);
        expect(result['Deleted']).toHaveLength(1);
      });

      it('should handle empty array', () => {
        const result = groupActivities([]);
        expect(result).toEqual({});
      });

      it('should handle null input', () => {
        const result = groupActivities(null);
        expect(result).toEqual({});
      });
    });
  });
});