import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, Dumbbell, Flame, Snowflake, Target } from 'lucide-react';
import { WorkoutModuleConfig } from '@/types/workout';

interface WorkoutModuleConfigProps {
  config: WorkoutModuleConfig;
  onChange: (config: WorkoutModuleConfig) => void;
}

export const WorkoutModuleConfigComponent: React.FC<WorkoutModuleConfigProps> = ({
  config,
  onChange,
}) => {
  const updateModule = <T extends keyof WorkoutModuleConfig>(
    module: T,
    updates: Partial<WorkoutModuleConfig[T]>
  ) => {
    onChange({
      ...config,
      [module]: {
        ...config[module],
        ...updates,
      },
    });
  };

  const getTotalDuration = () => {
    let total = config.main.duration_minutes; // Main workout is always included
    if (config.warmup.enabled) total += config.warmup.duration_minutes;
    if (config.core.enabled) total += config.core.duration_minutes;
    if (config.cooldown.enabled) total += config.cooldown.duration_minutes;
    return total;
  };

  return (
    <div className="space-y-6">
      {/* Duration Summary */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Total Workout Duration
            </CardTitle>
            <Badge variant="secondary" className="text-base px-3 py-1">
              {getTotalDuration()} minutes
            </Badge>
          </div>
          <CardDescription>
            Configure optional modules to customize your workout experience
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Warmup Module */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              <CardTitle>Warmup & Activation</CardTitle>
            </div>
            <Switch
              checked={config.warmup.enabled}
              onCheckedChange={(enabled) => updateModule('warmup', { enabled })}
            />
          </div>
          {config.warmup.enabled && (
            <CardDescription className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              Adds {config.warmup.duration_minutes} minutes to your workout
            </CardDescription>
          )}
        </CardHeader>
        
        {config.warmup.enabled && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Duration (minutes)</Label>
              <Slider
                value={[config.warmup.duration_minutes]}
                onValueChange={([value]) => updateModule('warmup', { duration_minutes: value })}
                max={20}
                min={5}
                step={5}
                className="w-full"
              />
              <div className="text-sm text-muted-foreground">
                {config.warmup.duration_minutes} minutes
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Warmup Type</Label>
              <Select
                value={config.warmup.type}
                onValueChange={(value: 'dynamic' | 'static' | 'cardio') => 
                  updateModule('warmup', { type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dynamic">Dynamic Movement</SelectItem>
                  <SelectItem value="static">Static Stretching</SelectItem>
                  <SelectItem value="cardio">Light Cardio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Main Workout (Always Enabled) */}
      <Card className="border-primary/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-primary" />
            <CardTitle>Main Workout</CardTitle>
            <Badge variant="default">Required</Badge>
          </div>
          <CardDescription>
            Core strength training - estimated {config.main.duration_minutes} minutes
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Core Finisher Module */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-red-500" />
              <CardTitle>Core Finisher</CardTitle>
            </div>
            <Switch
              checked={config.core.enabled}
              onCheckedChange={(enabled) => updateModule('core', { enabled })}
            />
          </div>
          {config.core.enabled && (
            <CardDescription className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              Adds {config.core.duration_minutes} minutes of intense core work
            </CardDescription>
          )}
        </CardHeader>
        
        {config.core.enabled && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Duration (minutes)</Label>
              <Slider
                value={[config.core.duration_minutes]}
                onValueChange={([value]) => updateModule('core', { duration_minutes: value })}
                max={20}
                min={5}
                step={5}
                className="w-full"
              />
              <div className="text-sm text-muted-foreground">
                {config.core.duration_minutes} minutes
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Intensity</Label>
                <Select
                  value={config.core.intensity}
                  onValueChange={(value: 'light' | 'moderate' | 'intense') => 
                    updateModule('core', { intensity: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="intense">Intense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Style</Label>
                <Select
                  value={config.core.style}
                  onValueChange={(value: 'strength' | 'endurance' | 'mixed') => 
                    updateModule('core', { style: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strength">Strength</SelectItem>
                    <SelectItem value="endurance">Endurance</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Cooldown Module */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Snowflake className="h-5 w-5 text-blue-500" />
              <CardTitle>Cooldown & Recovery</CardTitle>
            </div>
            <Switch
              checked={config.cooldown.enabled}
              onCheckedChange={(enabled) => updateModule('cooldown', { enabled })}
            />
          </div>
          {config.cooldown.enabled && (
            <CardDescription className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              Adds {config.cooldown.duration_minutes} minutes for recovery
            </CardDescription>
          )}
        </CardHeader>
        
        {config.cooldown.enabled && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Duration (minutes)</Label>
              <Slider
                value={[config.cooldown.duration_minutes]}
                onValueChange={([value]) => updateModule('cooldown', { duration_minutes: value })}
                max={15}
                min={5}
                step={5}
                className="w-full"
              />
              <div className="text-sm text-muted-foreground">
                {config.cooldown.duration_minutes} minutes
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Cooldown Type</Label>
              <Select
                value={config.cooldown.type}
                onValueChange={(value: 'stretching' | 'mobility' | 'relaxation') => 
                  updateModule('cooldown', { type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stretching">Stretching</SelectItem>
                  <SelectItem value="mobility">Mobility Work</SelectItem>
                  <SelectItem value="relaxation">Relaxation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};