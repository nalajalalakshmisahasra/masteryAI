import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HeroPitchScreen } from '../screens/auth/HeroPitchScreen';
import { WelcomeLanguageScreen, AuthStackParamList } from '../screens/auth/WelcomeLanguageScreen';
import { PhoneAuthScreen } from '../screens/auth/PhoneAuthScreen';
import { OnboardingScreen } from '../screens/auth/OnboardingScreen';
import { AuthUser } from '../adapters/auth';
import { PALETTE } from '../theme/tokens';

const Stack = createNativeStackNavigator<AuthStackParamList>();

interface Props {
  onAuthenticated?: (user: AuthUser) => void;
  initialRouteName?: keyof AuthStackParamList;
}

export const AuthStackNavigator: React.FC<Props> = ({
  onAuthenticated,
  initialRouteName = 'HeroPitch',
}) => {
  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: PALETTE.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="HeroPitch" component={HeroPitchScreen} />
      <Stack.Screen name="WelcomeLanguage" component={WelcomeLanguageScreen} />
      <Stack.Screen name="PhoneAuth">
        {(props) => <PhoneAuthScreen {...props} onAuthenticated={onAuthenticated} />}
      </Stack.Screen>
      <Stack.Screen name="Onboarding">
        {(props) => <OnboardingScreen {...props} onAuthenticated={onAuthenticated} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
};
