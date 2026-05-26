/**
 * Écran historique des appels (simplifié, accessible senior)
 */
import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, StatusBar,
} from 'react-native'
import { supabase } from '@/lib/supabase'
import { useBeneficiarySession } from '@/hooks/useBeneficiarySession'
import type { Call } from '@modect/shared'

const MOOD_EMOJI: Record<string, string> = {
  positive:  '😊',
  neutral:   '😐',
  concerned: '😟',
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  completed: { label: 'Terminé',   color: '#16A34A' },
  missed:    { label: 'Manqué',    color: '#DC2626' },
  failed:    { label: 'Échoué',    color: '#DC2626' },
  scheduled: { label: 'Planifié',  color: '#2D6A9F' },
}

const MOIS = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc']

function formatCallDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getDate()} ${MOIS[d.getMonth()]} · ${d.getHours().toString().padStart(2,'0')}h${d.getMinutes().toString().padStart(2,'0')}`
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s === 0 ? `${m} min` : `${m} min ${s}s`
}

export default function HistoryScreen() {
  const { beneficiary, loading: loadingBen } = useBeneficiarySession()
  const [calls, setCalls]   = useState<Call[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!beneficiary) return

    supabase
      .from('calls')
      .select('*')
      .eq('beneficiary_id', beneficiary.id)
      .order('scheduled_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setCalls((data ?? []) as Call[])
        setLoading(false)
      })
  }, [beneficiary])

  if (loadingBen || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2D6A9F" />
      </View>
    )
  }

  if (calls.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyText}>Aucun appel pour l'instant.</Text>
        <Text style={styles.emptySubtext}>Vos conversations apparaîtront ici.</Text>
      </View>
    )
  }

  const renderCall = ({ item }: { item: Call }) => {
    const status  = STATUS_LABEL[item.status] ?? { label: item.status, color: '#64748B' }
    const mood    = item.mood_detected ? MOOD_EMOJI[item.mood_detected] : null
    const dateStr = formatCallDate(item.ended_at ?? item.scheduled_at)

    return (
      <View style={styles.callCard}>
        {/* Date + humeur */}
        <View style={styles.callRow}>
          <Text style={styles.callDate}>{dateStr}</Text>
          {mood && <Text style={styles.callMood}>{mood}</Text>}
        </View>

        {/* Durée + statut */}
        <View style={styles.callRow}>
          <Text style={styles.callDuration}>
            {formatDuration(item.duration_seconds)}
          </Text>
          <Text style={[styles.callStatus, { color: status.color }]}>
            {status.label}
          </Text>
        </View>

        {/* Résumé si disponible */}
        {item.summary && (
          <Text style={styles.callSummary} numberOfLines={3}>
            {item.summary}
          </Text>
        )}

        {/* Tags thèmes */}
        {item.key_topics && item.key_topics.length > 0 && (
          <View style={styles.tagsRow}>
            {item.key_topics.slice(0, 4).map((t, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Alerte si présente */}
        {item.alerts && item.alerts.length > 0 && (
          <View style={styles.alertRow}>
            <Text style={styles.alertText}>⚠️ {item.alerts[0]}</Text>
          </View>
        )}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes appels</Text>
        <Text style={styles.headerCount}>{calls.length} conversations</Text>
      </View>

      <FlatList
        data={calls}
        keyExtractor={(item) => item.id}
        renderItem={renderCall}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#FFF8F0', padding: 32,
  },
  emptyIcon:    { fontSize: 52, marginBottom: 16 },
  emptyText:    { fontSize: 22, fontWeight: '700', color: '#334155', textAlign: 'center' },
  emptySubtext: { fontSize: 18, color: '#94A3B8', marginTop: 8, textAlign: 'center' },

  container:    { flex: 1, backgroundColor: '#FFF8F0' },
  header: {
    paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFF8F0',
  },
  headerTitle:   { fontSize: 30, fontWeight: '800', color: '#1E293B' },
  headerCount:   { fontSize: 18, color: '#94A3B8', marginTop: 4 },

  list: { padding: 16, gap: 12 },

  callCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: 8,
  },
  callRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  callDate:     { fontSize: 20, fontWeight: '700', color: '#1E293B' },
  callMood:     { fontSize: 26 },
  callDuration: { fontSize: 18, color: '#64748B' },
  callStatus:   { fontSize: 18, fontWeight: '700' },
  callSummary: {
    fontSize: 17, color: '#475569', lineHeight: 26,
    borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 8,
  },
  tagsRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: '#E8F4FD', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  tagText:  { fontSize: 14, color: '#2D6A9F', fontWeight: '600' },
  alertRow: {
    backgroundColor: '#FFF7ED', borderRadius: 12, padding: 10,
    borderLeftWidth: 3, borderLeftColor: '#F97316',
  },
  alertText: { fontSize: 16, color: '#9A3412' },
})
