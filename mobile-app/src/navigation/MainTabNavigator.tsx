import React, { useCallback, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { HomeScreen, WalletScreen, ReferScreen, ProfileScreen } from '../screens/main';
import { MainTabParamList } from './types';
import { COLORS } from '../constants';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

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

const AnimatedTabIcon: React.FC<{
  routeName: keyof MainTabParamList;
  focused: boolean;
  size: number;
}> = ({ routeName, focused, size }) => {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (focused) {
      scale.value = withSequence(
        withSpring(1.25, { damping: 10, stiffness: 400 }),
        withSpring(1, { damping: 12, stiffness: 300 })
      );
    }
  }, [focused, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons
        name={getTabIcon(routeName, focused)}
        size={size}
        color={focused ? COLORS.primary : COLORS.gray[400]}
      />
    </Animated.View>
  );
};

const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, size }) => (
          <AnimatedTabIcon
            routeName={route.name}
            focused={focused}
            size={size}
          />
        ),
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
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Wallet" component={WalletScreen} options={{ tabBarLabel: 'Wallet' }} />
      <Tab.Screen name="Refer" component={ReferScreen} options={{ tabBarLabel: 'Refer' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;
