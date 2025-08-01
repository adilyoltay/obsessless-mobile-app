// AI Pattern Analysis Edge Function
// Analyzes user compulsion data to identify patterns

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AnalysisRequest {
  userId: string
  timeframe?: number // days
  includeInsights?: boolean
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId, timeframe = 30, includeInsights = true } = await req.json() as AnalysisRequest

    // Validate user
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    
    if (userError || !user || user.id !== userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get compulsion data
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - timeframe)

    const { data: compulsions, error: compError } = await supabase
      .from('compulsions')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true })

    if (compError) throw compError

    // Analyze patterns
    const patterns = analyzePatterns(compulsions || [])

    // Save patterns to database
    for (const pattern of patterns) {
      const { error: patternError } = await supabase
        .from('ai_pattern_analysis')
        .upsert({
          user_id: userId,
          ...pattern,
          updated_at: new Date().toISOString()
        })

      if (patternError) console.error('Error saving pattern:', patternError)
    }

    // Generate insights if requested
    let insights = []
    if (includeInsights) {
      insights = await generateInsights(patterns, userId, supabase)
    }

    // Log telemetry
    await supabase
      .from('ai_telemetry')
      .insert({
        user_id: userId,
        event_type: 'pattern_analysis_completed',
        metadata: {
          compulsion_count: compulsions?.length || 0,
          patterns_found: patterns.length,
          insights_generated: insights.length,
          timeframe
        }
      })

    return new Response(
      JSON.stringify({
        patterns,
        insights,
        metadata: {
          timeframe,
          dataPoints: compulsions?.length || 0,
          analysisDate: new Date().toISOString()
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in ai-patterns function:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

function analyzePatterns(compulsions: any[]): any[] {
  const patterns = []

  // Temporal patterns
  const temporalPattern = analyzeTemporalPatterns(compulsions)
  if (temporalPattern) patterns.push(temporalPattern)

  // Trigger patterns
  const triggerPattern = analyzeTriggerPatterns(compulsions)
  if (triggerPattern) patterns.push(triggerPattern)

  // Severity patterns
  const severityPattern = analyzeSeverityPatterns(compulsions)
  if (severityPattern) patterns.push(severityPattern)

  return patterns
}

function analyzeTemporalPatterns(compulsions: any[]): any {
  // Group by hour of day
  const hourlyDistribution = new Array(24).fill(0)
  
  compulsions.forEach(comp => {
    const hour = new Date(comp.created_at).getHours()
    hourlyDistribution[hour]++
  })

  // Find peak hours
  const avgPerHour = compulsions.length / 24
  const peakHours = hourlyDistribution
    .map((count, hour) => ({ hour, count }))
    .filter(h => h.count > avgPerHour * 1.5)
    .sort((a, b) => b.count - a.count)

  if (peakHours.length === 0) return null

  return {
    pattern_type: 'temporal',
    name: 'Günlük Yoğunlaşma Saatleri',
    description: `Kompulsiyonlarınız en çok saat ${peakHours[0].hour}:00 civarında yoğunlaşıyor`,
    confidence: Math.min(0.95, peakHours[0].count / avgPerHour / 2),
    frequency: compulsions.length,
    severity: calculateAverageSeverity(compulsions),
    triggers: [],
    manifestations: getUniqueTypes(compulsions),
    timeline: {
      firstOccurrence: compulsions[0]?.created_at,
      lastOccurrence: compulsions[compulsions.length - 1]?.created_at,
      peakTimes: peakHours.slice(0, 3).map(h => ({
        start: `${h.hour}:00`,
        end: `${h.hour + 1}:00`,
        intensity: Math.round((h.count / compulsions.length) * 10)
      })),
      averageDuration: calculateAverageDuration(compulsions),
      trend: calculateTrend(compulsions)
    },
    recommendations: [
      'Bu saatlerde alternatif aktiviteler planlayın',
      'Tetikleyici faktörleri bu saatlerde minimize edin'
    ]
  }
}

function analyzeTriggerPatterns(compulsions: any[]): any {
  const triggerCounts = new Map<string, number>()
  
  compulsions.forEach(comp => {
    comp.triggers?.forEach((trigger: string) => {
      triggerCounts.set(trigger, (triggerCounts.get(trigger) || 0) + 1)
    })
  })

  const sortedTriggers = Array.from(triggerCounts.entries())
    .sort((a, b) => b[1] - a[1])

  if (sortedTriggers.length === 0) return null

  const topTrigger = sortedTriggers[0]
  const triggerRate = topTrigger[1] / compulsions.length

  return {
    pattern_type: 'trigger',
    name: 'Baskın Tetikleyici',
    description: `"${topTrigger[0]}" en sık karşılaşılan tetikleyici (%${Math.round(triggerRate * 100)})`,
    confidence: Math.min(0.9, triggerRate * 2),
    frequency: topTrigger[1],
    severity: calculateAverageSeverity(
      compulsions.filter(c => c.triggers?.includes(topTrigger[0]))
    ),
    triggers: sortedTriggers.slice(0, 5).map(t => t[0]),
    manifestations: getUniqueTypes(compulsions),
    timeline: {
      firstOccurrence: compulsions[0]?.created_at,
      lastOccurrence: compulsions[compulsions.length - 1]?.created_at,
      peakTimes: [],
      averageDuration: calculateAverageDuration(compulsions),
      trend: 'stable'
    },
    recommendations: [
      'Bu tetikleyiciyle karşılaştığınızda hazırlıklı olun',
      'Alternatif başa çıkma stratejileri geliştirin'
    ]
  }
}

function analyzeSeverityPatterns(compulsions: any[]): any {
  const recentAvg = calculateAverageSeverity(compulsions.slice(-10))
  const overallAvg = calculateAverageSeverity(compulsions)
  
  let trend = 'stable'
  if (recentAvg > overallAvg * 1.2) trend = 'increasing'
  else if (recentAvg < overallAvg * 0.8) trend = 'decreasing'

  return {
    pattern_type: 'behavioral',
    name: 'Şiddet Eğilimi',
    description: `Kompulsiyon şiddeti ${
      trend === 'increasing' ? 'artış' : 
      trend === 'decreasing' ? 'azalma' : 'stabil'
    } eğiliminde`,
    confidence: 0.8,
    frequency: compulsions.length,
    severity: overallAvg,
    triggers: [],
    manifestations: getUniqueTypes(compulsions),
    timeline: {
      firstOccurrence: compulsions[0]?.created_at,
      lastOccurrence: compulsions[compulsions.length - 1]?.created_at,
      peakTimes: [],
      averageDuration: calculateAverageDuration(compulsions),
      trend
    },
    recommendations: trend === 'increasing' ? [
      'Stres faktörlerini gözden geçirin',
      'Profesyonel destek almayı düşünün'
    ] : trend === 'decreasing' ? [
      'Harika gidiyorsunuz, motivasyonunuzu koruyun',
      'Başarılı stratejilerinizi not edin'
    ] : [
      'Mevcut stratejilerinize devam edin',
      'Küçük iyileştirmeler için fırsatlar arayın'
    ]
  }
}

async function generateInsights(patterns: any[], userId: string, supabase: any): Promise<any[]> {
  const insights = []

  for (const pattern of patterns) {
    const insight = {
      user_id: userId,
      category: mapPatternTypeToCategory(pattern.pattern_type),
      priority: pattern.severity > 7 ? 3 : pattern.severity > 4 ? 2 : 1,
      content: generateInsightContent(pattern),
      confidence: pattern.confidence,
      clinical_relevance: pattern.severity / 10,
      actionable: true,
      actions: pattern.recommendations.map((rec: string, idx: number) => ({
        id: `action_${idx}`,
        label: rec,
        type: 'recommendation',
        data: { pattern_id: pattern.id }
      })),
      related_patterns: [pattern.id],
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 week
    }

    const { data, error } = await supabase
      .from('ai_insights')
      .insert(insight)
      .select()
      .single()

    if (!error && data) {
      insights.push(data)
    }
  }

  return insights
}

// Helper functions
function calculateAverageSeverity(compulsions: any[]): number {
  if (compulsions.length === 0) return 0
  const sum = compulsions.reduce((acc, c) => acc + (c.intensity || 5), 0)
  return sum / compulsions.length
}

function calculateAverageDuration(compulsions: any[]): number {
  if (compulsions.length === 0) return 0
  const sum = compulsions.reduce((acc, c) => acc + (c.duration || 0), 0)
  return sum / compulsions.length
}

function calculateTrend(compulsions: any[]): string {
  if (compulsions.length < 5) return 'stable'
  
  const firstHalf = compulsions.slice(0, Math.floor(compulsions.length / 2))
  const secondHalf = compulsions.slice(Math.floor(compulsions.length / 2))
  
  const firstAvg = calculateAverageSeverity(firstHalf)
  const secondAvg = calculateAverageSeverity(secondHalf)
  
  if (secondAvg > firstAvg * 1.2) return 'increasing'
  if (secondAvg < firstAvg * 0.8) return 'decreasing'
  return 'stable'
}

function getUniqueTypes(compulsions: any[]): string[] {
  const types = new Set(compulsions.map(c => c.type).filter(Boolean))
  return Array.from(types)
}

function mapPatternTypeToCategory(patternType: string): string {
  const mapping: Record<string, string> = {
    temporal: 'pattern',
    trigger: 'trigger',
    behavioral: 'pattern',
    emotional: 'pattern'
  }
  return mapping[patternType] || 'pattern'
}

function generateInsightContent(pattern: any): string {
  const contents: Record<string, string> = {
    temporal: `${pattern.name}: ${pattern.description}. Bu saatlerde özel dikkat gösterin.`,
    trigger: `${pattern.name}: ${pattern.description}. Hazırlıklı olmanız başarı şansınızı artırır.`,
    behavioral: `${pattern.name}: ${pattern.description}. ${
      pattern.timeline.trend === 'decreasing' ? 'Tebrikler!' : 'Stratejilerinizi gözden geçirin.'
    }`
  }
  return contents[pattern.pattern_type] || pattern.description
} 