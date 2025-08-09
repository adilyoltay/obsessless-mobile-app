import { AIMessage, ConversationContext } from '@/features/ai/types';

export interface SanitizationResult {
  sanitizedMessages: AIMessage[];
  sanitizedContext: ConversationContext;
  piiDetected: boolean;
}

/**
 * PII'yi sanitize et - CRITICAL SECURITY FUNCTION
 */
export function sanitizeSensitiveData(
  messages: AIMessage[],
  context: ConversationContext
): SanitizationResult {
  const piiPatterns = {
    // Email patterns
    email: /\b[\w\.-]+@[\w\.-]+\.\w+\b/gi,
    // Phone patterns (Turkish and international)
    phone: /(\+90|0)?[\s\-\.]?5\d{2}[\s\-\.]?\d{3}[\s\-\.]?\d{2}[\s\-\.]?\d{2}|\b\d{10,}\b/gi,
    // Turkish ID numbers (11 digits)
    turkishId: /\b\d{11}\b/gi,
    // Names (basic pattern - capital letters followed by lowercase)
    names: /\b[A-ZÇĞİÖŞÜ][a-zçğıöşü]+\s[A-ZÇĞİÖŞÜ][a-zçğıöşü]+\b/gi,
    // Credit card patterns
    creditCard: /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/gi,
    // Address patterns (street names with numbers)
    address: /\b\d+\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+\s+(Cd|Sk|St|Street|Caddesi|Sokağı)\b/gi,
    // Date of birth patterns
    dateOfBirth: /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/gi
  } as const;

  let piiDetected = false;

  // Sanitize messages
  const sanitizedMessages = messages.map(message => {
    let sanitizedContent = message.content;

    // Apply PII patterns
    for (const [type, pattern] of Object.entries(piiPatterns)) {
      const matches = sanitizedContent.match(pattern);
      if (matches) {
        piiDetected = true;
        console.warn(`🔒 PII detected and sanitized: ${type} (${matches.length} instances)`);

        switch (type) {
          case 'email':
            sanitizedContent = sanitizedContent.replace(pattern, '[EMAIL]');
            break;
          case 'phone':
            sanitizedContent = sanitizedContent.replace(pattern, '[PHONE]');
            break;
          case 'turkishId':
            sanitizedContent = sanitizedContent.replace(pattern, '[ID_NUMBER]');
            break;
          case 'names':
            sanitizedContent = sanitizedContent.replace(pattern, '[NAME]');
            break;
          case 'creditCard':
            sanitizedContent = sanitizedContent.replace(pattern, '[CREDIT_CARD]');
            break;
          case 'address':
            sanitizedContent = sanitizedContent.replace(pattern, '[ADDRESS]');
            break;
          case 'dateOfBirth':
            sanitizedContent = sanitizedContent.replace(pattern, '[DATE]');
            break;
        }
      }
    }

    return {
      ...message,
      content: sanitizedContent
    };
  });

  // Sanitize context (remove sensitive metadata)
  const sanitizedContext: ConversationContext = {
    ...context,
    // Remove potentially sensitive fields
    userMetadata: context.userMetadata
      ? {
          ...context.userMetadata,
          email: undefined,
          phone: undefined,
          fullName: undefined,
          realName: undefined
        }
      : undefined,

    // Keep therapeutic context but sanitize personal details
    therapeuticProfile: context.therapeuticProfile
      ? {
          ...context.therapeuticProfile,
          personalDetails: undefined, // Remove personal details
          contactInfo: undefined, // Remove contact info
          emergencyContacts: undefined // Remove emergency contacts
        }
      : undefined
  };

  return {
    sanitizedMessages,
    sanitizedContext,
    piiDetected
  };
}

