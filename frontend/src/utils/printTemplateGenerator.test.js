import { generateInsurancePrint } from './printTemplateGenerator';

describe('generateInsurancePrint - tags', () => {
  const baseInsurance = {
    id: 1,
    insurance_type: 'medical',
    company_name: 'Acme Health',
    member_name: 'Jane Doe',
    member_id: 'M12345',
    group_number: 'GRP-001',
    effective_date: '2024-01-01',
    status: 'active',
  };

  const formatDate = date => date;

  test('includes a Tags section with the joined tag list when tags are set', () => {
    const html = generateInsurancePrint(
      { ...baseInsurance, tags: ['hsa', 'family-plan'] },
      formatDate
    );

    expect(html).toContain('Tags');
    expect(html).toContain('hsa, family-plan');
  });

  test('omits the Tags section when tags is empty', () => {
    const html = generateInsurancePrint(
      { ...baseInsurance, tags: [] },
      formatDate
    );

    expect(html).not.toContain('>Tags<');
  });

  test('omits the Tags section when tags is absent', () => {
    const html = generateInsurancePrint(
      { ...baseInsurance, tags: undefined },
      formatDate
    );

    expect(html).not.toContain('>Tags<');
  });
});
