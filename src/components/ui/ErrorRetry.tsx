import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../../constants';

interface ErrorRetryProps {
  message?: string;
  onRetry: () => void;
}

const ErrorRetry: React.FC<ErrorRetryProps> = ({
  message = 'Something went wrong',
  onRetry,
}) => {
  return (
    <View style={styles.container}>
      <Ionicons name="cloud-offline-outline" size={56} color={COLORS.gray[300]} />
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity style={styles.button} onPress={onRetry} activeOpacity={0.8}>
        <Ionicons name="refresh" size={18} color={COLORS.white} />
        <Text style={styles.buttonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding * 2,
  },
  message: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray[600],
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
  },
});

export default ErrorRetry;
