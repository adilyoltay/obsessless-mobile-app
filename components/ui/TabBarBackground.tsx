// This is a shim for web and Android where the tab bar is generally opaque.
export default undefined;

export function useBottomTabOverflow() {
  return 0;
}

import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    boxShadow: '0px -3px 3px rgba(0, 0, 0, 0.1)',
    elevation: 5,
  },
});