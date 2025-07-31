import AsyncStorage from '@react-native-async-storage/async-storage';

export interface User {
  uid: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string;
  hashedPassword: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string;
}

const USERS_STORAGE_KEY = 'simple_auth_users';
const CURRENT_USER_KEY = 'simple_auth_current_user';

// Simple password hashing (in production, use proper encryption)
const hashPassword = (password: string): string => {
  // This is a very basic hash - in production, use bcrypt or similar
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
};

// Generate UID
const generateUID = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Validate email format
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate password strength
const isValidPassword = (password: string): boolean => {
  return password.length >= 6;
};

class SimpleAuthService {
  // Get all users from storage
  private async getUsers(): Promise<User[]> {
    try {
      const usersJson = await AsyncStorage.getItem(USERS_STORAGE_KEY);
      return usersJson ? JSON.parse(usersJson) : [];
    } catch (error) {
      console.error('Error getting users:', error);
      return [];
    }
  }

  // Save users to storage
  private async saveUsers(users: User[]): Promise<void> {
    try {
      await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch (error) {
      console.error('Error saving users:', error);
      throw new Error('Kullanıcı bilgileri kaydedilemedi');
    }
  }

  // Sign up new user
  async signUp(email: string, password: string, name: string): Promise<UserProfile> {
    try {
      // Validate inputs
      if (!email || !password || !name) {
        throw new Error('Tüm alanlar zorunludur');
      }

      if (!isValidEmail(email)) {
        throw new Error('Geçersiz e-posta adresi');
      }

      if (!isValidPassword(password)) {
        throw new Error('Şifre en az 6 karakter olmalı');
      }

      // Check if user already exists
      const existingUsers = await this.getUsers();
      const existingUser = existingUsers.find(user => user.email.toLowerCase() === email.toLowerCase());
      
      if (existingUser) {
        throw new Error('Bu e-posta adresi zaten kullanımda');
      }

      // Create new user
      const newUser: User = {
        uid: generateUID(),
        email: email.toLowerCase(),
        name: name.trim(),
        emailVerified: true, // For simplicity, we'll mark as verified
        createdAt: new Date().toISOString(),
        hashedPassword: hashPassword(password)
      };

      // Add to users list
      existingUsers.push(newUser);
      await this.saveUsers(existingUsers);

      // Return user profile (without password)
      const { hashedPassword, ...userProfile } = newUser;
      return userProfile;
    } catch (error: any) {
      throw new Error(error.message || 'Kayıt olurken bir hata oluştu');
    }
  }

  // Sign in user
  async signIn(email: string, password: string): Promise<UserProfile> {
    try {
      // Validate inputs
      if (!email || !password) {
        throw new Error('E-posta ve şifre zorunludur');
      }

      if (!isValidEmail(email)) {
        throw new Error('Geçersiz e-posta adresi');
      }

      // Find user
      const users = await this.getUsers();
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

      if (!user) {
        throw new Error('Kullanıcı bulunamadı');
      }

      // Check password
      if (user.hashedPassword !== hashPassword(password)) {
        throw new Error('Yanlış şifre');
      }

      // Save current user
      const { hashedPassword, ...userProfile } = user;
      await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userProfile));

      return userProfile;
    } catch (error: any) {
      throw new Error(error.message || 'Giriş yapılamadı');
    }
  }

  // Get current user
  async getCurrentUser(): Promise<UserProfile | null> {
    try {
      const userJson = await AsyncStorage.getItem(CURRENT_USER_KEY);
      return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  // Sign out
  async signOut(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CURRENT_USER_KEY);
    } catch (error) {
      console.error('Error signing out:', error);
      throw new Error('Çıkış yapılamadı');
    }
  }

  // Update user profile
  async updateProfile(uid: string, updates: Partial<Pick<UserProfile, 'name' | 'email'>>): Promise<UserProfile> {
    try {
      const users = await this.getUsers();
      const userIndex = users.findIndex(u => u.uid === uid);

      if (userIndex === -1) {
        throw new Error('Kullanıcı bulunamadı');
      }

      // Update user
      const updatedUser = { ...users[userIndex], ...updates };
      users[userIndex] = updatedUser;
      
      await this.saveUsers(users);

      // Update current user if it's the same user
      const currentUser = await this.getCurrentUser();
      if (currentUser && currentUser.uid === uid) {
        const { hashedPassword, ...userProfile } = updatedUser;
        await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userProfile));
        return userProfile;
      }

      const { hashedPassword, ...userProfile } = updatedUser;
      return userProfile;
    } catch (error: any) {
      throw new Error(error.message || 'Profil güncellenemedi');
    }
  }

  // Change password
  async changePassword(email: string, oldPassword: string, newPassword: string): Promise<void> {
    try {
      if (!isValidPassword(newPassword)) {
        throw new Error('Yeni şifre en az 6 karakter olmalı');
      }

      const users = await this.getUsers();
      const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());

      if (userIndex === -1) {
        throw new Error('Kullanıcı bulunamadı');
      }

      // Check old password
      if (users[userIndex].hashedPassword !== hashPassword(oldPassword)) {
        throw new Error('Mevcut şifre yanlış');
      }

      // Update password
      users[userIndex].hashedPassword = hashPassword(newPassword);
      await this.saveUsers(users);
    } catch (error: any) {
      throw new Error(error.message || 'Şifre değiştirilemedi');
    }
  }

  // Delete account
  async deleteAccount(email: string, password: string): Promise<void> {
    try {
      const users = await this.getUsers();
      const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());

      if (userIndex === -1) {
        throw new Error('Kullanıcı bulunamadı');
      }

      // Check password
      if (users[userIndex].hashedPassword !== hashPassword(password)) {
        throw new Error('Yanlış şifre');
      }

      // Remove user
      users.splice(userIndex, 1);
      await this.saveUsers(users);

      // Sign out if it was the current user
      const currentUser = await this.getCurrentUser();
      if (currentUser && currentUser.email.toLowerCase() === email.toLowerCase()) {
        await this.signOut();
      }
    } catch (error: any) {
      throw new Error(error.message || 'Hesap silinemedi');
    }
  }

  // Check if user exists
  async userExists(email: string): Promise<boolean> {
    try {
      const users = await this.getUsers();
      return users.some(u => u.email.toLowerCase() === email.toLowerCase());
    } catch (error) {
      return false;
    }
  }
}

export const simpleAuthService = new SimpleAuthService(); 