import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { RootNavigator } from './src/navigation';
import ErrorBoundary from './src/components/ErrorBoundary';
import OfflineBanner from './src/components/OfflineBanner';

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="auto" />
          <RootNavigator />
          <OfflineBanner />
        </NavigationContainer>
        <Toast />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
