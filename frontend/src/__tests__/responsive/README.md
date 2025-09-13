# Responsive Medical Forms and Tables Tests

This directory contains comprehensive tests for Phase 4 of the responsive design system implementation, focusing on medical forms and tables with responsive behavior across all device breakpoints.

## Test Structure

### 1. ResponsiveTestUtils.js
**Core testing utilities and helpers**
- Viewport simulation and breakpoint testing
- Mock data generators for medical forms
- Performance measurement tools
- Custom test matchers for responsive behavior
- Breakpoint transition testing utilities

**Key Features:**
- `renderResponsive()` - Renders components with responsive context
- `testAtAllBreakpoints()` - Tests components across all breakpoints
- `simulateFormSubmission()` - Simulates user form interactions
- `mockMedicalData` - Generates realistic medical test data
- Performance measurement and transition testing

### 2. MedicalFormSubmission.test.js
**Form submission tests across all breakpoints**

**Coverage:**
- ✅ Medication Form: Field validation, practitioner selection, dosage input
- ✅ Allergy Form: Allergen input, severity selection, reaction types
- ✅ Condition Form: Condition names, diagnosis dates, status management
- ✅ Immunization Form: Vaccine names, administration dates, practitioners

**Test Scenarios:**
- Form rendering at mobile (xs, sm), tablet (md), desktop (lg, xl+)
- Touch target sizing (minimum 44px on mobile)
- Field validation and error handling
- Data persistence across breakpoint changes
- Form submission API integration
- Loading states and error recovery

### 3. ResponsiveTable.test.js
**Table interaction and display tests**

**Coverage:**
- ✅ Mobile: Card view with priority-based field display
- ✅ Tablet: Horizontal scroll table with visible columns
- ✅ Desktop: Full table with all columns and features
- ✅ Column priority system (high, medium, low)
- ✅ Virtual scrolling for large datasets
- ✅ Sorting, filtering, and pagination
- ✅ Row selection and interaction

**Test Scenarios:**
- Display strategy switching (table → cards → table)
- Column visibility based on priority and breakpoint
- Touch interactions vs mouse interactions
- Performance with large datasets (100-1000+ records)
- Accessibility (ARIA labels, keyboard navigation)

### 4. ResponsiveModalLayout.test.js
**Modal sizing and layout behavior tests**

**Coverage:**
- ✅ ResponsiveModal: Full-screen mobile, lg tablet, xl desktop
- ✅ ResponsiveSelect: Touch targets, searchability, option limits
- ✅ Medical form integration (complexity-based sizing)
- ✅ Focus management and accessibility

**Test Scenarios:**
- Modal size adaptation based on form complexity
- Scroll behavior (native vs custom scrollbars)
- Touch vs keyboard navigation
- Medical context enhancements
- Emergency form prioritization

### 5. PerformanceTests.test.js
**Breakpoint transition and rendering performance**

**Coverage:**
- ✅ Breakpoint transitions <100ms
- ✅ Component render performance benchmarks
- ✅ Memory management and cleanup
- ✅ Virtual scrolling efficiency
- ✅ Concurrent component rendering

**Performance Targets:**
- Breakpoint transitions: <100ms
- Large dataset rendering: <500ms
- Form interactions: <50ms per interaction
- Memory usage: Stable across component lifecycle

### 6. IntegrationWorkflows.test.js
**End-to-end user workflow tests**

**Coverage:**
- ✅ Complete medication management workflow
- ✅ Multi-form switching (medication → allergy → condition)
- ✅ Cross-device workflow continuity
- ✅ Complex data filtering and searching
- ✅ Performance under load

**Workflow Scenarios:**
- Add/Edit/Delete medical records
- Form validation and error handling
- Data persistence across sessions
- Search and filter operations
- Multi-step form processes

## Breakpoint Coverage

All tests cover the full responsive breakpoint spectrum:

| Breakpoint | Width Range | Device Type | Primary Features |
|-----------|-------------|-------------|------------------|
| xs | 0-575px | Mobile | Cards, full-screen modals, large touch targets |
| sm | 576-767px | Mobile | Cards, improved spacing |
| md | 768-1023px | Tablet | Table + horizontal scroll, lg modals |
| lg | 1024-1279px | Desktop | Full table, xl modals, all columns |
| xl | 1280px+ | Desktop | Comprehensive layout, advanced features |

## Running Tests

### Run All Responsive Tests
```bash
npm test -- --testPathPattern="responsive"
```

### Run Specific Test Suites
```bash
# Form submission tests only
npm test -- --testPathPattern="MedicalFormSubmission"

# Table interaction tests only
npm test -- --testPathPattern="ResponsiveTable"

# Performance tests only
npm test -- --testPathPattern="PerformanceTests"

# Integration workflow tests only
npm test -- --testPathPattern="IntegrationWorkflows"
```

### Run Tests with Coverage
```bash
npm test -- --testPathPattern="responsive" --coverage
```

### Run Tests in Watch Mode
```bash
npm test -- --testPathPattern="responsive" --watch
```

## Performance Benchmarks

### Target Performance Metrics

**Render Performance:**
- Small forms (≤5 fields): <50ms
- Medium forms (6-15 fields): <100ms
- Large forms (16+ fields): <200ms
- Tables (≤100 rows): <100ms
- Tables (101-500 rows): <300ms
- Tables (500+ rows): <500ms with virtualization

**Breakpoint Transitions:**
- All transitions: <100ms
- Mobile ↔ Desktop: <75ms
- Consecutive transitions: <50ms average

**Memory Usage:**
- Component mount/unmount cycles: Stable heap size
- Large dataset handling: <10MB increase
- Event listener cleanup: 100% cleanup rate

## Test Data

### Medical Test Data Examples
```javascript
// Medication data
{
  medication_name: 'Lisinopril',
  dosage: '10mg',
  frequency: 'Once daily',
  prescribing_practitioner: 'Dr. Smith',
  start_date: '2024-01-15',
  status: 'Active'
}

// Allergy data
{
  allergen: 'Penicillin',
  reaction_type: 'Skin rash',
  severity: 'Moderate',
  notes: 'Developed rash within 2 hours'
}
```

## Common Test Patterns

### Testing Across All Breakpoints
```javascript
testAtAllBreakpoints(
  <MyResponsiveComponent />,
  (breakpoint, viewport) => {
    it(`works at ${breakpoint}`, () => {
      // Test logic here
    });
  }
);
```

### Performance Testing
```javascript
const { duration } = await measureAsyncRender(async () => {
  const { unmount } = renderResponsive(<Component />);
  return unmount;
});

expect(duration).toBeLessThan(100);
```

### Form Submission Testing
```javascript
await simulateFormSubmission({
  medication_name: 'Test Med',
  dosage: '10mg'
}, 'Save');

expect(mockOnSubmit).toHaveBeenCalledWith(
  expect.objectContaining({
    medication_name: 'Test Med'
  })
);
```

## Debugging Test Failures

### Breakpoint Issues
- Check `mockViewport()` calls are setting correct dimensions
- Verify `useResponsive` mock returns expected values
- Ensure components respond to responsive context changes

### Performance Issues
- Use `measureRenderPerformance()` to identify slow components
- Check for memory leaks with component mount/unmount cycles
- Profile large dataset rendering with browser dev tools

### Form Validation Issues
- Verify field names match between form and test
- Check async validation timing with `waitFor()`
- Ensure error states are properly triggered

## Contributing

When adding new responsive components or features:

1. **Add responsive test utilities** if needed in `ResponsiveTestUtils.js`
2. **Create comprehensive tests** covering all breakpoints
3. **Include performance benchmarks** for new components
4. **Test integration workflows** that include the new features
5. **Update this documentation** with new test patterns or data

## Test Quality Standards

- **100% breakpoint coverage** - Test at xs, sm, md, lg, xl
- **Performance benchmarks** - All components must meet timing targets
- **Accessibility testing** - ARIA labels, keyboard navigation, screen readers
- **Error handling** - Test validation, API errors, edge cases
- **Data integrity** - Verify data persistence across interactions
- **Integration scenarios** - Test complete user workflows

## Related Files

- `frontend/src/components/adapters/ResponsiveTable.js`
- `frontend/src/components/adapters/ResponsiveModal.js` 
- `frontend/src/components/adapters/ResponsiveSelect.js`
- `frontend/src/components/medical/Mantine*Form.js`
- `frontend/src/hooks/useResponsive.js`
- `frontend/src/strategies/MedicalFormLayoutStrategy.js`
- `frontend/src/strategies/TableLayoutStrategy.js`