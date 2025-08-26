# Security & Privacy

ObsessLess uygulaması, kullanıcı verilerini korumak için kapsamlı güvenlik ve gizlilik önlemleri uygular. Privacy-First prensibimiz gereği, hassas veriler hiçbir zaman düz metin olarak saklanmaz.

## Privacy-First Architecture

### Core Principles
1. **Data Minimization**: Yalnızca gerekli veriler toplanır
2. **Local Processing**: Hassas analizler mümkün olduğunca cihaz üzerinde yapılır
3. **Encryption by Default**: Tüm hassas veriler şifrelenerek saklanır
4. **User Consent**: Her veri işlemi için açık kullanıcı onayı alınır
5. **Right to Delete**: Kullanıcı verilerini tamamen silebilir

### Data Classification
```typescript
enum DataSensitivity {
  PUBLIC = 'public',        // App preferences, UI settings
  INTERNAL = 'internal',    // User ID, session tokens
  SENSITIVE = 'sensitive',  // Mood data, voice recordings
  CRITICAL = 'critical'     // Personal profile, medical info
}
```

## Encryption & Secure Storage

### AES-GCM Encryption
**File**: `services/encryption/secureDataService.ts`

```typescript
// React Native (Expo/Hermes) uyumlu AES-256-GCM
import 'react-native-get-random-values';
const { createCipheriv, createDecipheriv, randomBytes, Buffer } = require('react-native-quick-crypto');

const iv = randomBytes(12); // 96-bit IV
const cipher = createCipheriv('aes-256-gcm', key, iv);
const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
const tag = cipher.getAuthTag();
// Depolamada: base64(ct || ct+tag)
```

**Configuration**:
- **Algorithm**: AES-256-GCM (auth tag dahil)
- **IV Length**: 96-bit
- **Key Size**: 256-bit

Fallback: AES-GCM desteklenmeyen runtime’larda sadece non‑secret telemetry hash’leri için `SHA256_FALLBACK` kullanılır.

### Secure Storage Keys
```typescript
const SECURE_STORAGE_KEYS = {
  // Onboarding data (encrypted)
  PROFILE_V2: 'profile_v2_encrypted',
  
  // Legacy support (encrypted migration)
  ONB_V1_PAYLOAD: 'onb_v1_payload_encrypted',
  
  // AI context cache (encrypted)
  AI_CONTEXT_CACHE: 'ai_context_cache_encrypted',
  
  // Voice recordings (encrypted + temporary)
  VOICE_TEMP: 'voice_temp_encrypted'
};
```

## PII Sanitization

### Client-Side Sanitization
```typescript
class PIISanitizer {
  sanitizeForServer(data: any): any {
    return {
      ...data,
      // Email masking: user@domain.com → u***@***.com
      email: this.maskEmail(data.email),
      
      // Phone masking: +90532123456 → +90***123***
      phone: this.maskPhone(data.phone),
      
      // Free text filtering
      notes: this.filterSensitiveText(data.notes)
    };
  }
  
  private filterSensitiveText(text?: string): string | undefined {
    if (!text) return text;
    
    return text
      .replace(/\b[\w._%+-]+@[\w.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      .replace(/\b\d{10,11}\b/g, '[PHONE]')
      .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]');
  }
}
```

### Telemetry Sanitization
- Meta alanları minimize edilir
- Kullanıcı ID'leri hash'lenir
- IP adresleri anonymize edilir
- Hassas içerik filtrelenir

## Database Security

### Row Level Security (RLS)
Tüm Supabase tablolarında RLS aktif ve kullanıcı tabanlı politikalar.

```sql
-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_profiles ENABLE ROW LEVEL SECURITY;

-- User isolation policies
CREATE POLICY "Users can only access their own data" ON user_profiles
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own mood entries" ON mood_entries
  FOR ALL USING (auth.uid() = user_id);
```

### Connection Security
- HTTPS only connections
- Certificate pinning (future enhancement)
- API versioning headers
- Request/response validation

## Authentication Security

### Supabase Auth Configuration
```typescript
const authConfig = {
  // Password requirements
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true
  },
  
  // Session settings
  session: {
    refreshThreshold: 60, // Refresh 1 minute before expiry
    autoRefresh: true,
    persistSession: true
  }
};
```

### Session Management
- Automatic session refresh
- Secure logout (clear all encrypted data)
- Token validation
- Session timeout handling

## Audit & Logging

### Security Event Tracking
```typescript
const trackSecurityEvent = (event: string, metadata?: any) => {
  const sanitizedMetadata = {
    ...metadata,
    userId: metadata?.userId ? hashUserId(metadata.userId) : undefined,
    timestamp: Date.now(),
    appVersion: APP_VERSION
  };
  
  // Remove sensitive data
  delete sanitizedMetadata.email;
  delete sanitizedMetadata.phone;
  
  secureLogger.log({
    level: 'security',
    event,
    metadata: sanitizedMetadata
  });
};
```

**Tracked Events:**
- Authentication events
- Data access patterns
- Encryption key operations
- Suspicious activities

## Data Retention & Deletion

### Retention Policies
```typescript
const DATA_RETENTION_POLICIES = {
  user_profiles: {
    retention: 'indefinite', // Until user deletion
    autoCleanup: false
  },
  
  mood_entries: {
    retention: '2_years',
    autoCleanup: true,
    archiveAfter: '1_year'
  },
  
  voice_recordings: {
    retention: '30_days',
    autoCleanup: true,
    immediateDelete: true // Delete after processing
  }
};
```

### User Data Deletion
Complete data removal on user request:
1. Delete from all Supabase tables
2. Clear local encrypted data
3. Clear cached data
4. Anonymize audit entries
5. Log deletion for compliance

## Compliance

### GDPR Compliance
- **Lawful Basis**: User consent for all processing
- **Data Minimization**: Only necessary data collected
- **Right to Access**: Users can export their data
- **Right to Erasure**: Complete data deletion
- **Privacy by Design**: Security built into architecture

### Security Best Practices
1. **Never Log Sensitive Data**: PII, passwords, tokens
2. **Validate All Inputs**: Server and client-side validation
3. **Encrypt at Rest**: All sensitive local data
4. **Use HTTPS Only**: All API communications
5. **Minimize Permissions**: Request only necessary permissions

## Local Snapshot Anahtarları

Current encrypted storage keys:
- **`profile_v2`**: Onboarding v2 payload snapshot
- **`onb_v1_payload`**: Legacy key for adapter fallback
- **`ai_context_cache`**: AI context cache
- **`mood_entries_cache`**: Cached mood data

## Incident Response

### Security Incident Procedure
1. **Detection & Assessment** (< 1 hour)
2. **Containment** (< 4 hours) 
3. **Investigation** (< 24 hours)
4. **Recovery** (< 48 hours)
5. **Communication** (< 72 hours)

### Classification Levels
- **LOW**: Minor exposure, no user impact
- **MEDIUM**: Limited exposure, some users affected
- **HIGH**: Significant exposure, many users affected
- **CRITICAL**: Major breach, all users potentially affected

## İlgili Bölümler

- [**Data Model**](./data-model.md) – RLS policies and table security
- [**Architecture**](./architecture.md) – Security architecture overview  
- [**Development**](./development.md) – Secure development practices
- [**Troubleshooting**](./troubleshooting.md) – Security-related issue resolution