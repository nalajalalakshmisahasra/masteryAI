import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

import { AuthStackNavigator } from './AuthStackNavigator';
import { ArtisanTabNavigator } from './ArtisanTabNavigator';
import { CustomerTabNavigator } from './CustomerTabNavigator';

import { AuthAdapter, AuthUser } from '../adapters/auth';
import { PALETTE } from '../theme/tokens';

export const RootNavigator: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Check whether a user is already logged in
  const checkSession = async () => {
    try {
      const user = await AuthAdapter.getCurrentUser();
      setCurrentUser(user);
    } catch (err) {
      console.warn('Session check error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  // Called after successful Login / Register
  const handleAuthenticated = (user: AuthUser) => {
    setCurrentUser(user);
  };

  // Logout
  const handleLogout = async () => {
    try {
      await AuthAdapter.signOut();
    } catch (err) {
      console.warn('Logout error:', err);
    }

    setCurrentUser(null);
  };

  // Switch between Artisan and Customer
  const handleSwitchRole = (newRole: 'ARTISAN' | 'CUSTOMER') => {
    if (currentUser) {
      const updatedUser: AuthUser = {
        ...currentUser,
        role: newRole,
      };

      setCurrentUser(updatedUser);
    }
  };

  // Loading screen
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

  return (
    <NavigationContainer
      theme={{
        // White + Brown theme
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

      {/* 
        FIRST SCREEN:
        Language Selection

        HeroPitch is intentionally removed from the initial flow.
      */}
      {!currentUser ? (
        <AuthStackNavigator
          onAuthenticated={handleAuthenticated}
          initialRouteName="WelcomeLanguage"
        />
      ) : currentUser.role === 'ARTISAN' ? (

        /* ARTISAN APPLICATION */
        <ArtisanTabNavigator
          onLogout={handleLogout}
          onSwitchRole={handleSwitchRole}
        />

      ) : (

        /* CUSTOMER APPLICATION */
        <CustomerTabNavigator
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