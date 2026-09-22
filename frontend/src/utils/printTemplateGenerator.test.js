import {
  generateInsurancePrint,
  generateFieldGridSection,
  escapeHtml,
} from './printTemplateGenerator';

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

describe('generateInsurancePrint - tags', () => {
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

describe('escapeHtml', () => {
  test('escapes all HTML-significant characters, & first', () => {
    expect(escapeHtml(`<script>alert("hi") & 'bye'</script>`)).toBe(
      '&lt;script&gt;alert(&quot;hi&quot;) &amp; &#39;bye&#39;&lt;/script&gt;'
    );
  });

  test('coerces non-string values before escaping', () => {
    expect(escapeHtml(12345)).toBe('12345');
    expect(escapeHtml(null)).toBe('null');
  });

  test('leaves plain text untouched', () => {
    expect(escapeHtml('hsa, family-plan')).toBe('hsa, family-plan');
  });
});

describe('generateFieldGridSection - output escaping (shared print boundary)', () => {
  test('escapes a malicious field value rather than emitting it as raw markup', () => {
    const html = generateFieldGridSection('Section', {
      Field: '<img src=x onerror=alert(1)>',
    });

    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  test('escapes a malicious field label (object key), not just the value', () => {
    // coverage_details/contact_info are untyped on the backend, so an
    // attacker-controlled key can reach here too, not just a value.
    // formatFieldLabel title-cases unmapped keys word-by-word (its own
    // pre-existing behavior, unrelated to escaping), so "script"/"alert"
    // come out capitalized - the point here is only that the angle
    // brackets never survive unescaped.
    const html = generateFieldGridSection('Section', {
      '<script>alert(1)</script>': 'benign value',
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;Script&gt;Alert(1)&lt;/Script&gt;');
  });
});

describe('generateInsurancePrint - output escaping applies beyond tags', () => {
  test('escapes a malicious tag value end-to-end', () => {
    const html = generateInsurancePrint(
      { ...baseInsurance, tags: ['<script>alert(1)</script>'] },
      formatDate
    );

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  test('escapes a malicious value in a regular free-text field (member_name), confirming the fix is not tags-only', () => {
    const html = generateInsurancePrint(
      {
        ...baseInsurance,
        member_name: '<img src=x onerror=alert(1)>',
      },
      formatDate
    );

    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  test('escapes a malicious value coming through coverage_details (untyped Dict[str, Any] on the backend)', () => {
    // bin_number matches none of formatFieldValue's currency/percentage/
    // date/boolean patterns, so it passes through as a raw string rather
    // than getting coerced by a formatter (e.g. a currency-pattern field
    // name like deductible_individual would turn this payload into "$NaN"
    // via Intl.NumberFormat's NaN coercion, before escaping is even
    // relevant) - this test isolates the escaping step itself.
    const html = generateInsurancePrint(
      {
        ...baseInsurance,
        insurance_type: 'prescription',
        coverage_details: {
          bin_number: '<script>alert(1)</script>',
        },
      },
      formatDate
    );

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
