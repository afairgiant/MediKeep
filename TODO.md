# TODO

## List of Bugs

### Treatments Page

- Dosage is not being displayed correctly
- Dosage is not updating correctly
- Treatment description is not being displayed correctly

### Procedure Page

- ✅ Make procedure type more visible on card
- ✅ Remove emojis from card

### Vitals Page

- The filter sorting is broken

## Improvements

### URL Routing & Navigation

- ✅ Add query parameter support for direct linking to specific items (implemented for Treatments, Conditions, Procedures, Medications, Allergies)
- ✅ Implement URL routing for remaining medical pages (immunizations, vitals, visits, lab results, emergency contacts) - **Note: These pages don't have view modals implemented yet**
- ✅ Add view modals to remaining medical pages (immunizations, vitals, visits, lab results, emergency contacts) before implementing URL routing
- Upgrade to route parameters for cleaner URLs (e.g., `/treatments/123` instead of `/treatments?view=123`)

### User

- Make it so only 1 session per user can be active at a time

### Conditions

- ✅ Add end date to condition

### Visits

- ✅ Enhanced with additional fields: visit_type, chief_complaint, diagnosis, treatment_plan, follow_up_instructions, duration_minutes, location, priority

### Patient Page

- Don't need to show the patient ID on the patient page
- Make the weight in patient page linked to the vitals page for the latest weight

### Nav Bar

- ✅ Add links to all the pages in the nav bar
- ✅ Shift the title over to the left to make room for links

### Admin

- User: Make more user info show up on the user page
- Make the search bar at the top work
- Implement search functionality for admin pages (temporarily removed non-functional search bar)
- Make the mobile version of the pages work better with the header

## Roadmap

### Core Features

- Family member linking of patients
- ✅ Emergency Contacts
- Document attachments
- User roles (parent/guardian) - goes with family member linking
- Add units to settings page: lb/kg and cm/inches per user
- Condition - medication linking (1 or multiple medications per condition)

### Data & Validation

- Data integrity protections
- Unify form validations (phone, email, dates, etc.)

### Additional Features

- Insurance tracking of some form (documents)
- More document support for procedures, conditions, visits, etc.
