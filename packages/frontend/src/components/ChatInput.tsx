import React, { useState, useRef, useEffect } from 'react';
import { Send, Command } from 'lucide-react';
import { cn } from '../utils/cn';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  disabled = false,
  placeholder = 'Type your message or use /command...'
}) => {
  const [message, setMessage] = useState('');
  const [showCommands, setShowCommands] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const commands = [
    { name: '/wallet', description: 'Manage AI agent wallet' },
    { name: '/http', description: 'Make HTTP requests' },
    { name: '/bitbadges', description: 'Interact with BitBadges API' },
    { name: '/code', description: 'Execute code snippets' },
    { name: '/help', description: 'Show available commands' },
  ];

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
      setShowCommands(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);
    
    // Show command suggestions when user types /
    if (value.startsWith('/') && !value.includes(' ')) {
      setShowCommands(true);
    } else {
      setShowCommands(false);
    }
  };

  const insertCommand = (command: string) => {
    setMessage(command + ' ');
    setShowCommands(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="relative">
      {showCommands && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
          <div className="p-2 border-b bg-gray-50">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Command size={14} />
              Available Commands
            </div>
          </div>
          {commands
            .filter(cmd => cmd.name.startsWith(message))
            .map((cmd) => (
              <button
                key={cmd.name}
                onClick={() => insertCommand(cmd.name)}
                className="w-full text-left p-3 hover:bg-gray-50 border-b last:border-b-0"
              >
                <div className="font-mono text-sm text-bitbadges-600">{cmd.name}</div>
                <div className="text-xs text-gray-500">{cmd.description}</div>
              </button>
            ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 p-4 bg-white border-t">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              "w-full px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-bitbadges-500 focus:border-transparent",
              "disabled:bg-gray-50 disabled:text-gray-500",
              "max-h-32 overflow-y-auto"
            )}
          />
        </div>
        
        <button
          type="submit"
          disabled={disabled || !message.trim()}
          className={cn(
            "px-4 py-2 bg-bitbadges-500 text-white rounded-lg hover:bg-bitbadges-600 focus:outline-none focus:ring-2 focus:ring-bitbadges-500 focus:ring-offset-2",
            "disabled:bg-gray-300 disabled:cursor-not-allowed",
            "flex items-center gap-2 transition-colors"
          )}
        >
          <Send size={16} />
          Send
        </button>
      </form>
    </div>
  );
};