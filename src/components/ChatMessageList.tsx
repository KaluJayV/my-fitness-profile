import React, { useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Bot, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface ChatMessage {
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  workout?: any;
}

interface ChatMessageListProps {
  messages: ChatMessage[];
  isProcessing?: boolean;
}

const MessageBubble = React.memo(({ message }: { message: ChatMessage }) => {
  const isUser = message.type === 'user';
  const isSystem = message.type === 'system';

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            {isSystem ? <Bot className="h-4 w-4 text-primary-foreground" /> : <Bot className="h-4 w-4 text-primary-foreground" />}
          </div>
        </div>
      )}
      
      <div className={`flex-1 max-w-[80%] ${isUser ? 'order-first' : ''}`}>
        <Card className={isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}>
          <CardContent className="p-3">
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            <p className={`text-xs mt-2 opacity-70 ${isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
              {format(message.timestamp, 'HH:mm')}
            </p>
          </CardContent>
        </Card>
      </div>

      {isUser && (
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
            <User className="h-4 w-4 text-secondary-foreground" />
          </div>
        </div>
      )}
    </div>
  );
});

MessageBubble.displayName = "MessageBubble";

export const ChatMessageList = React.memo<ChatMessageListProps>(({ messages, isProcessing = false }) => {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  return (
    <div className="flex-1 overflow-hidden">
      <div className="h-full overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <MessageBubble key={`${message.timestamp.getTime()}-${index}`} message={message} />
        ))}
        
        {isProcessing && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
            </div>
            <div className="flex-1 max-w-[80%]">
              <Card className="bg-muted">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
        
        <div ref={chatEndRef} />
      </div>
    </div>
  );
});

ChatMessageList.displayName = "ChatMessageList";