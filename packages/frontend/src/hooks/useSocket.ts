import { useEffect, useCallback, useRef } from 'react';
import { socketService } from '../services/socket';
import { ChatMessage, AgentConfig } from '../types';

export const useSocket = (
    onMessage: (message: ChatMessage) => void,
    serverUrl?: string
) => {
    const onMessageRef = useRef(onMessage);
    onMessageRef.current = onMessage;

    useEffect(() => {
        const messageHandler = (message: ChatMessage) => {
            onMessageRef.current(message);
        };

        socketService.onMessage(messageHandler);

        return () => {
            socketService.offMessage(messageHandler);
            socketService.disconnect();
        };
    }, [serverUrl]);

    const sendMessage = useCallback(
        (message: ChatMessage, config?: AgentConfig) => {
            try {
                socketService.sendMessage(message, config);
            } catch (error) {
                console.error('Failed to send message:', error);
            }
        },
        []
    );

    const isConnected = useCallback(() => {
        return socketService.isConnected();
    }, []);

    return {
        sendMessage,
        isConnected,
        setRoomId: socketService.setRoomId.bind(socketService),
    };
};
