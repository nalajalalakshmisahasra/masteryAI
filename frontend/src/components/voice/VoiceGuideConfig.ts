export type VoiceGuideScreen =
  | 'WelcomeLanguage'
  | 'PhoneAuth'
  | 'Onboarding'
  | 'ArtisanDashboard'
  | 'ArtisanCatalog'
  | 'ArtisanUpload'
  | 'ArtisanMessages'
  | 'CustomerMarketplace'
  | 'CustomerInquiries'
  | 'CustomerProfile'
  | 'Unknown';

export interface VoiceGuideStep {
  title: string;
  instruction: string;
}

export const VOICE_GUIDES: Record<
  VoiceGuideScreen,
  VoiceGuideStep
> = {
  WelcomeLanguage: {
    title:
      'Language Selection',

    instruction:
      'Welcome to Craft Mastery. First, choose the language you are most comfortable using. Tap your preferred language to continue.',
  },

  PhoneAuth: {
    title:
      'Login or Register',

    instruction:
      'This page is for signing in or creating your Craft Mastery account. Enter your mobile number and follow the instructions on the screen.',
  },

  Onboarding: {
    title:
      'Getting Started',

    instruction:
      'Welcome to Craft Mastery. I will guide you through the app. Follow each step and you can use your voice whenever typing is difficult.',
  },

  ArtisanDashboard: {
    title:
      'Artisan Dashboard',

    instruction:
      'Welcome to your workshop dashboard. To add a new handmade product, tap Create Craft. I will guide you through the complete listing process.',
  },

  ArtisanCatalog: {
    title:
      'Your Catalog',

    instruction:
      'This is your craft catalog. Here you can view your products, check their information, and manage your listings.',
  },

  ArtisanUpload: {
    title:
      'Create a Craft Listing',

    instruction:
      'Let us create your craft listing. First, take or select a clear photo of your handmade product. Make sure the whole product is visible.',
  },

  ArtisanMessages: {
    title:
      'Messages',

    instruction:
      'This is your messages page. Here you can communicate with buyers. I can help you understand and respond to messages in your language.',
  },

  CustomerMarketplace: {
    title:
      'Craft Marketplace',

    instruction:
      'Welcome to the marketplace. Here you can discover handmade crafts from artisans. You can search, browse categories, and open a product to learn more.',
  },

  CustomerInquiries: {
    title:
      'Buyer Inquiries',

    instruction:
      'This page contains your inquiries and conversations. Open an inquiry to view the buyer or artisan message and respond.',
  },

  CustomerProfile: {
    title:
      'Your Profile',

    instruction:
      'This is your account page. You can view and update your name, mobile number, language, location, and account settings.',
  },

  Unknown: {
    title:
      'Craft Mastery',

    instruction:
      'You are now on a new page. I can guide you through what you can do here. You can also tap the microphone and ask me for help.',
  },
};