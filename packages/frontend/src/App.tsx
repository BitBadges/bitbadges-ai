import { Menu, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ChatInput } from './components/ChatInput';
import { ChatMessage } from './components/ChatMessage';
import { Sidebar } from './components/Sidebar';
import { useSocket } from './hooks/useSocket';
import { ChatMessage as ChatMessageType } from './types';
import { cn } from './utils/cn';

function App() {
    const [messages, setMessages] = useState<ChatMessageType[]>([]);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const { sendMessage, isConnected: socketConnected } = useSocket(
        (message: ChatMessageType) => {
            setMessages((prev) => [...prev, message]);
        }
    );

    useEffect(() => {
        setIsConnected(socketConnected());

        // Check connection status periodically
        const interval = setInterval(() => {
            setIsConnected(socketConnected());
        }, 1000);

        return () => clearInterval(interval);
    }, [socketConnected]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = (content: string) => {
        const userMessage: ChatMessageType = {
            id: Date.now().toString(),
            content,
            role: 'user',
            timestamp: new Date(),
        };

        sendMessage(userMessage);
    };

    const clearChat = () => {
        setMessages([]);
    };

    return (
        <div className="flex h-screen bg-gray-100">
            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-bold text-gray-800">
                            BitBadges AI Agent
                        </h1>
                        <div className="flex items-center gap-1">
                            {isConnected ? (
                                <>
                                    <Wifi
                                        size={16}
                                        className="text-green-500"
                                    />
                                    <span className="text-sm text-green-600">
                                        Connected
                                    </span>
                                </>
                            ) : (
                                <>
                                    <WifiOff
                                        size={16}
                                        className="text-red-500"
                                    />
                                    <span className="text-sm text-red-600">
                                        Disconnected
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={clearChat}
                            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                        >
                            Clear Chat
                        </button>
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                        >
                            <Menu size={20} />
                        </button>
                    </div>
                </header>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center max-w-md">
                                <h2 className="text-2xl font-bold text-gray-700 mb-4">
                                    Welcome to BitBadges AI
                                </h2>
                                <p className="text-gray-600 mb-6">
                                    I'm your autonomous AI agent for interacting
                                    with the BitBadges blockchain. I can help
                                    you with badge queries, HTTP requests, and
                                    more.
                                </p>
                                <div className="bg-blue-50 p-4 rounded-lg text-left">
                                    <h3 className="font-semibold text-blue-800 mb-2">
                                        Try these commands:
                                    </h3>
                                    <div className="space-y-1 text-sm font-mono text-blue-700">
                                        <div>/wallet balance</div>
                                        <div>/help</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        messages.map((message) => (
                            <ChatMessage key={message.id} message={message} />
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <ChatInput
                    onSendMessage={handleSendMessage}
                    disabled={!isConnected}
                    placeholder={
                        isConnected
                            ? 'Type your message or use /command...'
                            : 'Connecting to server...'
                    }
                />
            </div>

            {/* Sidebar */}
            <div
                className={cn(
                    'lg:w-80 transition-all duration-300',
                    sidebarOpen ? 'block' : 'hidden lg:block'
                )}
            >
                <Sidebar
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                />
            </div>
        </div>
    );
}

export default App;
