import React from 'react';
import { formatDate } from '../../utils/helpers';

const MedicalTable = ({
  data,
  columns,
  patientData,
  tableName,
  onEdit,
  onDelete,
  onView,
  formatters = {},
}) => {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className="medications-table-container">
      <div className="print-header">
        <h2>
          {tableName} - {patientData?.first_name} {patientData?.last_name}
        </h2>
        <p>Generated on: {formatDate(new Date().toISOString())}</p>
      </div>
      <table className="medications-table">
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={index}>{column.header}</th>
            ))}
            <th className="no-print">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map(item => (
            <tr key={item.id}>
              {columns.map((column, index) => (
                <td key={index}>
                  {formatters[column.accessor]
                    ? formatters[column.accessor](item[column.accessor], item)
                    : item[column.accessor] || '-'}
                </td>
              ))}
              <td className="no-print">
                <div className="table-actions">
                  {onView && (
                    <button
                      className="view-button-small"
                      onClick={() => onView(item)}
                      title="View"
                    >
                      👁️
                    </button>
                  )}
                  {onEdit && (
                    <button
                      className="edit-button-small"
                      onClick={() => onEdit(item)}
                      title="Edit"
                    >
                      ✏️
                    </button>
                  )}
                  {onDelete && (
                    <button
                      className="delete-button-small"
                      onClick={() => onDelete(item.id)}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MedicalTable;
