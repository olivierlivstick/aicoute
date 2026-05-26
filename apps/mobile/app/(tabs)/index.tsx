/**
 * Écran principal bénéficiaire
 * Accessibilité senior : grandes polices, contraste élevé, boutons larges
 */
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, StatusBar,
} from 'react-native'
import { router } from 'expo-router'
import { useBeneficiarySession } from '@/hooks/useBeneficiarySession'
import { supabase } from '@/lib/supabase'

// Jours de la semaine en français
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const MOIS  = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']

function formatNextCall(scheduledAt: string): string {
  const d = new Date(scheduledAt)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const isTomorrow = d.toDateString() === tomorrow.toDateString()

  const heure  = d.getHours().toString().padStart(2, '0')
  const minute = d.getMinutes().toString().padStart(2, '0')
  const timeStr = `${heure}h${minute}`

  if (isToday)    return `aujourd'hui à ${timeStr}`
  if (isTomorrow) return `demain à ${timeStr}`
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} à ${timeStr}`
}

export default function HomeScreen() {
  const { beneficiary, nextCall, loading, error } = useBeneficiarySession()

  const handleCallNow = async () => {
    if (!beneficiary) return

    // Créer un appel à la demande via initiate-call
    const { data, error: callErr } = await supabase.functions.invoke('initiate-call', {
      body: { beneficiary_id: beneficiary.id, on_demand: true },
    })

    if (callErr || !data?.call_id) return

    router.push({
      pathname: '/call',
      params: {
        call_id:      data.call_id,
        room_name:    data.room_name,
        user_token:   data.user_token,
        livekit_url:  data.livekit_url,
        persona_name: beneficiary.ai_persona_name,
      },
    })
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2D6A9F" />
      </View>
    )
  }

  if (error || !beneficiary) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          Impossible de charger votre profil.{'\n'}Contactez votre aidant.
        </Text>
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.container} bounces={false}>
      <StatusBar barStyle="light-content" backgroundColor="#2D6A9F" />

      {/* Header */}
      <View style={styles.header}>
        {/* Onde sonore / logo */}
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>♡</Text>
        </View>
        <Text style={styles.appName}>MODECT</Text>
      </View>

      {/* Salutation */}
      <View style={styles.greetingSection}>
        <Text style={styles.greeting}>
          Bonjour,{'\n'}
          <Text style={styles.greetingName}>{beneficiary.first_name} !</Text>
        </Text>
      </View>

      {/* Prochain appel */}
      <View style={styles.callCard}>
        <Text style={styles.callCardLabel}>Votre prochain appel</Text>

        {nextCall ? (
          <>
            <Text style={styles.callCardTime}>
              {formatNextCall(nextCall.scheduled_at)}
            </Text>
            <View style={styles.personaRow}>
              <View style={styles.personaAvatar}>
                <Text style={styles.personaInitial}>
                  {beneficiary.ai_persona_name[0]}
                </Text>
              </View>
              <Text style={styles.personaName}>
                avec {beneficiary.ai_persona_name}
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.noCallText}>
            Aucun appel planifié pour l'instant.
          </Text>
        )}
      </View>

      {/* Bouton rappeler maintenant */}
      <TouchableOpacity
        style={styles.callNowButton}
        onPress={handleCallNow}
        activeOpacity={0.85}
        accessibilityLabel={`Appeler ${beneficiary.ai_persona_name} maintenant`}
        accessibilityRole="button"
      >
        <Text style={styles.callNowIcon}>📞</Text>
        <Text style={styles.callNowText}>
          Appeler {beneficiary.ai_persona_name} maintenant
        </Text>
      </TouchableOpacity>

      {/* Message rassurant */}
      <Text style={styles.tagline}>La présence qui réchauffe ♡</Text>
    </ScrollView>
  )
}

const BLUE    = '#2D6A9F'
const ORANGE  = '#F4A261'
const CREAM   = '#FFF8F0'
const PALE    = '#E8F4FD'

const styles = StyleSheet.create({
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: CREAM, padding: 32,
  },
  errorText: {
    fontSize: 20, color: '#64748B', textAlign: 'center', lineHeight: 30,
  },
  container: {
    flexGrow: 1, backgroundColor: CREAM,
    paddingBottom: 40,
  },
  header: {
    backgroundColor: BLUE,
    paddingTop: 60, paddingBottom: 30,
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  logoCircle: {
    width: 64, height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  logoText:   { fontSize: 32, color: 'white' },
  appName:    { fontSize: 22, fontWeight: '700', color: 'white', letterSpacing: 2 },

  greetingSection: {
    paddingHorizontal: 28, paddingTop: 32, paddingBottom: 8,
  },
  greeting: {
    fontSize: 28, color: '#334155', lineHeight: 38,
  },
  greetingName: {
    fontSize: 36, fontWeight: '800', color: BLUE,
  },

  callCard: {
    marginHorizontal: 20, marginTop: 20,
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  callCardLabel: {
    fontSize: 16, color: '#94A3B8', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
  },
  callCardTime: {
    fontSize: 26, fontWeight: '800', color: '#1E293B',
    lineHeight: 34, marginBottom: 16,
  },
  noCallText: {
    fontSize: 20, color: '#94A3B8', lineHeight: 28,
  },
  personaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  personaAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: PALE,
    justifyContent: 'center', alignItems: 'center',
  },
  personaInitial: { fontSize: 22, fontWeight: '700', color: BLUE },
  personaName:    { fontSize: 20, color: '#475569', fontWeight: '600' },

  callNowButton: {
    marginHorizontal: 20, marginTop: 24,
    backgroundColor: ORANGE,
    borderRadius: 24,
    paddingVertical: 22, paddingHorizontal: 28,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 14,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
    minHeight: 72,
  },
  callNowIcon: { fontSize: 28 },
  callNowText: {
    fontSize: 22, fontWeight: '800', color: 'white', flexShrink: 1,
  },

  tagline: {
    textAlign: 'center', marginTop: 32,
    fontSize: 18, color: '#94A3B8', fontStyle: 'italic',
  },
})
