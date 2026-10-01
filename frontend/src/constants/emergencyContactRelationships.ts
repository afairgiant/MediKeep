/**
 * Emergency contact relationship values.
 * Must match the valid_relationships list in app/schemas/emergency_contact.py.
 * Display labels live in medical:emergencyContacts.form.relationship.options.
 */
export const EMERGENCY_CONTACT_RELATIONSHIPS = [
  'spouse',
  'partner',
  'parent',
  'mother',
  'father',
  'child',
  'son',
  'daughter',
  'sibling',
  'brother',
  'sister',
  'grandparent',
  'grandmother',
  'grandfather',
  'grandchild',
  'grandson',
  'granddaughter',
  'aunt',
  'uncle',
  'cousin',
  'friend',
  'neighbor',
  'caregiver',
  'guardian',
  'other',
] as const;

export type EmergencyContactRelationship =
  (typeof EMERGENCY_CONTACT_RELATIONSHIPS)[number];
