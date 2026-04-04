import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { COLORS, SIZES } from '../../constants';
import { useAuthStore } from '../../stores';

const ProfileScreen: React.FC = () => {
  const { logout, phoneNumber, isLoading } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>👤</Text>
        </View>
        <Text style={styles.title}>Profile Screen</Text>
        <Text style={styles.subtitle}>Coming Soon</Text>
        
        {phoneNumber && (
          <View style={styles.infoContainer}>
            <Text style={styles.infoLabel}>Logged in as</Text>
            <Text style={styles.infoValue}>{phoneNumber}</Text>
          </View>
        )}
        
        <Text style={styles.description}>
          Manage your profile, settings, and preferences here.
        </Text>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutButtonText}>
            {isLoading ? 'Logging out...' : 'Logout'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding * 2,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: SIZES.xxl,
    fontWeight: '700',
    color: COLORS.gray[900],
    marginBottom: 8,
  },
  subtitle: {
    fontSize: SIZES.lg,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 16,
  },
  infoContainer: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: SIZES.radius,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoLabel: {
    fontSize: SIZES.sm,
    color: COLORS.gray[500],
    marginBottom: 4,
  },
  infoValue: {
    fontSize: SIZES.lg,
    fontWeight: '600',
    color: COLORS.gray[900],
  },
  description: {
    fontSize: SIZES.md,
    color: COLORS.gray[500],
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  logoutButton: {
    backgroundColor: COLORS.error,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: SIZES.radius,
    shadowColor: COLORS.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutButtonText: {
    fontSize: SIZES.lg,
    fontWeight: '600',
    color: COLORS.white,
  },
});

export default ProfileScreen;
