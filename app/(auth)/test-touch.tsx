import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TestTouchScreen() {
  const [text, setText] = useState('');
  const [buttonPressed, setButtonPressed] = useState(0);

  const handleButtonPress = () => {
    setButtonPressed(prev => prev + 1);
    Alert.alert('Button Çalışıyor!', `${buttonPressed + 1} kez tıklandı`);
  };

  const handleTextChange = (newText: string) => {
    setText(newText);
    console.log('Text Input Çalışıyor:', newText);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>TOUCH EVENT TESTİ</Text>
        
        <Text style={styles.label}>Button Test:</Text>
        <TouchableOpacity 
          style={styles.button} 
          onPress={handleButtonPress}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>
            Tıkla! ({buttonPressed} kez tıklandı)
          </Text>
        </TouchableOpacity>

        <Text style={styles.label}>Input Test:</Text>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={handleTextChange}
          placeholder="Buraya yazın..."
          placeholderTextColor="#999"
        />
        
        <Text style={styles.result}>
          Girilen Metin: "{text}"
        </Text>

        <TouchableOpacity 
          style={[styles.button, styles.redButton]} 
          onPress={() => Alert.alert('BAŞARILI!', 'Touch events çalışıyor!')}
        >
          <Text style={styles.buttonText}>Test Başarılı!</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#10B981',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    color: 'white',
    marginBottom: 10,
    marginTop: 20,
  },
  button: {
    backgroundColor: '#059669',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  redButton: {
    backgroundColor: '#DC2626',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 10,
  },
  result: {
    color: 'white',
    fontSize: 14,
    fontStyle: 'italic',
  },
}); 