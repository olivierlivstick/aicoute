import { Tabs } from 'expo-router'
import { Phone, Clock } from 'lucide-react-native'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown:        false,
        tabBarActiveTintColor:   '#2D6A9F',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor:  '#F1F5F9',
          height:          70,
          paddingBottom:   12,
        },
        tabBarLabelStyle: {
          fontSize:   14,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title:    'Accueil',
          tabBarIcon: ({ color, size }) => <Phone color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title:    'Historique',
          tabBarIcon: ({ color, size }) => <Clock color={color} size={size} />,
        }}
      />
    </Tabs>
  )
}
