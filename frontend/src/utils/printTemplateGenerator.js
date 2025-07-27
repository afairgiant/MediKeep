/**
 * Utilities for generating print templates for medical records
 * Provides consistent printing functionality across all medical pages
 */

import { formatDate } from './helpers';
import { formatFieldLabel, formatFieldValue, formatPhoneFields, insurancePrintLabelMappings, contactInfoLabelMappings } from './fieldFormatters';

/**
 * Base CSS styles for medical record printing
 * @returns {string} CSS styles for print templates
 */
export const getMedicalPrintStyles = () => `
  body { 
    font-family: Arial, sans-serif; 
    margin: 20px; 
    font-size: 12px;
    line-height: 1.4;
  }
  .header { 
    text-align: center;
    border-bottom: 2px solid #333;
    padding-bottom: 10px;
    margin-bottom: 20px;
  }
  .record-title { 
    font-size: 18px;
    font-weight: bold;
    margin-bottom: 5px;
  }
  .record-type { 
    font-size: 14px;
    color: #666;
    text-transform: capitalize;
  }
  .section { 
    margin-bottom: 15px;
    page-break-inside: avoid;
  }
  .section-title { 
    font-weight: bold; 
    font-size: 14px; 
    margin-bottom: 8px;
    border-bottom: 1px solid #ccc;
    padding-bottom: 2px;
  }
  .field-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 10px;
  }
  .field { 
    margin: 3px 0; 
  }
  .label { 
    font-weight: bold;
    display: inline-block;
    width: 120px;
  }
  .value {
    display: inline-block;
  }
  .status-badge {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: bold;
    text-transform: uppercase;
  }
  .status-active { background-color: #d4edda; color: #155724; }
  .status-inactive { background-color: #f8d7da; color: #721c24; }
  .status-pending { background-color: #fff3cd; color: #856404; }
  .status-expired { background-color: #f8d7da; color: #721c24; }
  .primary-badge {
    background-color: #fff3cd;
    color: #856404;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: bold;
    margin-left: 10px;
  }
  .footer {
    margin-top: 30px;
    text-align: center;
    color: #666;
    font-size: 10px;
    border-top: 1px solid #ccc;
    padding-top: 10px;
  }
  @media print {
    body { margin: 0; font-size: 11px; }
    .header { page-break-after: avoid; }
    .section { page-break-inside: avoid; }
  }
`;

/**
 * Generates the header section for medical record prints
 * @param {Object} config - Header configuration
 * @returns {string} HTML for header section
 */
export const generatePrintHeader = (config) => {
  const { title, type, status, isPrimary = false, statusBadges = {} } = config;
  
  const statusClass = statusBadges[status] || 'status-active';
  const primaryBadge = isPrimary ? '<span class="primary-badge">PRIMARY</span>' : '';
  
  return `
    <div class="header">
      <div class="record-title">${title}</div>
      <div class="record-type">
        ${type}
        ${primaryBadge}
      </div>
      <div style="margin-top: 5px;">
        <span class="status-badge ${statusClass}">${status}</span>
      </div>
    </div>
  `;
};

/**
 * Generates a field grid section for medical record prints
 * @param {string} sectionTitle - Title for the section
 * @param {Object} data - Data object containing fields
 * @param {Object} options - Formatting options
 * @returns {string} HTML for field grid section
 */
export const generateFieldGridSection = (sectionTitle, data, options = {}) => {
  const {
    labelMappings = {},
    excludeFields = [],
    includeEmpty = false,
    customFormatting = {}
  } = options;

  const fields = Object.entries(data)
    .filter(([key, value]) => {
      if (excludeFields.includes(key)) return false;
      if (!includeEmpty && (!value || value === '')) return false;
      return true;
    })
    .map(([key, value]) => {
      const label = formatFieldLabel(key, labelMappings);
      const formattedValue = customFormatting[key] 
        ? customFormatting[key](value)
        : formatFieldValue(key, value);
      
      return `
        <div class="field">
          <span class="label">${label}:</span>
          <span class="value">${formattedValue}</span>
        </div>
      `;
    });

  if (fields.length === 0) return '';

  return `
    <div class="section">
      <div class="section-title">${sectionTitle}</div>
      <div class="field-grid">
        ${fields.join('')}
      </div>
    </div>
  `;
};

/**
 * Generates footer for medical record prints
 * @returns {string} HTML for footer
 */
export const generatePrintFooter = () => {
  const now = new Date();
  return `
    <div class="footer">
      Printed on ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}
    </div>
  `;
};

/**
 * Generic medical record print template generator
 * @param {Object} data - The medical record data
 * @param {Object} config - Print configuration
 * @returns {string} Complete HTML for printing
 */
export const generateMedicalRecordPrint = (data, config) => {
  const {
    title,
    type,
    headerConfig = {},
    sections = [],
    customStyles = ''
  } = config;

  const styles = getMedicalPrintStyles() + customStyles;
  
  const header = generatePrintHeader({
    title,
    type,
    status: data.status,
    isPrimary: data.is_primary,
    ...headerConfig
  });

  const sectionHTML = sections.map(section => {
    const { 
      title: sectionTitle, 
      data: sectionData, 
      options = {},
      customHTML = null 
    } = section;

    if (customHTML) {
      return customHTML;
    }

    return generateFieldGridSection(sectionTitle, sectionData, options);
  }).join('');

  const footer = generatePrintFooter();

  return `
    <html>
      <head>
        <title>${title}</title>
        <style>${styles}</style>
      </head>
      <body>
        ${header}
        ${sectionHTML}
        ${footer}
      </body>
    </html>
  `;
};

/**
 * Insurance-specific print template generator
 * @param {Object} insurance - Insurance data
 * @returns {string} Complete HTML for insurance printing
 */
export const generateInsurancePrint = (insurance) => {
  const coverageDetails = insurance.coverage_details || {};
  const contactInfo = insurance.contact_info || {};
  
  // Format phone numbers for consistency
  const formattedContactInfo = formatPhoneFields(contactInfo);

  const config = {
    title: insurance.company_name,
    type: `${insurance.insurance_type} Insurance`,
    headerConfig: {
      statusBadges: {
        'active': 'status-active',
        'inactive': 'status-inactive',
        'pending': 'status-pending',
        'expired': 'status-expired'
      }
    },
    sections: [
      {
        title: 'Member Information',
        data: {
          'Member Name': insurance.member_name,
          'Member ID': insurance.member_id,
          ...(insurance.group_number && { 'Group Number': insurance.group_number }),
          ...(insurance.plan_name && { 'Plan Name': insurance.plan_name }),
          ...(insurance.employer_group && { 'Employer/Group': insurance.employer_group }),
          ...(insurance.policy_holder_name && insurance.policy_holder_name !== insurance.member_name && {
            'Policy Holder': insurance.policy_holder_name,
            'Relationship': insurance.relationship_to_holder || 'Self'
          })
        }
      },
      {
        title: 'Coverage Period',
        data: {
          'Effective Date': formatDate(insurance.effective_date),
          ...(insurance.expiration_date && { 'Expiration Date': formatDate(insurance.expiration_date) })
        }
      },
      ...(Object.keys(coverageDetails).length > 0 ? [{
        title: 'Coverage Details',
        data: coverageDetails,
        options: {
          labelMappings: insurancePrintLabelMappings
        }
      }] : []),
      ...(Object.keys(formattedContactInfo).length > 0 ? [{
        title: 'Contact Information',
        data: formattedContactInfo,
        options: {
          labelMappings: contactInfoLabelMappings
        }
      }] : []),
      ...(insurance.notes ? [{
        title: 'Notes',
        customHTML: `
          <div class="section">
            <div class="section-title">Notes</div>
            <div style="padding: 5px; background-color: #f8f9fa; border-radius: 3px;">
              ${insurance.notes.replace(/\n/g, '<br>')}
            </div>
          </div>
        `
      }] : [])
    ]
  };

  return generateMedicalRecordPrint(insurance, config);
};

/**
 * Opens a print window with the generated HTML
 * @param {string} html - The HTML content to print
 * @param {string} windowTitle - Title for the print window
 */
export const openPrintWindow = (html, windowTitle = 'Medical Record') => {
  const printWindow = window.open('', '_blank');
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.print();
  printWindow.close();
};

/**
 * Convenience function to print insurance records
 * @param {Object} insurance - Insurance data
 * @param {Function} onSuccess - Success callback
 * @param {Function} onError - Error callback
 */
export const printInsuranceRecord = (insurance, onSuccess, onError) => {
  try {
    const html = generateInsurancePrint(insurance);
    openPrintWindow(html, `Insurance Details - ${insurance.company_name}`);
    
    if (onSuccess) {
      onSuccess();
    }
  } catch (error) {
    console.error('Error generating insurance print:', error);
    if (onError) {
      onError(error);
    }
  }
};