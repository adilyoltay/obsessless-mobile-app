import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SimpleTouchTest() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Touch Test Screen</Text>
      
      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          console.log('TouchableOpacity pressed!');
          Alert.alert('Success', 'TouchableOpacity works!');
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.buttonText}>TouchableOpacity Test</Text>
      </TouchableOpacity>

      <Pressable
        style={({ pressed }) => [
          styles.button,
          styles.pressableButton,
          pressed && styles.pressed
        ]}
        onPress={() => {
          console.log('Pressable pressed!');
          Alert.alert('Success', 'Pressable works!');
        }}
      >
        <Text style={styles.buttonText}>Pressable Test</Text>
      </Pressable>

      <View style={styles.button}>
        <Text 
          style={styles.buttonText}
          onPress={() => {
            console.log('Text onPress!');
            Alert.alert('Success', 'Text onPress works!');
          }}
        >
          Text onPress Test
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#10B981',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    marginVertical: 10,
    minWidth: 200,
    alignItems: 'center',
  },
  pressableButton: {
    backgroundColor: '#3B82F6',
  },
  pressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});