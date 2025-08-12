export function sanitizePII(input: string): string {
  if (!input || typeof input !== 'string') return input;
  let text = input;
  // Mask emails
  text = text.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]');
  // Mask phone numbers (simple patterns)
  text = text.replace(/\+?\d[\d\s().-]{7,}\d/g, '[phone]');
  // Mask long digit sequences
  text = text.replace(/\d{6,}/g, '[digits]');
  // Collapse spaces
  text = text.replace(/\s{2,}/g, ' ').trim();
  return text;
}
