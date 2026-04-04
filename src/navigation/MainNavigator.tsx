import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { HomeScreen, WalletScreen, ReferScreen, ProfileScreen } from '../screens/main';
import { MainTabParamList } from './types';
import { COLORS } from '../constants';

const Tab = createBottomTabNavigator<MainTabParamList>();

type IconName = keyof typeof Ionicons.glyphMap;

const getTabIcon = (routeName: keyof MainTabParamList, focused: boolean): IconName => {
  const icons: Record<keyof MainTabParamList, { focused: IconName; unfocused: IconName }> = {
    Home: { focused: 'home', unfocused: 'home-outline' },
    Wallet: { focused: 'wallet', unfocused: 'wallet-outline' },
    Refer: { focused: 'people', unfocused: 'people-outline' },
    Profile: { focused: 'person', unfocused: 'person-outline' },
  };

  return focused ? icons[routeName].focused : icons[routeName].unfocused;
};

const MainNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, size }) => {
          const iconName = getTabIcon(route.name, focused);
          return (
            <Ionicons
              name={iconName}
              size={size}
              color={focused ? COLORS.primary : COLORS.gray[400]}
            />
          );
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.gray[400],
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 1,
          borderTopColor: COLORS.gray[200],
          paddingTop: 8,
          paddingBottom: 8,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen 
        name="Wallet" 
        component={WalletScreen}
        options={{ tabBarLabel: 'Wallet' }}
      />
      <Tab.Screen 
        name="Refer" 
        component={ReferScreen}
        options={{ tabBarLabel: 'Refer' }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

export default MainNavigator;
