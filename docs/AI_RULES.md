# 🧠 ObsessLess AI Integration Rules

This document outlines the core technical stack and strict guidelines for library usage within the ObsessLess application, especially pertinent for any future AI integration. Adherence to these rules is critical for maintaining stability, performance, and consistency.

## 🛠️ Tech Stack Overview

ObsessLess is built on a modern, mobile-first stack designed for performance and a calm user experience.

*   **Framework**: React Native with Expo SDK 51
*   **Language**: TypeScript 5.1.3
*   **Backend & Authentication**: Supabase (PostgreSQL, Auth, Row Level Security)
*   **State Management**: Zustand for local state, React Query for server-side state caching and synchronization
*   **Navigation**: Expo Router (file-based routing)
*   **Local Storage**: `@react-native-async-storage/async-storage` for offline-first capabilities
*   **Animations**: `react-native-reanimated` for fluid UI animations, `lottie-react-native` for complex animations
*   **UI Components**: Primarily custom-built components following the Master Prompt's design principles
*   **Icons**: `@expo/vector-icons` (specifically MaterialCommunityIcons)
*   **Haptic Feedback**: `expo-haptics` for tactile user interactions
*   **Charting**: `react-native-chart-kit` for data visualization, relying on `react-native-svg`
*   **Localization**: Custom translation logic leveraging `expo-localization` for language detection

## 📚 Library Usage Guidelines

To ensure consistency, maintainability, and adherence to the "Sakinlik, Güç, Zahmetsizlik" (Calmness, Empowerment, Effortlessness) principles, the following rules apply to library usage:

*   **UI Components**:
    *   **Prioritize Custom Components**: Always prefer using or creating custom components that align with the ObsessLess design system (minimalist, calm, large touch targets).
    *   **Avoid `react-native-paper`**: This library has been explicitly removed. Do NOT reintroduce it or similar heavy UI libraries.
    *   **Shadcn/ui**: While available, use prebuilt components from `shadcn/ui` only if they perfectly fit the design without modification. If customization is needed, create a new custom component instead of modifying `shadcn/ui` files.
*   **State Management**:
    *   **Zustand**: Use Zustand for all local, client-side state management (e.g., onboarding flow, ERP session active state).
    *   **React Query (`@tanstack/react-query`)**: Use React Query for managing server state, data fetching, caching, and synchronization with Supabase.
*   **Authentication**:
    *   **Supabase (`@supabase/supabase-js`)**: This is the sole authentication and database interaction library. All user authentication (email/password, Google OAuth) and data persistence must go through `supabaseService`.
    *   **`expo-web-browser`**: Use this for handling external OAuth flows (e.g., Google Sign-In redirects).
*   **Local Data Storage**:
    *   **`@react-native-async-storage/async-storage`**: This is the primary local storage solution for offline-first capabilities and user preferences. Ensure user-specific keys are always used (`StorageKeys` utility).
*   **Navigation**:
    *   **Expo Router**: All routing and navigation must be handled exclusively by Expo Router. Do NOT introduce other navigation libraries.
*   **Animations**:
    *   **`react-native-reanimated`**: Use for all declarative, performant UI animations.
    *   **`lottie-react-native`**: Use for complex, pre-designed animations (e.g., confetti).
*   **Icons**:
    *   **`@expo/vector-icons` (MaterialCommunityIcons)**: Use this package for all icons. Ensure icons align with the calm and empathetic design.
*   **Haptic Feedback**:
    *   **`expo-haptics`**: Integrate `expo-haptics` for all tactile feedback, adhering to the "Light impact" principle for most interactions.
*   **Charting**:
    *   **`react-native-chart-kit`**: Use for displaying charts and graphs.
    *   **`react-native-svg`**: This is a dependency of `react-native-chart-kit` and should be used for any custom SVG rendering.
*   **Localization**:
    *   **Custom Logic with JSON files**: The app uses a custom `LanguageContext` and JSON files (`tr.json`, `en.json`) for translations. Continue this approach.
    *   **`expo-localization`**: Use for detecting the user's system language.
*   **General**:
    *   **No Unnecessary Dependencies**: Avoid adding new npm packages unless absolutely necessary and after careful consideration of their impact on bundle size, performance, and maintainability.
    *   **Security**: Always prioritize secure coding practices, especially when handling user data and API interactions.
    *   **Performance**: Keep components lean and optimize for smooth 60 FPS performance on mobile devices.