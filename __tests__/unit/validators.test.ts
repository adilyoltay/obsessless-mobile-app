import { isValidEmail } from '@/utils/validators';

describe('isValidEmail', () => {
  it('returns true for valid addresses', () => {
    const validSamples = [
      'user@example.com',
      'user.name+tag@sub.domain.org',
      "o'reilly@books.ie",
      'UPPER.CASE@DOMAIN.CO',
      ' spaced@trimmed.com ',
    ];

    validSamples.forEach((sample) => {
      expect(isValidEmail(sample)).toBe(true);
    });
  });

  it('returns false for invalid addresses', () => {
    const invalidSamples = [
      '',
      'no-at-symbol',
      'missing-domain@',
      '@missing-local-part.com',
      'double@@example.com',
      'emoji🙂@example.com',
      'user@domain',
      'user@domain..com',
      'user domain@example.com',
    ];

    invalidSamples.forEach((sample) => {
      expect(isValidEmail(sample)).toBe(false);
    });
  });
});
