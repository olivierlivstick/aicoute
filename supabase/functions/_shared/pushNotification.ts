/**
 * Envoi de notifications push via Expo Push API
 * Doc : https://docs.expo.dev/push-notifications/sending-notifications/
 */

export interface PushPayload {
  to: string              // Token Expo (ExponentPushToken[...])
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default' | null
  priority?: 'default' | 'normal' | 'high'
}

export async function sendExpoPushNotification(payload: PushPayload): Promise<boolean> {
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Accept':       'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to:       payload.to,
      title:    payload.title,
      body:     payload.body,
      data:     payload.data ?? {},
      sound:    payload.sound ?? 'default',
      priority: payload.priority ?? 'high',
    }),
  })

  if (!res.ok) {
    console.error('Expo push failed:', await res.text())
    return false
  }

  const result = await res.json()
  // Vérifier les erreurs par ticket
  if (result.data?.status === 'error') {
    console.error('Expo push error:', result.data.message)
    return false
  }
  return true
}
