import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('Les notifications push nécessitent un vrai appareil.')
    return null
  }

  // Vérifier et demander les permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.warn('Permission notifications refusée.')
    return null
  }

  // Canal Android (requis pour Android 8+)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('calls', {
      name:            'Appels MODECT',
      importance:      Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor:      '#2D6A9F',
      sound:           'call-ringtone',
    })
  }

  // Récupérer le token Expo
  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
  })

  console.log('Push token:', token)
  return token
}
