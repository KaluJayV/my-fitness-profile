import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AppHeader } from '@/components/AppHeader';
import { WorkoutDataManager } from '@/utils/WorkoutDataManager';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Database,
  TrendingUp,
  Clock,
  Target
} from 'lucide-react';

interface WorkoutScanResult {
  workoutId: string;
  name: string;
  format: 'modular' | 'legacy';
  hasErrors: boolean;
  errors: string[];
  programName: string;
}

const WorkoutDataConsole = () => {
  const { user } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState<WorkoutScanResult[]>([]);
  const [migrating, setMigrating] = useState<string[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    modular: 0,
    legacy: 0,
    errors: 0
  });

  useEffect(() => {
    if (user) {
      scanWorkouts();
    }
  }, [user]);

  const scanWorkouts = async () => {
    if (!user) return;

    setScanning(true);
    try {
      const { data: workouts, error } = await supabase
        .from('workouts')
        .select(`
          id,
          json_plan,
          programs (
            name
          )
        `)
        .not('json_plan', 'is', null);

      if (error) throw error;

      const results: WorkoutScanResult[] = [];
      let modularCount = 0;
      let legacyCount = 0;
      let errorCount = 0;

      for (const workout of workouts || []) {
        const jsonPlan = workout.json_plan as any;
        const isModular = jsonPlan?.workout_type === 'modular' || 
                         jsonPlan?.modules !== undefined;
        
        const validation = WorkoutDataManager.validateWorkoutData(jsonPlan);
        
        results.push({
          workoutId: workout.id,
          name: jsonPlan?.name || 'Unnamed Workout',
          format: isModular ? 'modular' : 'legacy',
          hasErrors: !validation.isValid,
          errors: validation.errors,
          programName: workout.programs?.name || 'Unknown Program'
        });

        if (isModular) modularCount++;
        else legacyCount++;
        
        if (!validation.isValid) errorCount++;
      }

      setScanResults(results);
      setStats({
        total: results.length,
        modular: modularCount,
        legacy: legacyCount,
        errors: errorCount
      });

    } catch (error) {
      console.error('Error scanning workouts:', error);
      toast.error('Failed to scan workouts');
    } finally {
      setScanning(false);
    }
  };

  const migrateWorkout = async (workoutId: string) => {
    setMigrating(prev => [...prev, workoutId]);
    
    try {
      const result = await WorkoutDataManager.migrateLegacyWorkout(workoutId);
      
      if (result.success) {
        toast.success('Workout migrated successfully');
        // Refresh scan results
        await scanWorkouts();
      } else {
        toast.error(`Migration failed: ${result.errors[0]}`);
      }
    } catch (error) {
      console.error('Migration error:', error);
      toast.error('Migration failed');
    } finally {
      setMigrating(prev => prev.filter(id => id !== workoutId));
    }
  };

  const migrateAllLegacy = async () => {
    const legacyWorkouts = scanResults.filter(w => w.format === 'legacy');
    
    for (const workout of legacyWorkouts) {
      await migrateWorkout(workout.workoutId);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Workout Data Console" showBack={true} />
      
      <div className="container mx-auto p-4 lg:p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Workout Data Console</h1>
          <p className="text-muted-foreground">
            Monitor and manage workout data integrity and format consistency
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Workouts</p>
                </div>
                <Database className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-green-600">{stats.modular}</p>
                  <p className="text-xs text-muted-foreground">Modular Format</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-yellow-600">{stats.legacy}</p>
                  <p className="text-xs text-muted-foreground">Legacy Format</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-red-600">{stats.errors}</p>
                  <p className="text-xs text-muted-foreground">With Errors</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mb-6">
          <Button onClick={scanWorkouts} disabled={scanning}>
            {scanning ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Rescan Workouts
              </>
            )}
          </Button>

          {stats.legacy > 0 && (
            <Button 
              variant="outline" 
              onClick={migrateAllLegacy}
              disabled={migrating.length > 0}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Migrate All Legacy ({stats.legacy})
            </Button>
          )}
        </div>

        {/* Results */}
        <div className="space-y-4">
          {scanResults.map((result) => (
            <Card key={result.workoutId} className={`border-l-4 ${
              result.hasErrors 
                ? 'border-l-red-500' 
                : result.format === 'modular' 
                  ? 'border-l-green-500' 
                  : 'border-l-yellow-500'
            }`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{result.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {result.programName} • ID: {result.workoutId}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={result.format === 'modular' ? 'default' : 'secondary'}>
                      {result.format}
                    </Badge>
                    {result.hasErrors && (
                      <Badge variant="destructive">
                        {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              {(result.hasErrors || result.format === 'legacy') && (
                <CardContent>
                  {result.hasErrors && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="space-y-1">
                          {result.errors.map((error, index) => (
                            <div key={index} className="text-sm">• {error}</div>
                          ))}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {result.format === 'legacy' && !result.hasErrors && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        This workout is in legacy format and can be migrated to the new modular format.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => migrateWorkout(result.workoutId)}
                        disabled={migrating.includes(result.workoutId)}
                      >
                        {migrating.includes(result.workoutId) ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Migrating...
                          </>
                        ) : (
                          <>
                            <TrendingUp className="h-4 w-4 mr-2" />
                            Migrate
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}

          {scanResults.length === 0 && !scanning && (
            <Card>
              <CardContent className="pt-6 text-center">
                <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No workouts found</p>
                <p className="text-sm text-muted-foreground">
                  Create some workouts to see them here
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkoutDataConsole;