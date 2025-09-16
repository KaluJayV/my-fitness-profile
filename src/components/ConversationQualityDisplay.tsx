import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, 
  MessageSquare, 
  Target, 
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Lightbulb
} from 'lucide-react';

interface ConversationQualityDisplayProps {
  quality: {
    score: number;
    factors: {
      depth: number;
      relevance: number;
      engagement: number;
      clarity: number;
    };
    suggestions: string[];
    shouldContinue: boolean;
    reasoning?: string;
  } | null;
  isVisible: boolean;
}

export const ConversationQualityDisplay: React.FC<ConversationQualityDisplayProps> = ({ 
  quality, 
  isVisible 
}) => {
  const [showDetails, setShowDetails] = useState(false);

  if (!isVisible || !quality) return null;

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 bg-green-50';
    if (score >= 6) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 8) return CheckCircle2;
    if (score >= 6) return AlertTriangle;
    return AlertTriangle;
  };

  const ScoreIcon = getScoreIcon(quality.score);

  return (
    <Card className="mb-4 border-l-4 border-l-primary">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Conversation Quality</span>
            <Badge 
              variant="outline" 
              className={`${getScoreColor(quality.score)} border-none`}
            >
              <ScoreIcon className="h-3 w-3 mr-1" />
              {quality.score}/10
            </Badge>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showDetails ? 'Hide' : 'Show'} Details
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <Progress 
            value={quality.score * 10} 
            className="h-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Poor</span>
            <span>Good</span>
            <span>Excellent</span>
          </div>
        </div>

        {/* Quality Factors - Always Visible */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {Object.entries(quality.factors).map(([factor, score]) => (
            <div key={factor} className="flex items-center gap-2">
              <div className="flex-1">
                <div className="flex justify-between text-xs">
                  <span className="capitalize">{factor}</span>
                  <span>{score}/10</span>
                </div>
                <Progress value={score * 10} className="h-1" />
              </div>
            </div>
          ))}
        </div>

        {/* Detailed Information */}
        {showDetails && (
          <div className="space-y-3 pt-3 border-t">
            {/* Continue Recommendation */}
            <div className="flex items-start gap-2">
              <Target className="h-4 w-4 mt-0.5 text-blue-500" />
              <div>
                <div className="font-medium text-sm mb-1">
                  Recommendation: {quality.shouldContinue ? 'Continue Conversation' : 'Ready for Program'}
                </div>
                {quality.reasoning && (
                  <p className="text-xs text-muted-foreground">{quality.reasoning}</p>
                )}
              </div>
            </div>

            {/* Suggestions */}
            {quality.suggestions && quality.suggestions.length > 0 && (
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 mt-0.5 text-yellow-500" />
                <div>
                  <div className="font-medium text-sm mb-1">AI Suggestions</div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {quality.suggestions.slice(0, 3).map((suggestion, index) => (
                      <li key={index} className="flex items-start gap-1">
                        <span className="text-primary">•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};