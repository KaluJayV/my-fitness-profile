import React, { useState, useRef, useCallback, forwardRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Send, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ChatInputProps {
  onSend: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
  isProcessing?: boolean;
}

export const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(
  ({ onSend, placeholder = "Type your message...", disabled = false, isProcessing = false }, ref) => {
    const [inputValue, setInputValue] = useState('');
    const [isListening, setIsListening] = useState(false);
    const { toast } = useToast();
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputValue(e.target.value);
    }, []);

    const handleSubmit = useCallback(() => {
      if (!inputValue.trim() || disabled || isProcessing) return;
      
      onSend(inputValue.trim());
      setInputValue('');
    }, [inputValue, onSend, disabled, isProcessing]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    }, [handleSubmit]);

    const startVoiceRecording = useCallback(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          await processVoiceInput(audioBlob);
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsListening(true);
      } catch (error) {
        console.error('Error starting voice recording:', error);
        toast({
          title: "Error",
          description: "Could not access microphone",
          variant: "destructive",
        });
      }
    }, [toast]);

    const stopVoiceRecording = useCallback(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        setIsListening(false);
      }
    }, []);

    const processVoiceInput = useCallback(async (audioBlob: Blob) => {
      try {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          
          const { data, error } = await supabase.functions.invoke('voice-to-text', {
            body: { audio: base64Audio }
          });

          if (error) throw error;

          setInputValue(data.text);
          
          toast({
            title: "Voice Transcribed",
            description: "Your voice input is ready to send",
          });
        };
        reader.readAsDataURL(audioBlob);
      } catch (error) {
        console.error('Error processing voice input:', error);
        toast({
          title: "Error",
          description: "Failed to process voice input",
          variant: "destructive",
        });
      }
    }, [toast]);

    const handleVoiceToggle = useCallback(() => {
      if (isListening) {
        stopVoiceRecording();
      } else {
        startVoiceRecording();
      }
    }, [isListening, startVoiceRecording, stopVoiceRecording]);

    return (
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={ref}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isProcessing}
            className="min-h-[60px] pr-12 resize-none"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant={isListening ? "destructive" : "outline"}
            size="icon"
            onClick={handleVoiceToggle}
            disabled={disabled || isProcessing}
            className="h-[60px] w-12"
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!inputValue.trim() || disabled || isProcessing}
            className="h-[60px] w-12"
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    );
  }
);

ChatInput.displayName = "ChatInput";