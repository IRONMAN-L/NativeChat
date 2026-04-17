import { useSupabase } from '@/providers/SupabaseProvider';
import { useUser } from '@clerk/clerk-expo';
import { useCallback, useEffect, useRef } from 'react';

// ─── Event Types ─────────────────────────────────────────────────────
// These are the different "messages" two users send each other over Supabase
// Realtime broadcast to coordinate a call.
export type CallEvent =
    | {
        type: 'incoming_call';
        callId: string;        // The ZegoCloud room both users will join
        channelId: string;     // Which chat channel this call is for
        callerId: string;      // Who is calling
        callerName: string;
        callerAvatar: string | null;
    }
    | {
        type: 'call_accepted';
        callId: string;
        acceptedBy: string;    // Who accepted (the receiver)
    }
    | {
        type: 'call_rejected';
        callId: string;
        rejectedBy: string;
    }
    | {
        type: 'call_ended';
        callId: string;
        endedBy: string;
        duration: number;      // How many seconds the call lasted
    };

type CallEventListener = (event: CallEvent) => void;

export function useCallSignaling(onEvent: CallEventListener) {
    const { supabase, isSupabaseReady } = useSupabase();
    const { user } = useUser();
    const listenerRef = useRef(onEvent);

    // Keep the callback ref fresh without causing re-subscriptions
    useEffect(() => {
        listenerRef.current = onEvent;
    }, [onEvent]);

    // ─── Subscribe to MY personal call channel ──────────────────────
    useEffect(() => {
        if (!isSupabaseReady || !user?.id) return;

        const myChannelName = `calls:${user.id}`;

        // Clean up any existing channel with the same name
        const existing = supabase.getChannels().find((c: any) => c.topic === `realtime:${myChannelName}`);
        if (existing) {
            supabase.removeChannel(existing);
        }

        const channel = supabase
            .channel(myChannelName)
            .on('broadcast', { event: 'call_signal' }, (payload) => {
                // payload.payload contains our CallEvent
                const event = payload.payload as CallEvent;
                console.log('📞 Call signal received:', event.type);
                listenerRef.current(event);
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('📞 Listening for incoming calls...');
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isSupabaseReady, user?.id, supabase]);

    // ─── Send a call event TO another user ──────────────────────────
    const sendCallEvent = useCallback(
        async (targetUserId: string, event: CallEvent) => {
            if (!isSupabaseReady) return;

            const targetChannelName = `calls:${targetUserId}`;

            // Create a temporary channel to the target user, send, then clean up
            const channel = supabase.channel(targetChannelName);

            // We need to subscribe before we can send
            await new Promise<void>((resolve) => {
                channel.subscribe((status) => {
                    if (status === 'SUBSCRIBED') resolve();
                });
            });

            // Send the event
            await channel.send({
                type: 'broadcast',
                event: 'call_signal',
                payload: event,
            });

            console.log(`📞 Sent ${event.type} to ${targetUserId}`);

            // Clean up the temporary channel
            supabase.removeChannel(channel);
        },
        [isSupabaseReady, supabase]
    );

    // ─── Convenience methods ────────────────────────────────────────
    const sendCallInvite = useCallback(
        async (targetUserId: string, callId: string, channelId: string, callerName: string, callerAvatar: string | null) => {
            await sendCallEvent(targetUserId, {
                type: 'incoming_call',
                callId,
                channelId,
                callerId: user?.id || '',
                callerName,
                callerAvatar,
            });
        },
        [sendCallEvent, user?.id]
    );

    const acceptCall = useCallback(
        async (callerId: string, callId: string) => {
            await sendCallEvent(callerId, {
                type: 'call_accepted',
                callId,
                acceptedBy: user?.id || '',
            });
        },
        [sendCallEvent, user?.id]
    );

    const rejectCall = useCallback(
        async (callerId: string, callId: string) => {
            await sendCallEvent(callerId, {
                type: 'call_rejected',
                callId,
                rejectedBy: user?.id || '',
            });
        },
        [sendCallEvent, user?.id]
    );

    const endCall = useCallback(
        async (targetUserId: string, callId: string, duration: number) => {
            await sendCallEvent(targetUserId, {
                type: 'call_ended',
                callId,
                endedBy: user?.id || '',
                duration,
            });
        },
        [sendCallEvent, user?.id]
    );

    return { sendCallInvite, acceptCall, rejectCall, endCall };
}
