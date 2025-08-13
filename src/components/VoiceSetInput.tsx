import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface VoiceSetInputProps {
  onDataReceived: (data: { weight: number | null; reps: number | null; rir: number | null }) => void;
}

export const VoiceSetInput = ({ onDataReceived }: VoiceSetInputProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = processAudio;
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      
      toast({
        title: "Recording...",
        description: "Speak your set details (e.g., '225 pounds for 8 reps with 2 in reserve')",
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Error",
        description: "Could not access microphone",
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  const processAudio = async () => {
    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        
        try {
          console.log('Sending audio to voice-to-workout-data function...');
          
          const { data, error } = await supabase.functions.invoke('voice-to-workout-data', {
            body: { audio: base64Audio }
          });

          if (error) throw error;

          console.log('Received response:', data);

          if (data.workoutData) {
            onDataReceived(data.workoutData);
            toast({
              title: "Success!",
              description: `Parsed: "${data.transcription}"`,
            });
          } else {
            throw new Error('No workout data received');
          }
        } catch (error) {
          console.error('Error processing audio:', error);
          toast({
            title: "Error",
            description: "Failed to process speech. Try again.",
            variant: "destructive"
          });
        } finally {
          setIsProcessing(false);
        }
      };
      
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Error in processAudio:', error);
      setIsProcessing(false);
      toast({
        title: "Error",
        description: "Failed to process recording",
        variant: "destructive"
      });
    }
  };

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else if (!isProcessing) {
      startRecording();
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isProcessing}
      className="h-8 w-8 p-0"
      title={isRecording ? "Stop recording" : "Record set details"}
    >
      {isProcessing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isRecording ? (
        <MicOff className="h-4 w-4 text-destructive" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
};