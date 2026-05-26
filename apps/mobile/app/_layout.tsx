import { useEffect, useRef } from 'react'
import { Stack, router } from 'expo-router'
import * as Notifications from 'expo-notifications'
import * as SplashScreen from 'expo-splash-screen'
import { registerForPushNotifications } from '@/lib/notifications'
import { supabase } from '@/lib/supabase'

// Garder le splash screen visible pendant le chargement
SplashScreen.preventAutoHideAsync()

// Configurer le comportement des notifications quand l'app est au premier plan
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
})

export default function RootLayout() {
  const notificationListener   = useRef<Notifications.EventSubscription | null>(null)
  const notificationResponseListener = useRef<Notifications.EventSubscription | null>(null)

  useEffect(() => {
    SplashScreen.hideAsync()

    // Enregistrer pour les push notifications et sauvegarder le token
    registerForPushNotifications().then((token) => {
      if (token) savePushToken(token)
    })

    // Notification reçue en premier plan → naviguer vers l'écran d'appel
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data
      if (data?.call_id) {
        router.push({
          pathname: '/call',
          params: {
            call_id:     data.call_id as string,
            room_name:   data.room_name as string,
            user_token:  data.user_token as string,
            livekit_url: data.livekit_url as string,
            persona_name: data.persona_name as string,
          },
        })
      }
    })

    // Tap sur une notification (app en background/fermée)
    notificationResponseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data
      if (data?.call_id) {
        router.push({
          pathname: '/call',
          params: {
            call_id:     data.call_id as string,
            room_name:   data.room_name as string,
            user_token:  data.user_token as string,
            livekit_url: data.livekit_url as string,
            persona_name: data.persona_name as string,
          },
        })
      }
    })

    return () => {
      notificationListener.current?.remove()
      notificationResponseListener.current?.remove()
    }
  }, [])

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="call"
        options={{
          presentation:     'fullScreenModal',
          gestureEnabled:   false,   // Empêcher de fermer par glissement
          headerShown:      false,
        }}
      />
    </Stack>
  )
}

async function savePushToken(token: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase
    .from('beneficiaries')
    .update({ push_token: token })
    .eq('id', user.id)
}
