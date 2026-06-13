import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { PlayerProvider } from './context/PlayerContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SpotifyProvider } from './context/SpotifyContext';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import LibraryScreen from './screens/LibraryScreen';
import FeedScreen from './screens/FeedScreen';
import NowPlayingScreen from './screens/NowPlayingScreen';
import ProfileScreen from './screens/ProfileScreen';
import PlaylistDetailScreen from './screens/PlaylistDetailScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="홈"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0D0D0D',
          borderTopWidth: 1,
          borderTopColor: '#1A1A1A',
          height: 58,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: '#CCFF00',
        tabBarInactiveTintColor: '#555',
        tabBarShowLabel: false,
        tabBarIcon: ({ color }) => {
          const icons = {
            보관함: 'compass-outline',
            홈: 'home-outline',
            커뮤니티: 'people-outline',
          };
          return <Ionicons name={icons[route.name]} size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen name="보관함" component={LibraryScreen} />
      <Tab.Screen name="홈" component={HomeScreen} />
      <Tab.Screen name="커뮤니티" component={FeedScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
    <SpotifyProvider>
    <PlayerProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'fade_from_bottom',
            animationDuration: 220,
            contentStyle: { backgroundColor: '#000' },
          }}
        >
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ animation: 'fade' }}
          />
          <Stack.Screen
            name="Main"
            component={MainTabs}
            options={{ animation: 'fade' }}
          />
          <Stack.Screen
            name="NowPlaying"
            component={NowPlayingScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="PlaylistDetail"
            component={PlaylistDetailScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </PlayerProvider>
    </SpotifyProvider>
    </AuthProvider>
  );
}
