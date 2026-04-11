import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainTabNavigator from './MainTabNavigator';
import BookSiteVisitScreen from '../screens/main/BookSiteVisitScreen';
import RewardsStoreScreen from '../screens/main/RewardsStoreScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import MyLeadsScreen from '../screens/main/MyLeadsScreen';
import VideoReelScreen from '../screens/main/VideoReelScreen';
import { MainStackParamList } from './types';

const Stack = createNativeStackNavigator<MainStackParamList>();

const MainNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen name="BookSiteVisit" component={BookSiteVisitScreen} />
      <Stack.Screen name="RewardsStore" component={RewardsStoreScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="MyLeads" component={MyLeadsScreen} />
      <Stack.Screen
        name="VideoReels"
        component={VideoReelScreen}
        options={{
          animation: 'slide_from_bottom',
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
    </Stack.Navigator>
  );
};

export default MainNavigator;
