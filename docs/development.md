# Development Guide

Kurulum:
- Node 18+, Yarn
- Expo CLI, Xcode/Android Studio
- Supabase URL/Anon Key

Env (örnek):
- EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
- EXPO_PUBLIC_ENABLE_AI, EXPO_PUBLIC_ENABLE_AI_CHAT (opsiyonel)
- EXPO_PUBLIC_API_URL (opsiyonel)

Komutlar:
- `yarn install`, `yarn typecheck`, `yarn lint`, `yarn test`
- iOS: `cd ios && pod install && cd .. && yarn ios`
- Android: `yarn android`

Klasörler:
- features/, services/, store/, hooks/, app/(tabs), supabase/migrations
