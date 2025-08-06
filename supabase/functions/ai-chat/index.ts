// AI Chat Edge Function
// Handles AI chat interactions with OpenAI/Anthropic

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChatRequest {
  message: string
  conversationId?: string
  userId: string
  context?: {
    recentMessages?: any[]
    userProfile?: any
  }
}

interface ChatResponse {
  message: string
  conversationId: string
  metadata: {
    confidence: number
    safety_score: number
    therapeutic_intent?: string[]
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get auth token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY') ?? ''

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request
    const { message, conversationId, userId, context } = await req.json() as ChatRequest

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

    // Get or create conversation
    let convId = conversationId
    if (!convId) {
      const { data: newConv, error: convError } = await supabase
        .from('ai_conversations')
        .insert({
          user_id: userId,
          session_id: `session_${Date.now()}`,
          thread_id: `thread_${Date.now()}`,
          state: 'active'
        })
        .select()
        .single()

      if (convError) throw convError
      convId = newConv.id
    }

    // Save user message
    const { error: msgError } = await supabase
      .from('ai_messages')
      .insert({
        conversation_id: convId,
        role: 'user',
        content: message,
        metadata: { timestamp: new Date().toISOString() }
      })

    if (msgError) throw msgError

    // Get user profile for context
    const { data: userProfile } = await supabase
      .from('user_ai_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    // Prepare AI context
    const systemPrompt = `Sen ObsessLess uygulamasının terapötik AI asistanısın. 
    Kullanıcılarla Türkçe konuş ve OKB (Obsesif Kompulsif Bozukluk) konusunda destek sağla.
    
    Kullanıcı profili:
    - Semptom şiddeti: ${userProfile?.symptom_severity || 'Bilinmiyor'}
    - İletişim stili: ${userProfile?.communication_style || 'supportive'}
    - Terapötik hedefler: ${userProfile?.therapeutic_goals?.join(', ') || 'Belirlenmemiş'}
    
    Kurallar:
    1. Her zaman empatik ve yargılamayan bir dil kullan
    2. Profesyonel tıbbi tavsiye verme, sadece destek ve yönlendirme sağla
    3. Kriz durumlarını tespit et ve uygun kaynakları öner
    4. Bilişsel davranışçı terapi (CBT) ve ERP prensiplerini kullan
    5. Kullanıcıyı motive et ve küçük başarıları kutla`

    // Get recent messages for context
    const { data: recentMessages } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: false })
      .limit(10)

    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentMessages.reverse().map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: message }
    ]

    // Call OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages,
        temperature: 0.7,
        max_tokens: 500,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      }),
    })

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.statusText}`)
    }

    const aiData = await openaiResponse.json()
    const aiMessage = aiData.choices[0].message.content

    // Perform safety check
    const safetyScore = await performSafetyCheck(aiMessage)
    
    // Detect therapeutic intent
    const therapeuticIntent = detectTherapeuticIntent(aiMessage)

    // Save AI response
    const { error: aiMsgError } = await supabase
      .from('ai_messages')
      .insert({
        conversation_id: convId,
        role: 'assistant',
        content: aiMessage,
        metadata: {
          model: 'gpt-4-turbo-preview',
          safety_score: safetyScore,
          therapeutic_intent: therapeuticIntent,
          timestamp: new Date().toISOString()
        }
      })

    if (aiMsgError) throw aiMsgError

    // Check for crisis keywords
    const crisisLevel = await checkForCrisis(message, userId, supabase)
    
    // Log telemetry
    await supabase
      .from('ai_telemetry')
      .insert({
        user_id: userId,
        event_type: 'chat_message_sent',
        metadata: {
          conversation_id: convId,
          message_length: message.length,
          response_length: aiMessage.length,
          crisis_level: crisisLevel
        }
      })

    // Prepare response
    const response: ChatResponse = {
      message: aiMessage,
      conversationId: convId,
      metadata: {
        confidence: 0.9,
        safety_score: safetyScore,
        therapeutic_intent: therapeuticIntent
      }
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in ai-chat function:', error)
    
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

// Helper functions
async function performSafetyCheck(message: string): Promise<number> {
  // Simple safety check - in production, use a proper moderation API
  const unsafeKeywords = ['intihar', 'kendine zarar', 'ölmek']
  const lowerMessage = message.toLowerCase()
  
  for (const keyword of unsafeKeywords) {
    if (lowerMessage.includes(keyword)) {
      return 0.3 // Low safety score
    }
  }
  
  return 0.9 // High safety score
}

function detectTherapeuticIntent(message: string): string[] {
  const intents: string[] = []
  
  if (message.includes('nefes') || message.includes('sakin')) {
    intents.push('relaxation')
  }
  if (message.includes('başar') || message.includes('tebrik')) {
    intents.push('motivation')
  }
  if (message.includes('nasıl') || message.includes('ne yap')) {
    intents.push('guidance')
  }
  if (message.includes('anla') || message.includes('zor')) {
    intents.push('empathy')
  }
  
  return intents
}

async function checkForCrisis(
  message: string, 
  userId: string, 
  supabase: any
): Promise<string> {
  const crisisKeywords = {
    critical: ['intihar', 'kendimi öldür', 'hayatıma son'],
    high: ['kendime zarar', 'dayanamıyorum', 'ölmek istiyorum'],
    moderate: ['çok kötü', 'yardım', 'panik']
  }
  
  const lowerMessage = message.toLowerCase()
  let level = 'none'
  
  // Check keywords
  for (const [severity, keywords] of Object.entries(crisisKeywords)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      level = severity
      break
    }
  }
  
  // Log crisis event if detected
  if (level !== 'none') {
    await supabase
      .from('ai_crisis_events')
      .insert({
        user_id: userId,
        level,
        types: ['text_based'],
        confidence: 0.8,
        triggers: [message.substring(0, 100)], // Truncated for privacy
        message_content: '[REDACTED]',
        actions_taken: [{ type: 'logged', timestamp: new Date().toISOString() }]
      })
  }
  
  return level
} 