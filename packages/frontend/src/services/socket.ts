import { io, Socket } from 'socket.io-client';
import { ChatMessage, AgentConfig } from '../types';

class SocketService {
  private socket: Socket | null = null;
  private roomId: string = 'default';
  private messageHandlers: ((message: ChatMessage) => void)[] = [];

  connect(serverUrl: string = 'http://localhost:3005') {
    if (this.socket && this.socket.connected) {
      console.log('Socket already connected');
      return this.socket;
    }

    this.socket = io(serverUrl);
    
    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.socket?.emit('join-room', this.roomId);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    // Set up chat message handler for all registered callbacks
    this.socket.on('chat-message', (message: ChatMessage) => {
      this.messageHandlers.forEach(handler => handler(message));
    });

    return this.socket;
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.messageHandlers = [];
  }

  sendMessage(message: ChatMessage, config?: AgentConfig) {
    if (!this.socket) {
      console.error('Socket not connected, attempting to reconnect...');
      this.connect();
      return;
    }

    this.socket.emit('chat-message', {
      message,
      roomId: this.roomId,
      config
    });
  }

  onMessage(callback: (message: ChatMessage) => void) {
    // Add to handlers array instead of directly binding to socket
    this.messageHandlers.push(callback);
  }

  offMessage(callback: (message: ChatMessage) => void) {
    // Remove from handlers array
    const index = this.messageHandlers.indexOf(callback);
    if (index > -1) {
      this.messageHandlers.splice(index, 1);
    }
  }

  setRoomId(roomId: string) {
    this.roomId = roomId;
    if (this.socket?.connected) {
      this.socket.emit('join-room', roomId);
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();