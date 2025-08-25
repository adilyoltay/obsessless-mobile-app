// ✅ F-05 FIX: Edge Function for server-side audio temp cleanup
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role for admin operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🧹 Starting audio-temp cleanup process...');

    // List files in audio-temp bucket
    const { data: files, error: listError } = await supabase.storage
      .from('audio-temp')
      .list('', { limit: 1000 });

    if (listError) {
      console.error('❌ Failed to list audio-temp files:', listError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to list files',
          details: listError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!files || files.length === 0) {
      console.log('✅ No files found in audio-temp bucket');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No files to clean',
          deleted: 0 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Filter files older than 48 hours (configurable via query param)
    const hoursOld = parseInt(new URL(req.url).searchParams.get('hours') ?? '48', 10);
    const threshold = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
    
    console.log(`🔍 Checking for files older than ${hoursOld} hours (before ${threshold.toISOString()})`);

    const filesToDelete = files.filter(file => {
      const fileDate = new Date(file.created_at || file.updated_at || Date.now());
      const isOld = fileDate < threshold;
      
      if (isOld) {
        console.log(`📋 Marking for deletion: ${file.name} (created: ${fileDate.toISOString()})`);
      }
      
      return isOld;
    }).map(file => file.name);

    if (filesToDelete.length === 0) {
      console.log(`✅ No files older than ${hoursOld} hours found`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `No files older than ${hoursOld} hours`,
          deleted: 0,
          totalFiles: files.length 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`🗑️ Deleting ${filesToDelete.length} old files...`);

    // Delete old files
    const { error: deleteError } = await supabase.storage
      .from('audio-temp')
      .remove(filesToDelete);

    if (deleteError) {
      console.error('❌ Failed to delete some files:', deleteError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to delete files',
          details: deleteError.message,
          attempted: filesToDelete.length
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`✅ Successfully deleted ${filesToDelete.length} old files`);

    // Log cleanup stats
    const stats = {
      success: true,
      deleted: filesToDelete.length,
      totalFiles: files.length,
      hoursThreshold: hoursOld,
      timestamp: new Date().toISOString(),
      deletedFiles: filesToDelete.slice(0, 10) // First 10 for logging
    };

    return new Response(
      JSON.stringify(stats),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Unexpected error in cleanup function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Unexpected error',
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
