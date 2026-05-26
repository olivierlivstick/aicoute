import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { ConversationMemory, MemoryType } from '@modect/shared'

export function useMemories(beneficiaryId?: string) {
  const [memories, setMemories] = useState<ConversationMemory[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!beneficiaryId) { setLoading(false); return }
    setLoading(true)
    try {
      const { data, error: err } = await supabase
        .from('conversation_memory')
        .select('*')
        .eq('beneficiary_id', beneficiaryId)
        .order('importance', { ascending: false })
      if (err) setError(err.message)
      else setMemories(data as ConversationMemory[])
    } finally {
      setLoading(false)
    }
  }, [beneficiaryId])

  useEffect(() => { fetch() }, [fetch])

  const addMemory = useCallback(async (
    payload: { memory_type: MemoryType; content: string; importance: number }
  ): Promise<boolean> => {
    if (!beneficiaryId) return false
    const { error: err } = await supabase
      .from('conversation_memory')
      .insert({ beneficiary_id: beneficiaryId, ...payload })
    if (err) { setError(err.message); return false }
    await fetch()
    return true
  }, [beneficiaryId, fetch])

  const updateMemory = useCallback(async (
    id: string,
    updates: Partial<Pick<ConversationMemory, 'content' | 'importance' | 'memory_type'>>
  ): Promise<boolean> => {
    const { error: err } = await supabase
      .from('conversation_memory')
      .update(updates)
      .eq('id', id)
    if (err) { setError(err.message); return false }
    setMemories((prev) => prev.map((m) => m.id === id ? { ...m, ...updates } : m))
    return true
  }, [])

  const deleteMemory = useCallback(async (id: string): Promise<boolean> => {
    const { error: err } = await supabase
      .from('conversation_memory')
      .delete()
      .eq('id', id)
    if (err) { setError(err.message); return false }
    setMemories((prev) => prev.filter((m) => m.id !== id))
    return true
  }, [])

  return { memories, loading, error, addMemory, updateMemory, deleteMemory, refetch: fetch }
}
