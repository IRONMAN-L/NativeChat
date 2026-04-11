// Setup type definitions for built-in Supabase Runtime APIs
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.info('server started');

Deno.serve(async (req: Request) => {
  try {
    // Gateway already verifies the anon key via "Verify JWT with legacy secret"
    // No need for getUser() — sender_id comes from the trusted client payload

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!  // Service role = bypass RLS for inserts
    );

    const { ciphertext, channelId, recipient_user_id, sender_id } = await req.json();

    // Validate required fields
    if (!ciphertext || !channelId || !recipient_user_id || !sender_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: ciphertext, channelId, recipient_user_id, sender_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Insert message using sender_id from the body
    const { data: msgData, error: msgError } = await supabase
      .from('messages')
      .insert({
        channel_id: channelId,
        user_id: sender_id
      })
      .select()
      .single();

    if (!msgData || msgError) {
      return new Response(
        JSON.stringify({ error: `Unable to insert message: ${msgError?.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { error: msgRecipientError } = await supabase.from('message_recipients')
      .insert({
        recipient_user_id: recipient_user_id,
        ciphertext,
        message_id: msgData.id,
        sender_id: sender_id,
        channel_id: channelId
      });

    if (msgRecipientError) {
      return new Response(
        JSON.stringify({ error: `Unable to send reply: ${msgRecipientError.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
