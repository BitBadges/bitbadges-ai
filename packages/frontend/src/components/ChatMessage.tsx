import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Bot, User, AlertCircle, CheckCircle } from 'lucide-react';
import { ChatMessage as ChatMessageType } from '../types';
import { cn } from '../utils/cn';

interface ChatMessageProps {
    message: ChatMessageType;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';
    const isCommand = message.metadata?.command;
    const hasError = message.metadata?.error;

    return (
        <div
            className={cn(
                'flex gap-3 p-4 rounded-lg animate-slide-up',
                isUser ? 'bg-bitbadges-50 ml-8' : 'bg-gray-50 mr-8',
                isSystem && 'bg-yellow-50 mx-0',
                hasError && 'bg-red-50'
            )}
        >
            <div className="flex-shrink-0">
                {isUser ? (
                    <div className="w-8 h-8 bg-bitbadges-500 rounded-full flex items-center justify-center">
                        <User size={16} className="text-white" />
                    </div>
                ) : (
                    <div
                        className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center',
                            hasError ? 'bg-red-500' : 'bg-gray-700'
                        )}
                    >
                        {hasError ? (
                            <AlertCircle size={16} className="text-white" />
                        ) : (
                            <Bot size={16} className="text-white" />
                        )}
                    </div>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">
                        {isUser ? 'You' : isSystem ? 'System' : 'BitBadges AI'}
                    </span>
                    {isCommand && (
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                            Command
                        </span>
                    )}
                    {message.metadata?.commandResult?.success && (
                        <CheckCircle size={14} className="text-green-500" />
                    )}
                    <span className="text-xs text-gray-500">
                        {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                </div>

                <div className="prose prose-sm max-w-none">
                    <ReactMarkdown
                        components={{
                            code({
                                node,
                                inline,
                                className,
                                children,
                                ...props
                            }: any) {
                                const match = /language-(\w+)/.exec(
                                    className || ''
                                );
                                const language = match ? match[1] : '';

                                if (!inline && language) {
                                    return (
                                        <SyntaxHighlighter
                                            style={oneDark as any}
                                            language={language}
                                            PreTag="div"
                                            className="rounded-md"
                                            {...props}
                                        >
                                            {String(children).replace(
                                                /\n$/,
                                                ''
                                            )}
                                        </SyntaxHighlighter>
                                    );
                                }

                                return (
                                    <code
                                        className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono"
                                        {...props}
                                    >
                                        {children}
                                    </code>
                                );
                            },
                        }}
                    >
                        {message.content}
                    </ReactMarkdown>
                </div>

                {message.metadata?.commandResult?.data && (
                    <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                            View Raw Data
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                            {JSON.stringify(
                                message.metadata.commandResult.data,
                                null,
                                2
                            )}
                        </pre>
                    </details>
                )}
            </div>
        </div>
    );
};
