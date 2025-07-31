import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Pressable, TouchableHighlight } from 'react-native';

export default function UltraSimpleTestScreen() {
  const [count, setCount] = useState(0);
  const [touchTest, setTouchTest] = useState('');

  const handlePress = () => {
    const newCount = count + 1;
    setCount(newCount);
    Alert.alert('SUCCESS!', `Button pressed ${newCount} times`);
    console.log('🔥 TOUCHABLE OPACITY PRESSED!', newCount);
  };

  const handlePressablePress = () => {
    const newCount = count + 10;
    setCount(newCount);
    Alert.alert('PRESSABLE WORKS!', `Pressable pressed! Count: ${newCount}`);
    console.log('🔥 PRESSABLE PRESSED!', newCount);
  };

  const handleHighlightPress = () => {
    const newCount = count + 100;
    setCount(newCount);
    Alert.alert('HIGHLIGHT WORKS!', `TouchableHighlight pressed! Count: ${newCount}`);
    console.log('🔥 TOUCHABLE HIGHLIGHT PRESSED!', newCount);
  };

  const handleViewTouch = () => {
    setTouchTest('View Touch Detected!');
    console.log('🔥 VIEW TOUCH DETECTED!');
  };

  return (
    <View style={{
      flex: 1,
      backgroundColor: '#FF0000', // Kırmızı arka plan
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    }}>
      <Text style={{
        fontSize: 32,
        fontWeight: 'bold',
        color: 'white',
        textAlign: 'center',
        marginBottom: 30,
      }}>
        TOUCH TEST - MULTIPLE TYPES
      </Text>

      <Text style={{
        fontSize: 24,
        color: 'white',
        textAlign: 'center',
        marginBottom: 20,
      }}>
        Count: {count}
      </Text>

      <Text style={{
        fontSize: 16,
        color: 'yellow',
        textAlign: 'center',
        marginBottom: 30,
      }}>
        Touch Test: {touchTest}
      </Text>

      {/* TouchableOpacity Test */}
      <TouchableOpacity 
        style={{
          backgroundColor: '#00FF00',
          padding: 15,
          borderRadius: 10,
          marginBottom: 15,
          minWidth: 250,
          alignItems: 'center',
        }}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <Text style={{
          color: 'black',
          fontSize: 16,
          fontWeight: 'bold',
        }}>
          TouchableOpacity (+1)
        </Text>
      </TouchableOpacity>

      {/* Pressable Test */}
      <Pressable 
        style={({ pressed }) => ({
          backgroundColor: pressed ? '#0066CC' : '#0000FF',
          padding: 15,
          borderRadius: 10,
          marginBottom: 15,
          minWidth: 250,
          alignItems: 'center',
        })}
        onPress={handlePressablePress}
      >
        <Text style={{
          color: 'white',
          fontSize: 16,
          fontWeight: 'bold',
        }}>
          Pressable (+10)
        </Text>
      </Pressable>

      {/* TouchableHighlight Test */}
      <TouchableHighlight 
        style={{
          backgroundColor: '#FFFF00',
          padding: 15,
          borderRadius: 10,
          marginBottom: 15,
          minWidth: 250,
          alignItems: 'center',
        }}
        onPress={handleHighlightPress}
        underlayColor="#CCCC00"
      >
        <Text style={{
          color: 'black',
          fontSize: 16,
          fontWeight: 'bold',
        }}>
          TouchableHighlight (+100)
        </Text>
      </TouchableHighlight>

      {/* View with onTouchStart */}
      <View 
        style={{
          backgroundColor: '#FF00FF',
          padding: 15,
          borderRadius: 10,
          marginBottom: 15,
          minWidth: 250,
          alignItems: 'center',
        }}
        onTouchStart={handleViewTouch}
        onTouchEnd={() => setTouchTest('View Touch End')}
      >
        <Text style={{
          color: 'white',
          fontSize: 16,
          fontWeight: 'bold',
        }}>
          View onTouchStart
        </Text>
      </View>

      <View style={{
        backgroundColor: 'rgba(255,255,255,0.2)',
        padding: 15,
        borderRadius: 10,
        marginTop: 20,
      }}>
        <Text style={{
          color: 'white',
          fontSize: 14,
          textAlign: 'center',
        }}>
          If NONE of these work, it's a serious
        </Text>
        <Text style={{
          color: 'white',
          fontSize: 14,
          textAlign: 'center',
        }}>
          Expo Go + iPhone 16 compatibility issue!
        </Text>
      </View>
    </View>
  );
} 