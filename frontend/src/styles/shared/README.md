# Medical Page Shared Styles

This file contains shared CSS styles for all medical pages to ensure consistency across the application.

## Usage

Import the shared styles in your medical page components:

```css
@import '../../styles/shared/MedicalPageShared.css';
```

## Page Structure

All medical pages should follow this HTML structure:

```html
<div className="medical-page-container">
  <!-- Header -->
  <header className="medical-page-header">
    <button className="back-button" onClick={() => navigate('/dashboard')}>
      ← Back to Dashboard
    </button>
    <h1>🔬 [Page Title]</h1>
  </header>

  <!-- Content -->
  <div className="medical-page-content">
    {/* Error/Success Messages */}
    {error && <div className="error-message">{error}</div>}
    {successMessage && <div className="success-message">{successMessage}</div>}

    {/* Controls */}
    <div className="medical-page-controls">
      <div className="controls-left">
        <button className="add-button" onClick={handleAdd}>
          + Add New [Item]
        </button>
      </div>
      
      <div className="controls-right">
        <div className="sort-controls">
          <label>Sort by:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="name">Name</option>
            <option value="date">Date</option>
          </select>
          <button className="sort-order-button" onClick={toggleSortOrder}>
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>
    </div>

    {/* Items List */}
    <div className="medical-items-list">
      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔬</div>
          <h3>No [items] found</h3>
          <p>Click "Add New [Item]" to get started.</p>
        </div>
      ) : (
        <div className="medical-items-grid">
          {items.map((item) => (
            <div key={item.id} className="medical-item-card">
              <div className="medical-item-header">
                <h3 className="item-title">{item.name}</h3>
                <span className={`status-badge status-${item.status}`}>
                  {item.status}
                </span>
              </div>
              
              <div className="medical-item-details">
                <div className="detail-item">
                  <span className="label">Date:</span>
                  <span className="value">{formatDate(item.date)}</span>
                </div>
                {/* Add more detail items as needed */}
              </div>
              
              <div className="medical-item-actions">
                <button className="edit-button" onClick={() => handleEdit(item)}>
                  ✏️ Edit
                </button>
                <button className="delete-button" onClick={() => handleDelete(item.id)}>
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
</div>
```

## Form Modal Structure

For add/edit forms, use this structure:

```html
{showForm && (
  <div className="medical-form-overlay">
    <div className="medical-form-modal">
      <div className="form-header">
        <h3>{editing ? 'Edit [Item]' : 'Add New [Item]'}</h3>
        <button className="close-button" onClick={closeForm}>×</button>
      </div>
      
      <div className="medical-form-content">
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="name">Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="date">Date</label>
              <input
                type="date"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
              />
            </div>
            
            <div className="form-group full-width">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Additional notes..."
              />
            </div>
          </div>
          
          <div className="form-actions">
            <button type="button" className="cancel-button" onClick={closeForm}>
              Cancel
            </button>
            <button type="submit" className="save-button">
              {editing ? 'Update [Item]' : 'Add [Item]'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
)}
```

## Available CSS Classes

### Layout Classes
- `.medical-page-container` - Main page container
- `.medical-page-header` - Page header with gradient background
- `.medical-page-content` - Main content area
- `.medical-page-controls` - Controls section (add button, sort, filter)
- `.medical-items-list` - Container for items
- `.medical-items-grid` - Grid layout for items

### Item Classes
- `.medical-item-card` - Individual item card
- `.medical-item-header` - Item card header
- `.medical-item-details` - Item details section
- `.medical-item-actions` - Item action buttons

### Form Classes
- `.medical-form-overlay` - Modal overlay
- `.medical-form-modal` - Modal container
- `.form-header` - Modal header
- `.medical-form-content` - Modal content
- `.form-grid` - Form input grid
- `.form-group` - Individual form field
- `.form-actions` - Form buttons

### Button Classes
- `.back-button` - Back navigation button
- `.add-button` - Add new item button
- `.edit-button` - Edit item button
- `.delete-button` - Delete item button
- `.view-button` - View item button
- `.save-button` - Save form button
- `.cancel-button` - Cancel form button

### Status Badge Classes
- `.status-badge` - Base status badge
- `.status-active` - Active status (green)
- `.status-inactive` - Inactive status (red)
- `.status-pending` - Pending status (yellow)
- `.status-completed` - Completed status (blue)
- `.status-cancelled` - Cancelled status (red)
- `.status-severe` - Severe status (red)
- `.status-moderate` - Moderate status (yellow)
- `.status-mild` - Mild status (green)

### Utility Classes
- `.loading` - Loading state container
- `.spinner` - Loading spinner
- `.error-message` - Error message styling
- `.success-message` - Success message styling
- `.empty-state` - Empty state container
- `.empty-icon` - Empty state icon
- `.detail-item` - Detail row in cards
- `.full-width` - Full width form group

## Color Scheme

The shared styles use a consistent color scheme:
- Primary: `#667eea` to `#764ba2` (gradient)
- Success: `#28a745` to `#20c997` (gradient)
- Warning: `#ffc107` to `#fd7e14` (gradient)
- Danger: `#dc3545` to `#c82333` (gradient)
- Light: `#f8f9fa`
- Dark: `#333`

## Responsive Design

The styles include responsive breakpoints:
- Mobile: `max-width: 480px`
- Tablet: `max-width: 768px`
- Desktop: `min-width: 769px`

All medical pages will automatically adapt to different screen sizes using these shared styles.
