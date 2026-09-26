import React, {
  useEffect,
  useState,
} from 'react';

import {
  View,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';

import {
  NavigationContainer,
} from '@react-navigation/native';

import { AuthStackNavigator } from './AuthStackNavigator';
import { ArtisanTabNavigator } from './ArtisanTabNavigator';
import { CustomerTabNavigator } from './CustomerTabNavigator';

import {
  AuthAdapter,
  AuthUser,
} from '../adapters/auth';

import { PALETTE } from '../theme/tokens';
import { VoiceAssistant } from '../components/VoiceAssistant';

export const RootNavigator: React.FC = () => {
  /*
   * Current authenticated user
   */
  const [currentUser, setCurrentUser] =
    useState<AuthUser | null>(null);

  /*
   * Initial loading state
   */
  const [isLoading, setIsLoading] =
    useState<boolean>(true);

  /*
   * Current screen used by VoiceAssistant
   *
   * This starts with WelcomeLanguage
   * because that is the first authentication
   * screen in your application.
   */
  const [currentScreen, setCurrentScreen] =
    useState<string>(
      'WelcomeLanguage'
    );

  /*
   * Load existing authentication session
   */
  useEffect(() => {
    const loadSession = async () => {
      try {
        const user =
          await AuthAdapter.getCurrentUser();

        setCurrentUser(user);
      } catch (err) {
        console.warn(
          '[RootNavigator] Session check error:',
          err
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, []);

  /*
   * Called after successful login/register
   */
  const handleAuthenticated = (
    user: AuthUser
  ) => {
    setCurrentUser(user);
  };

  /*
   * Logout
   */
 const handleLogout = () => {
  console.log('[RootNavigator] Logout started');

  // Change UI immediately.
  // This guarantees that the user leaves the authenticated
  // screens even if AsyncStorage is slow.
  setCurrentUser(null);
  setCurrentScreen('WelcomeLanguage');

  // Clear the stored login session in the background.
  AuthAdapter.signOut()
    .then(() => {
      console.log('[RootNavigator] Auth session cleared');
    })
    .catch((error) => {
      console.error(
        '[RootNavigator] Failed to clear auth session:',
        error,
      );
    });
};
  /*
   * Switch between Artisan and Customer
   */
  const handleSwitchRole = (
    newRole:
      | 'ARTISAN'
      | 'CUSTOMER'
  ) => {
    if (!currentUser) {
      return;
    }

    setCurrentUser({
      ...currentUser,
      role: newRole,
    });
  };

  /*
   * Initial loading screen
   */
  if (isLoading) {
    return (
      <View
        style={
          styles.loadingContainer
        }
      >
        <ActivityIndicator
          size="large"
          color={
            PALETTE.primary
          }
        />
      </View>
    );
  }

  /*
   * Convert the user's role into
   * the role expected by VoiceAssistant.
   */
  const voiceRole =
    currentUser?.role === 'ARTISAN'
      ? 'ARTISAN'
      : currentUser?.role === 'CUSTOMER'
        ? 'CUSTOMER'
        : 'GUEST';

  /*
   * Get the deepest active route.
   *
   * Your project has nested navigation:
   *
   * Root
   * ├── AuthStack
   * │   └── Auth Screen
   *
   * ├── ArtisanTabs
   * │   └── Artisan Screen
   *
   * └── CustomerTabs
   *     └── Customer Screen
   *
   * This function walks through the nested
   * navigation state until it finds the
   * actual visible screen.
   */
  const getDeepestRouteName = (
    state: any
  ): string | null => {
    try {
      if (!state) {
        return null;
      }

      let route =
        state.routes?.[
          state.index
        ];

      while (
        route?.state
      ) {
        const nestedState =
          route.state;

        route =
          nestedState.routes?.[
            nestedState.index
          ];
      }

      if (
        route &&
        typeof route.name === 'string'
      ) {
        return route.name;
      }

      return null;
    } catch (error) {
      console.warn(
        '[VoiceGuide] Could not determine current route:',
        error
      );

      return null;
    }
  };

  /*
   * Detect navigation changes.
   *
   * This is the main connection between
   * React Navigation and VoiceAssistant.
   */
  const handleNavigationStateChange = (
    state: any
  ) => {
    const routeName =
      getDeepestRouteName(
        state
      );

    if (!routeName) {
      return;
    }

    console.log(
      '[VoiceGuide] Current screen:',
      routeName
    );

    setCurrentScreen(
      routeName
    );
  };

  return (
    <View
      style={
        styles.root
      }
    >
      <NavigationContainer
        /*
         * IMPORTANT:
         *
         * We intentionally do NOT use
         * useNavigationContainerRef here.
         *
         * This avoids the TypeScript
         * "Property 'name' does not exist
         * on type 'never'" errors.
         */

        onStateChange={
          handleNavigationStateChange
        }

        theme={{
          dark: false,

          colors: {
            primary:
              PALETTE.primary,

            background:
              PALETTE.background,

            card:
              PALETTE.surface,

            text:
              PALETTE.textPrimary,

            border:
              PALETTE.surfaceBorder,

            notification:
              PALETTE.primaryLight,
          },

          fonts: {
            regular: {
              fontFamily:
                'System',
              fontWeight:
                '400',
            },

            medium: {
              fontFamily:
                'System',
              fontWeight:
                '500',
            },

            bold: {
              fontFamily:
                'System',
              fontWeight:
                '700',
            },

            heavy: {
              fontFamily:
                'System',
              fontWeight:
                '900',
            },
          },
        }}
      >
        {!currentUser ? (
          /*
           * Authentication flow
           */
          <AuthStackNavigator
            onAuthenticated={
              handleAuthenticated
            }
            initialRouteName={
              'WelcomeLanguage'
            }
          />
        ) : currentUser.role ===
          'ARTISAN' ? (
          /*
           * Artisan application
           */
          <ArtisanTabNavigator
            onLogout={
              handleLogout
            }
            onSwitchRole={
              handleSwitchRole
            }
          />
        ) : (
          /*
           * Customer application
           */
          <CustomerTabNavigator
            onLogout={
              handleLogout
            }
            onSwitchRole={
              handleSwitchRole
            }
          />
        )}
      </NavigationContainer>

      {/*
       * GLOBAL VOICE ASSISTANT
       *
       * The assistant stays outside
       * NavigationContainer so it remains
       * available throughout the application.
       *
       * screen={currentScreen} tells the
       * assistant which page the user
       * is currently viewing.
       */}
      <VoiceAssistant
        role={voiceRole}
        screen={
          currentScreen
        }
      />
    </View>
  );
};

const styles =
  StyleSheet.create({
    root: {
      flex: 1,
    },

    loadingContainer: {
      flex: 1,

      backgroundColor:
        PALETTE.background,

      alignItems:
        'center',

      justifyContent:
        'center',
    },
  });