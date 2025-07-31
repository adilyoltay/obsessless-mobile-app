import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MinimalTestScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [testText, setTestText] = useState('');

  const handleButtonPress = () => {
    Alert.alert('SUCCESS!', `Email: ${email}\nPassword: ${password}\nTest: ${testText}`);
    console.log('✅ MINIMAL BUTTON PRESSED!', { email, password, testText });
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    console.log('📧 Email changed:', text);
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    console.log('🔒 Password changed:', text);
  };

  const handleTestChange = (text: string) => {
    setTestText(text);
    console.log('📝 Test changed:', text);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <Text style={styles.title}>MİNİMAL TEST</Text>
            <Text style={styles.subtitle}>Native React Native Components</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email:</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={handleEmailChange}
                placeholder="test@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password:</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={handlePasswordChange}
                placeholder="password"
                secureTextEntry
                returnKeyType="next"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Test Field:</Text>
              <TextInput
                style={styles.input}
                value={testText}
                onChangeText={handleTestChange}
                placeholder="type anything..."
                returnKeyType="done"
              />
            </View>

            <TouchableOpacity 
              style={styles.button}
              onPress={handleButtonPress}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText}>
                TEST BUTTON
              </Text>
            </TouchableOpacity>

            <View style={styles.status}>
              <Text style={styles.statusText}>
                Email: {email || '(empty)'}
              </Text>
              <Text style={styles.statusText}>
                Password: {password || '(empty)'}
              </Text>
              <Text style={styles.statusText}>
                Test: {testText || '(empty)'}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#10B981',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    marginBottom: 30,
    opacity: 0.8,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    color: 'white',
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  button: {
    backgroundColor: '#059669',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  status: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    borderRadius: 8,
  },
  statusText: {
    color: 'white',
    fontSize: 14,
    marginBottom: 4,
  },
}); 