import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { DashboardScreen } from '../screens/artisan/DashboardScreen';
import { CatalogScreen } from '../screens/artisan/CatalogScreen';
import { UploadScreen } from '../screens/artisan/UploadScreen';
import { MessagesScreen } from '../screens/artisan/MessagesScreen';
import { AccountScreen } from '../screens/artisan/AccountScreen';

import { AuthUser } from '../adapters/auth';
import {
  PALETTE,
  RADIUS,
  TOUCH_TARGET,
} from '../theme/tokens';

export type ArtisanTabParamList = {
  Dashboard: undefined;
  Catalog: undefined;
  UploadWizard: undefined;
  Messages: undefined;
  Account: undefined;
};

const Tab = createBottomTabNavigator<ArtisanTabParamList>();

interface Props {
  user: AuthUser;
  onLogout: () => void;
  onSwitchRole?: (role: 'CUSTOMER') => void;
}

export const ArtisanTabNavigator: React.FC<Props> = ({
  user,
  onLogout,
  onSwitchRole,
}) => {
  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={({ route }) => ({
        headerShown: false,

        tabBarStyle: {
          backgroundColor: PALETTE.surface,
          borderTopColor: PALETTE.surfaceBorder,
          borderTopWidth: 1,
          height: 60,
          paddingTop: 6,
          paddingBottom: 8,

          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: {
                width: 0,
                height: -3,
              },
              shadowOpacity: 0.25,
              shadowRadius: 8,
            },

            android: {
              elevation: 10,
            },
          }),
        },

        tabBarActiveTintColor: PALETTE.primary,
        tabBarInactiveTintColor: PALETTE.textMuted,

        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.2,
        },

        tabBarItemStyle: {
          minHeight: TOUCH_TARGET.minHeight,
          paddingVertical: 0,
        },

        tabBarIcon: ({ color, size, focused }) => {
          let iconName: keyof typeof Ionicons.glyphMap =
            'home-outline';

          if (route.name === 'Dashboard') {
            iconName = focused
              ? 'speedometer'
              : 'speedometer-outline';
          }

          if (route.name === 'Catalog') {
            iconName = focused
              ? 'grid'
              : 'grid-outline';
          }

          if (route.name === 'UploadWizard') {
            iconName = focused
              ? 'add-circle'
              : 'add-circle-outline';
          }

          if (route.name === 'Messages') {
            iconName = focused
              ? 'chatbubbles'
              : 'chatbubbles-outline';
          }

          if (route.name === 'Account') {
            iconName = focused
              ? 'person'
              : 'person-outline';
          }

          return (
            <View
              style={[
                styles.iconWrap,
                focused && styles.iconWrapActive,
              ]}
            >
              <Ionicons
                name={iconName}
                size={size}
                color={color}
              />
            </View>
          );
        },
      })}
    >
      {/* Dashboard */}
      <Tab.Screen name="Dashboard">
        {(props) => (
          <DashboardScreen
            {...props}
            onSwitchRole={onSwitchRole}
          />
        )}
      </Tab.Screen>

      {/* Catalog */}
      <Tab.Screen
        name="Catalog"
        component={CatalogScreen}
      />

      {/* Add Craft */}
      <Tab.Screen
        name="UploadWizard"
        component={UploadScreen}
        options={{
          tabBarLabel: 'Add Craft',
        }}
      />

      {/* Messages */}
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
      />

      {/* Account */}
      <Tab.Screen name="Account">
        {() => (
          <AccountScreen
            user={user}
            onLogout={onLogout}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  iconWrap: {
    minWidth: 56,
    height: 30,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconWrapActive: {
    backgroundColor: PALETTE.primaryMuted,
  },
});