import { io, Socket } from 'socket.io-client';
import { ChatMessage, AgentConfig } from '../types';

class SocketService {
  private socket: Socket | null = null;
  private roomId: string = 'default';

  connect(serverUrl: string = 'http://localhost:3005') {
    this.socket = io(serverUrl);
    
    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.socket?.emit('join-room', this.roomId);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    return this.socket;
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  sendMessage(message: ChatMessage, config?: AgentConfig) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    this.socket.emit('chat-message', {
      message,
      roomId: this.roomId,
      config
    });
  }

  onMessage(callback: (message: ChatMessage) => void) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    this.socket.on('chat-message', callback);
  }

  offMessage(callback: (message: ChatMessage) => void) {
    if (!this.socket) {
      return;
    }

    this.socket.off('chat-message', callback);
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