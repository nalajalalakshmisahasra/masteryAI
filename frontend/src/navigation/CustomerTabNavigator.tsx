import React from 'react';

import {
  Platform,
  StyleSheet,
  View,
} from 'react-native';

import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';

import { Ionicons } from '@expo/vector-icons';

import { MarketplaceScreen } from '../screens/customer/MarketplaceScreen';
import { InquiriesScreen } from '../screens/customer/InquiriesScreen';
import { ProfileScreen } from '../screens/customer/ProfileScreen';

import {
  PALETTE,
  RADIUS,
  TOUCH_TARGET,
} from '../theme/tokens';

export type CustomerTabParamList = {
  Marketplace: undefined;
  Inquiries: undefined;
  Profile: undefined;
};

const Tab =
  createBottomTabNavigator<CustomerTabParamList>();

interface Props {
  onLogout?: () => void;

  onSwitchRole?: (
    role: 'ARTISAN'
  ) => void;
}

export const CustomerTabNavigator: React.FC<Props> = ({
  onLogout,
}) => {
  /**
   * Keep tab content above the gesture bar /
   * home indicator on notched devices instead
   * of a fixed bottom padding.
   */
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      initialRouteName="Marketplace"

      screenOptions={({ route }) => ({
        headerShown: false,

        /* ==========================================
           BOTTOM NAVIGATION
        ========================================== */

        tabBarStyle: {
          backgroundColor:
            PALETTE.surface,

          borderTopColor:
            PALETTE.surfaceBorder,

          borderTopWidth: 1,

          height: 60 + insets.bottom,

          paddingTop: 6,

          paddingBottom: 8 + insets.bottom,

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

        /* ==========================================
           COLORS
        ========================================== */

        tabBarActiveTintColor:
          PALETTE.primary,

        tabBarInactiveTintColor:
          PALETTE.textMuted,

        /* ==========================================
           LABEL
        ========================================== */

        tabBarLabelStyle: {
          fontSize: 10,

          fontWeight: '600',

          letterSpacing: 0.2,
        },

        tabBarItemStyle: {
          minHeight:
            TOUCH_TARGET.minHeight,

          paddingVertical: 0,
        },

        /* ==========================================
           ICONS
        ========================================== */

        tabBarIcon: ({
          color,
          size,
          focused,
        }) => {
          let iconName:
            keyof typeof Ionicons.glyphMap =
            'cart';

          if (
            route.name ===
            'Marketplace'
          ) {
            iconName = focused
              ? 'storefront'
              : 'storefront-outline';
          }

          if (
            route.name ===
            'Inquiries'
          ) {
            iconName = focused
              ? 'chatbox-ellipses'
              : 'chatbox-ellipses-outline';
          }

          if (
            route.name ===
            'Profile'
          ) {
            iconName = focused
              ? 'person'
              : 'person-outline';
          }

          return (
            <View
              style={[
                styles.iconWrap,

                focused &&
                  styles.iconWrapActive,
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

      {/* ==========================================
          MARKETPLACE
      ========================================== */}

      <Tab.Screen
        name="Marketplace"
        component={MarketplaceScreen}
      />


      {/* ==========================================
          INQUIRIES
      ========================================== */}

      <Tab.Screen
        name="Inquiries"
        component={InquiriesScreen}
      />


      {/* ==========================================
          PROFILE
      ========================================== */}

      <Tab.Screen name="Profile">
        {() => (
          <ProfileScreen
            onLogout={onLogout}
          />
        )}
      </Tab.Screen>

    </Tab.Navigator>
  );
};


/* ================================================
   STYLES
================================================ */

const styles = StyleSheet.create({

  iconWrap: {
    minWidth: 56,

    height: 30,

    borderRadius:
      RADIUS.full,

    alignItems: 'center',

    justifyContent: 'center',
  },

  iconWrapActive: {
    backgroundColor:
      PALETTE.primaryMuted,
  },

});