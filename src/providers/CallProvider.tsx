import { CallEvent, useCallSignaling } from '@/hooks/useCallSignaling';
import { callStore } from '@/store/callStore';
import { userStore } from '@/store/userStore';
import { useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import {
    createContext,
    PropsWithChildren,
    useCallback,
    useContext,
    useRef,
    useState,
} from 'react';

// ─── Context Shape ───────────────────────────────────────────────────
type IncomingCallData = {
    callId: string;
    channelId: string;
    callerId: string;
    callerName: string;
    callerAvatar: string | null;
};

type CallContextType = {
    /** Currently ringing incoming call (null = no incoming call) */
    incomingCall: IncomingCallData | null;
    /** Whether the current user is currently in an active call */
    isInCall: boolean;
    /** Initiate a call to another user */
    startCall: (channelId: string, recipientId: string, recipientName: string, recipientAvatar: string | null) => Promise<void>;
    /** Accept the incoming call */
    acceptIncomingCall: () => Promise<void>;
    /** Reject the incoming call */
    rejectIncomingCall: () => Promise<void>;
    /** End the current active call */
    endActiveCall: (duration: number) => Promise<void>;
    /** Dismiss missed call overlay */
    dismissIncomingCall: () => void;
};

const CallContext = createContext<CallContextType | null>(null);


export function CallProvider({ children }: PropsWithChildren) {
    const { user } = useUser();
    const router = useRouter();
    const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
    const [isInCall, setIsInCall] = useState(false);

    // Track the active call details for ending/saving
    const activeCallRef = useRef<{
        callId: string;
        channelId: string;
        recipientId: string;
        recipientName: string;
        recipientAvatar: string | null;
        startTime: number;
        isOutgoing: boolean;
    } | null>(null);

    // ─── Handle incoming signaling events ────────────────────────────
    const handleCallEvent = useCallback(
        async (event: CallEvent) => {
            switch (event.type) {
                case 'incoming_call': {
                    // Don't show if already in a call
                    if (isInCall) {
                        console.log('📞 Ignoring incoming call — already in a call');
                        return;
                    }
                    console.log('📞 Incoming call from:', event.callerName);
                    setIncomingCall({
                        callId: event.callId,
                        channelId: event.channelId,
                        callerId: event.callerId,
                        callerName: event.callerName,
                        callerAvatar: event.callerAvatar,
                    });
                    break;
                }

                case 'call_accepted': {
                    console.log('📞 Call accepted by:', event.acceptedBy);
                    // The other user accepted — we're already on AudioCallScreen, 
                    // so the ZegoCloud component will auto-connect them.
                    setIsInCall(true);
                    if (activeCallRef.current) {
                        activeCallRef.current.startTime = Date.now();
                    }
                    break;
                }

                case 'call_rejected': {
                    console.log('📞 Call rejected by:', event.rejectedBy);
                    // Save as rejected call
                    if (activeCallRef.current) {
                        const me = await userStore.getMyDetails();
                        await callStore.addCall({
                            id: event.callId,
                            channelId: activeCallRef.current.channelId,
                            callerId: user?.id || '',
                            callerName: me?.full_name || me?.first_name || 'Me',
                            callerAvatar: me?.avatar_url || null,
                            receiverId: activeCallRef.current.recipientId,
                            receiverName: activeCallRef.current.recipientName,
                            receiverAvatar: activeCallRef.current.recipientAvatar,
                            startedAt: new Date().toISOString(),
                            endedAt: new Date().toISOString(),
                            duration: 0,
                            status: 'rejected',
                            isOutgoing: true,
                        });
                    }
                    setIsInCall(false);
                    activeCallRef.current = null;
                    router.back();
                    break;
                }

                case 'call_ended': {
                    console.log('📞 Call ended by:', event.endedBy);
                    setIsInCall(false);
                    activeCallRef.current = null;
                    break;
                }
            }
        },
        [isInCall, user?.id, router]
    );

    // Connect the signaling hook
    const { sendCallInvite, acceptCall, rejectCall, endCall } = useCallSignaling(handleCallEvent);

    // ─── Start a call (caller side) ─────────────────────────────────
    const startCall = useCallback(
        async (channelId: string, recipientId: string, recipientName: string, recipientAvatar: string | null) => {
            const callId = `call_${channelId}_${Date.now()}`;
            const me = await userStore.getMyDetails();
            const myName = me?.full_name || me?.first_name || 'Unknown';
            const myAvatar = me?.avatar_url || null;

            // Track active call
            activeCallRef.current = {
                callId,
                channelId,
                recipientId,
                recipientName,
                recipientAvatar,
                startTime: Date.now(),
                isOutgoing: true,
            };

            // Send the invite to the other user
            await sendCallInvite(recipientId, callId, channelId, myName, myAvatar);

            setIsInCall(true);

            // Navigate to the call screen
            router.push({
                pathname: '/chat/AudioCallScreen',
                params: {
                    callId,
                    channelId,
                    recipientId,
                    recipientName,
                    recipientAvatar: recipientAvatar || '',
                },
            });
        },
        [sendCallInvite, router]
    );

    // ─── Accept incoming call (receiver side) ────────────────────────
    const acceptIncomingCall = useCallback(async () => {
        if (!incomingCall) return;

        const me = await userStore.getMyDetails();

        // Track active call
        activeCallRef.current = {
            callId: incomingCall.callId,
            channelId: incomingCall.channelId,
            recipientId: incomingCall.callerId,
            recipientName: incomingCall.callerName,
            recipientAvatar: incomingCall.callerAvatar,
            startTime: Date.now(),
            isOutgoing: false,
        };

        // Notify the caller that we accepted
        await acceptCall(incomingCall.callerId, incomingCall.callId);

        setIsInCall(true);
        setIncomingCall(null);

        // Navigate to call screen with the same callId
        router.push({
            pathname: '/chat/AudioCallScreen',
            params: {
                callId: incomingCall.callId,
                channelId: incomingCall.channelId,
                recipientId: incomingCall.callerId,
                recipientName: incomingCall.callerName,
                recipientAvatar: incomingCall.callerAvatar || '',
            },
        });
    }, [incomingCall, acceptCall, router]);

    // ─── Reject incoming call (receiver side) ────────────────────────
    const rejectIncomingCall = useCallback(async () => {
        if (!incomingCall) return;

        await rejectCall(incomingCall.callerId, incomingCall.callId);

        // Save as missed call (from receiver's perspective)
        const me = await userStore.getMyDetails();
        await callStore.addCall({
            id: incomingCall.callId,
            channelId: incomingCall.channelId,
            callerId: incomingCall.callerId,
            callerName: incomingCall.callerName,
            callerAvatar: incomingCall.callerAvatar,
            receiverId: user?.id || '',
            receiverName: me?.full_name || me?.first_name || 'Me',
            receiverAvatar: me?.avatar_url || null,
            startedAt: new Date().toISOString(),
            endedAt: new Date().toISOString(),
            duration: 0,
            status: 'rejected',
            isOutgoing: false,
        });

        setIncomingCall(null);
    }, [incomingCall, rejectCall, user?.id]);

    // ─── End active call ─────────────────────────────────────────────
    const endActiveCall = useCallback(
        async (duration: number) => {
            if (!activeCallRef.current) return;

            const { callId, channelId, recipientId, recipientName, recipientAvatar, isOutgoing, startTime } = activeCallRef.current;
            const me = await userStore.getMyDetails();

            // Notify the other user
            await endCall(recipientId, callId, duration);

            // Save to call history
            await callStore.addCall({
                id: callId,
                channelId,
                callerId: isOutgoing ? (user?.id || '') : recipientId,
                callerName: isOutgoing ? (me?.full_name || me?.first_name || 'Me') : recipientName,
                callerAvatar: isOutgoing ? (me?.avatar_url || null) : recipientAvatar,
                receiverId: isOutgoing ? recipientId : (user?.id || ''),
                receiverName: isOutgoing ? recipientName : (me?.full_name || me?.first_name || 'Me'),
                receiverAvatar: isOutgoing ? recipientAvatar : (me?.avatar_url || null),
                startedAt: new Date(startTime).toISOString(),
                endedAt: new Date().toISOString(),
                duration,
                status: isOutgoing ? 'outgoing' : 'answered',
                isOutgoing,
            });

            setIsInCall(false);
            activeCallRef.current = null;
        },
        [endCall, user?.id]
    );

    const dismissIncomingCall = useCallback(() => {
        setIncomingCall(null);
    }, []);

    return (
        <CallContext.Provider
            value={{
                incomingCall,
                isInCall,
                startCall,
                acceptIncomingCall,
                rejectIncomingCall,
                endActiveCall,
                dismissIncomingCall,
            }}
        >
            {children}
        </CallContext.Provider>
    );
}

export function useCall() {
    const ctx = useContext(CallContext);
    if (!ctx) throw new Error('useCall must be used within a CallProvider');
    return ctx;
}
