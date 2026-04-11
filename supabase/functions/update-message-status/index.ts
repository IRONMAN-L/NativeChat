import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { message_id, recipient_user_id, status, sender_id, channel_id } = await req.json();

    if (!message_id || !recipient_user_id || !status || !sender_id || !channel_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: message_id, recipient_user_id, status, sender_id, channel_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!['delivered', 'read'].includes(status)) {
      return new Response(
        JSON.stringify({ error: 'Invalid status. Must be "delivered" or "read"' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { error } = await supabase
      .from('message_recipients')
      .update({ status })
      .eq('message_id', message_id)
      .eq('recipient_user_id', recipient_user_id);

    if (error) {
      return new Response(
        JSON.stringify({ error: `Failed to update status: ${error.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // // BROADCAST the tick to the sender so their UI updates instantly!
    // const channel = supabase.channel(`user_updates:${sender_id}`);
    // await channel.send({
    //   type: 'broadcast',
    //   event: 'status_update',
    //   payload: { message_id, status, channel_id }
    // });
    // await supabase.removeChannel(channel);

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
