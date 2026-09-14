import React, { useEffect, useState } from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';

import { NavigationContainer } from '@react-navigation/native';

import { AuthStackNavigator } from './AuthStackNavigator';
import { ArtisanTabNavigator } from './ArtisanTabNavigator';
import { CustomerTabNavigator } from './CustomerTabNavigator';

import {
  AuthAdapter,
  AuthUser,
} from '../adapters/auth';

import { PALETTE } from '../theme/tokens';

export const RootNavigator: React.FC = () => {
  const [currentUser, setCurrentUser] =
    useState<AuthUser | null>(null);

  const [isLoading, setIsLoading] =
    useState<boolean>(true);

  // -------------------------------------------------------
  // Check existing session
  // -------------------------------------------------------

  const checkSession = async () => {
    try {
      const user = await AuthAdapter.getCurrentUser();
      setCurrentUser(user);
    } catch (err) {
      console.warn('Session check error:', err);
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  // -------------------------------------------------------
  // Login / Register successful
  // -------------------------------------------------------

  const handleAuthenticated = (user: AuthUser) => {
    setCurrentUser(user);
  };

  // -------------------------------------------------------
  // LOGOUT
  // -------------------------------------------------------

  const handleLogout = async () => {
    try {
      // Clear stored login session
      await AuthAdapter.signOut();
    } catch (err) {
      console.warn('Logout error:', err);
    }

    // Remove current user.
    // This makes RootNavigator render AuthStack again.
    setCurrentUser(null);
  };

  // -------------------------------------------------------
  // Switch role
  // -------------------------------------------------------

  const handleSwitchRole = (
    newRole: 'ARTISAN' | 'CUSTOMER'
  ) => {
    if (!currentUser) {
      return;
    }

    const updatedUser: AuthUser = {
      ...currentUser,
      role: newRole,
    };

    setCurrentUser(updatedUser);
  };

  // -------------------------------------------------------
  // Loading
  // -------------------------------------------------------

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color={PALETTE.primary}
        />
      </View>
    );
  }

  // -------------------------------------------------------
  // APPLICATION
  // -------------------------------------------------------

  return (
   <NavigationContainer
  key={currentUser ? 'app' : 'auth'}
  theme={{
    dark: false,

        colors: {
          primary: PALETTE.primary,
          background: PALETTE.background,
          card: PALETTE.surface,
          text: PALETTE.textPrimary,
          border: PALETTE.surfaceBorder,
          notification: PALETTE.primaryLight,
        },

        fonts: {
          regular: {
            fontFamily: 'System',
            fontWeight: '400',
          },

          medium: {
            fontFamily: 'System',
            fontWeight: '500',
          },

          bold: {
            fontFamily: 'System',
            fontWeight: '700',
          },

          heavy: {
            fontFamily: 'System',
            fontWeight: '900',
          },
        },
      }}
    >

      {/* =====================================================
          NOT LOGGED IN
          ===================================================== */}

      {!currentUser ? (

        <AuthStackNavigator
          key="logged-out"
          onAuthenticated={handleAuthenticated}
          initialRouteName="WelcomeLanguage"
        />

      ) : currentUser.role === 'ARTISAN' ? (

        /* ===================================================
           ARTISAN APPLICATION
           =================================================== */

        <ArtisanTabNavigator
          key="artisan-app"
          user={currentUser}
          onLogout={handleLogout}
          onSwitchRole={handleSwitchRole}
        />

      ) : (

        /* ===================================================
           CUSTOMER APPLICATION
           =================================================== */

        <CustomerTabNavigator
          key="customer-app"
          onLogout={handleLogout}
          onSwitchRole={handleSwitchRole}
        />

      )}

    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: PALETTE.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});