import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Brain, 
  TrendingUp, 
  Target, 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  Zap,
  BarChart3
} from 'lucide-react';

interface AIInsightPanelProps {
  userId: string;
  isVisible: boolean;
  onInsightsGenerated?: (insights: any) => void;
}

interface InsightData {
  dominantMovements?: string[];
  weakPoints?: string[];
  strengthLevel?: string;
  preferredVolume?: string;
  consistencyScore?: number;
  stalledExercises?: string[];
  fastProgressors?: string[];
  motivationTriggers?: string[];
  adherencePredictors?: string[];
}

export const AIInsightPanel: React.FC<AIInsightPanelProps> = ({ userId, isVisible, onInsightsGenerated }) => {
  const { toast } = useToast();
  const [insights, setInsights] = useState<Record<string, InsightData>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState('strength');

  const insightTypes = [
    { 
      id: 'strength_profile', 
      label: 'Strength Profile', 
      icon: Activity, 
      tab: 'strength',
      description: 'Your dominant movements and weak points'
    },
    { 
      id: 'training_patterns', 
      label: 'Training Patterns', 
      icon: BarChart3, 
      tab: 'patterns',
      description: 'Your workout habits and preferences' 
    },
    { 
      id: 'progression_gaps', 
      label: 'Progression Analysis', 
      icon: TrendingUp, 
      tab: 'progression',
      description: 'Where you\'re progressing and where you\'re stuck'
    },
    { 
      id: 'personalization_factors', 
      label: 'Personalization', 
      icon: Target, 
      tab: 'personal',
      description: 'What motivates you and improves adherence'
    }
  ];

  const generateInsights = async (type: string) => {
    if (loading[type]) return;
    
    setLoading(prev => ({ ...prev, [type]: true }));
    
    try {
      const { data, error } = await supabase.functions.invoke('workout-insights-engine', {
        body: {
          userId,
          analysisType: type,
          timeframe: 'month'
        }
      });

      if (error) throw error;

      setInsights(prev => ({ ...prev, [type]: data.insights }));
      
      // Notify parent component about new insights
      if (onInsightsGenerated) {
        onInsightsGenerated({ [type]: data.insights });
      }
      
      toast({
        title: "✨ Insights Generated",
        description: `AI analysis complete for ${insightTypes.find(t => t.id === type)?.label}`,
      });

    } catch (error: any) {
      console.error('Error generating insights:', error);
      toast({
        title: "Error",
        description: "Failed to generate insights. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const generateAllInsights = async () => {
    for (const type of insightTypes) {
      await generateInsights(type.id);
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  if (!isVisible) return null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">AI Fitness Insights</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={generateAllInsights}
            disabled={Object.values(loading).some(Boolean)}
          >
            <Zap className="h-4 w-4 mr-2" />
            Generate All Insights
          </Button>
        </div>
        <CardDescription>
          Advanced AI analysis of your training data and patterns
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 mb-4">
            {insightTypes.map(type => (
              <TabsTrigger key={type.tab} value={type.tab} className="flex items-center gap-1">
                <type.icon className="h-3 w-3" />
                <span className="hidden sm:inline">{type.label.split(' ')[0]}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {insightTypes.map(type => (
            <TabsContent key={type.tab} value={type.tab} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <type.icon className="h-4 w-4" />
                    {type.label}
                  </h3>
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateInsights(type.id)}
                  disabled={loading[type.id]}
                >
                  {loading[type.id] ? 'Analyzing...' : 'Generate'}
                </Button>
              </div>

              {loading[type.id] && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Analyzing your data...</span>
                    <span>AI Processing</span>
                  </div>
                  <Progress value={75} className="h-2" />
                </div>
              )}

              {insights[type.id] && (
                <InsightDisplay insight={insights[type.id]} type={type.id} />
              )}

              {!insights[type.id] && !loading[type.id] && (
                <div className="text-center py-8 text-muted-foreground">
                  <type.icon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Click "Generate" to analyze your {type.label.toLowerCase()}</p>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};

const InsightDisplay: React.FC<{ insight: InsightData; type: string }> = ({ insight, type }) => {
  if (type === 'strength_profile') {
    return (
      <div className="space-y-4">
        {insight.strengthLevel && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{insight.strengthLevel}</Badge>
            <span className="text-sm text-muted-foreground">Strength Level</span>
          </div>
        )}
        
        {insight.dominantMovements && insight.dominantMovements.length > 0 && (
          <div>
            <h4 className="font-medium flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Dominant Movements
            </h4>
            <div className="flex flex-wrap gap-2">
              {insight.dominantMovements.map((movement, index) => (
                <Badge key={index} variant="outline" className="bg-green-50">
                  {movement}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {insight.weakPoints && insight.weakPoints.length > 0 && (
          <div>
            <h4 className="font-medium flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              Areas for Development
            </h4>
            <div className="flex flex-wrap gap-2">
              {insight.weakPoints.map((point, index) => (
                <Badge key={index} variant="outline" className="bg-orange-50">
                  {point}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (type === 'training_patterns') {
    return (
      <div className="space-y-4">
        {insight.consistencyScore && (
          <div>
            <div className="flex justify-between mb-2">
              <span className="font-medium">Consistency Score</span>
              <span className="text-sm">{insight.consistencyScore}/10</span>
            </div>
            <Progress value={insight.consistencyScore * 10} className="h-2" />
          </div>
        )}

        {insight.preferredVolume && (
          <div>
            <h4 className="font-medium mb-2">Training Volume Preference</h4>
            <p className="text-sm text-muted-foreground">{insight.preferredVolume}</p>
          </div>
        )}
      </div>
    );
  }

  if (type === 'progression_gaps') {
    return (
      <div className="space-y-4">
        {insight.stalledExercises && insight.stalledExercises.length > 0 && (
          <div>
            <h4 className="font-medium flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Stalled Exercises
            </h4>
            <div className="flex flex-wrap gap-2">
              {insight.stalledExercises.map((exercise, index) => (
                <Badge key={index} variant="outline" className="bg-red-50">
                  {exercise}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {insight.fastProgressors && insight.fastProgressors.length > 0 && (
          <div>
            <h4 className="font-medium flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Fast Progressors
            </h4>
            <div className="flex flex-wrap gap-2">
              {insight.fastProgressors.map((exercise, index) => (
                <Badge key={index} variant="outline" className="bg-green-50">
                  {exercise}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (type === 'personalization_factors') {
    return (
      <div className="space-y-4">
        {insight.motivationTriggers && insight.motivationTriggers.length > 0 && (
          <div>
            <h4 className="font-medium flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-blue-500" />
              Motivation Triggers
            </h4>
            <div className="flex flex-wrap gap-2">
              {insight.motivationTriggers.map((trigger, index) => (
                <Badge key={index} variant="outline" className="bg-blue-50">
                  {trigger}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {insight.adherencePredictors && insight.adherencePredictors.length > 0 && (
          <div>
            <h4 className="font-medium flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-purple-500" />
              Adherence Factors
            </h4>
            <div className="flex flex-wrap gap-2">
              {insight.adherencePredictors.map((factor, index) => (
                <Badge key={index} variant="outline" className="bg-purple-50">
                  {factor}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="text-sm text-muted-foreground">
      <pre className="whitespace-pre-wrap">{JSON.stringify(insight, null, 2)}</pre>
    </div>
  );
};