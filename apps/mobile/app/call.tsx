/**
 * Écran d'appel LiveKit
 *
 * - Interface minimaliste : avatar animé (onde sonore), prénom du compagnon
 * - Bouton ROUGE "Raccrocher" très visible
 * - Indicateur "En train de parler..." / "En train d'écouter..."
 * - Accessibilité senior : polices 20px+, bouton raccrocher min 80px
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, StatusBar, Easing, Alert,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import {
  Room,
  RoomEvent,
  Participant,
  Track,
  RemoteParticipant,
  ConnectionState,
  registerGlobals,
} from '@livekit/react-native'
import { supabase } from '@/lib/supabase'

// Initialiser LiveKit WebRTC (nécessaire une seule fois)
registerGlobals()

type CallState = 'connecting' | 'waiting' | 'active' | 'agent_speaking' | 'ended'

export default function CallScreen() {
  const { call_id, room_name, user_token, livekit_url, persona_name } =
    useLocalSearchParams<{
      call_id:     string
      room_name:   string
      user_token:  string
      livekit_url: string
      persona_name: string
    }>()

  const roomRef        = useRef<Room | null>(null)
  const [state,        setState]        = useState<CallState>('connecting')
  const [elapsedSec,   setElapsedSec]   = useState(0)
  const timerRef       = useRef<NodeJS.Timeout | null>(null)

  // Animation onde sonore (pulsation)
  const pulseAnim  = useRef(new Animated.Value(1)).current
  const pulseAnim2 = useRef(new Animated.Value(1)).current

  // Démarrer la pulsation quand l'agent parle
  useEffect(() => {
    if (state === 'agent_speaking') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      )
      const pulse2 = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim2, { toValue: 1.3, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim2, { toValue: 1,   duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      )
      pulse.start()
      pulse2.start()
      return () => { pulse.stop(); pulse2.stop() }
    } else {
      pulseAnim.setValue(1)
      pulseAnim2.setValue(1)
    }
  }, [state])

  // Connexion LiveKit
  useEffect(() => {
    if (!room_name || !user_token || !livekit_url) {
      Alert.alert('Erreur', 'Informations d\'appel manquantes.')
      router.back()
      return
    }

    let mounted = true
    const room = new Room()
    roomRef.current = room

    room.on(RoomEvent.Connected, () => {
      if (!mounted) return
      setState('waiting')
      // Démarrer le chronomètre
      timerRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000)
    })

    room.on(RoomEvent.Disconnected, () => {
      if (!mounted) return
      setState('ended')
      cleanup()
    })

    // Détecter quand l'agent rejoint et parle
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
      if (!mounted) return
      const agentSpeaking = speakers.some((p) =>
        p.identity.startsWith('agent-') && p.isSpeaking
      )
      setState(agentSpeaking ? 'agent_speaking' : 'active')
    })

    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      if (participant.identity.startsWith('agent-')) {
        setState('active')
      }
    })

    // Se connecter
    room.connect(livekit_url, user_token, {
      autoSubscribe: true,
    }).catch((err) => {
      console.error('LiveKit connect error:', err)
      Alert.alert('Connexion impossible', 'Vérifiez votre connexion internet.')
      router.back()
    })

    return () => {
      mounted = false
      cleanup()
    }
  }, [])

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    roomRef.current?.disconnect()
  }, [])

  const hangUp = useCallback(() => {
    setState('ended')
    cleanup()

    // Marquer le call comme terminé
    if (call_id) {
      supabase.from('calls').update({
        status:   'completed',
        ended_at: new Date().toISOString(),
      }).eq('id', call_id)
    }

    router.replace('/(tabs)')
  }, [call_id, cleanup])

  // Format chronomètre
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0')
    const s = (sec % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const stateLabel: Record<CallState, string> = {
    connecting:     'Connexion en cours…',
    waiting:        `En attente de ${persona_name ?? 'votre compagnon'}…`,
    active:         'En train d\'écouter…',
    agent_speaking: `${persona_name ?? 'Votre compagnon'} parle…`,
    ended:          'Appel terminé',
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1E3A5F" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {state === 'connecting' ? 'Connexion…' : persona_name ?? 'Votre compagnon'}
        </Text>
        {state !== 'connecting' && state !== 'ended' && (
          <Text style={styles.timer}>{formatTime(elapsedSec)}</Text>
        )}
      </View>

      {/* Avatar animé */}
      <View style={styles.avatarSection}>
        {/* Anneau externe (pulsation lente) */}
        <Animated.View style={[
          styles.pulseRing2,
          { transform: [{ scale: pulseAnim2 }], opacity: state === 'agent_speaking' ? 0.3 : 0 }
        ]} />
        {/* Anneau interne (pulsation rapide) */}
        <Animated.View style={[
          styles.pulseRing1,
          { transform: [{ scale: pulseAnim }], opacity: state === 'agent_speaking' ? 0.5 : 0 }
        ]} />
        {/* Avatar */}
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>
            {(persona_name ?? '?')[0].toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Indicateur d'état */}
      <View style={styles.statusSection}>
        <Text style={styles.personaName}>{persona_name ?? 'Votre compagnon'}</Text>
        <Text style={styles.statusText}>{stateLabel[state]}</Text>

        {/* Indicateur audio animé */}
        {(state === 'active' || state === 'agent_speaking') && (
          <View style={styles.audioIndicator}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Animated.View
                key={i}
                style={[
                  styles.audioBar,
                  {
                    height: state === 'agent_speaking' ? (12 + i * 6) : 8,
                    backgroundColor: state === 'agent_speaking' ? '#F4A261' : '#94A3B8',
                  }
                ]}
              />
            ))}
          </View>
        )}
      </View>

      {/* Bouton Raccrocher — ROUGE, très visible */}
      <View style={styles.hangUpSection}>
        <TouchableOpacity
          style={styles.hangUpButton}
          onPress={hangUp}
          activeOpacity={0.85}
          accessibilityLabel="Raccrocher"
          accessibilityRole="button"
          accessibilityHint="Termine l'appel avec votre compagnon"
        >
          <Text style={styles.hangUpIcon}>📵</Text>
          <Text style={styles.hangUpText}>Raccrocher</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A2E47',
    alignItems: 'center',
  },

  header: {
    paddingTop: 60, paddingBottom: 20,
    alignItems: 'center', width: '100%',
  },
  headerTitle: {
    fontSize: 24, fontWeight: '700', color: 'white',
  },
  timer: {
    fontSize: 20, color: '#94A3B8', marginTop: 4,
    fontVariant: ['tabular-nums'],
  },

  avatarSection: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
  pulseRing2: {
    position: 'absolute',
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: '#2D6A9F',
  },
  pulseRing1: {
    position: 'absolute',
    width: 190, height: 190, borderRadius: 95,
    backgroundColor: '#2D6A9F',
  },
  avatar: {
    width: 150, height: 150, borderRadius: 75,
    backgroundColor: '#2D6A9F',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarInitial: {
    fontSize: 70, fontWeight: '800', color: 'white',
  },

  statusSection: {
    alignItems: 'center', paddingHorizontal: 32, paddingBottom: 32,
  },
  personaName: {
    fontSize: 32, fontWeight: '800', color: 'white', marginBottom: 8,
  },
  statusText: {
    fontSize: 20, color: '#94A3B8', textAlign: 'center',
  },
  audioIndicator: {
    flexDirection: 'row', alignItems: 'flex-end',
    gap: 5, marginTop: 16, height: 44,
  },
  audioBar: {
    width: 6, borderRadius: 3,
    minHeight: 8,
  },

  hangUpSection: {
    paddingBottom: 50, paddingHorizontal: 32, width: '100%',
  },
  hangUpButton: {
    backgroundColor: '#DC2626',
    borderRadius: 28,
    paddingVertical: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    minHeight: 80,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  hangUpIcon: { fontSize: 32 },
  hangUpText: {
    fontSize: 26, fontWeight: '800', color: 'white',
  },
})
