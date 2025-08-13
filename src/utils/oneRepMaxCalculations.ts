// 1RM calculation utilities based on established formulas

interface SetData {
  weight: number;
  reps: number;
  rir?: number; // Reps in Reserve
}

interface OneRepMaxResult {
  estimated1RM: number;
  formula: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Epley Formula: 1RM = weight × (1 + reps/30)
 * Most accurate for 1-10 reps
 */
export const calculateEpley = (weight: number, reps: number): number => {
  return weight * (1 + reps / 30);
};

/**
 * Brzycki Formula: 1RM = weight × (36/(37-reps))
 * Most accurate for 2-10 reps
 */
export const calculateBrzycki = (weight: number, reps: number): number => {
  if (reps >= 37) return weight; // Formula breaks down
  return weight * (36 / (37 - reps));
};

/**
 * Lander Formula: 1RM = (100 × weight)/(101.3 - 2.67123 × reps)
 * Good for higher rep ranges
 */
export const calculateLander = (weight: number, reps: number): number => {
  const denominator = 101.3 - (2.67123 * reps);
  if (denominator <= 0) return weight; // Formula breaks down
  return (100 * weight) / denominator;
};

/**
 * Calculate 1RM with RIR adjustment
 * If user did 8 reps with 3 RIR, they could have done 11 reps to failure
 */
export const calculate1RMWithRIR = (setData: SetData): OneRepMaxResult => {
  const { weight, reps, rir = 0 } = setData;
  const actualRepsToFailure = reps + rir;
  
  // Choose best formula based on rep range
  let estimated1RM: number;
  let formula: string;
  let confidence: 'high' | 'medium' | 'low';
  
  if (actualRepsToFailure <= 5) {
    // Use Epley for low reps
    estimated1RM = calculateEpley(weight, actualRepsToFailure);
    formula = 'Epley';
    confidence = 'high';
  } else if (actualRepsToFailure <= 10) {
    // Average Epley and Brzycki for medium reps
    const epley = calculateEpley(weight, actualRepsToFailure);
    const brzycki = calculateBrzycki(weight, actualRepsToFailure);
    estimated1RM = (epley + brzycki) / 2;
    formula = 'Epley + Brzycki Average';
    confidence = 'high';
  } else if (actualRepsToFailure <= 15) {
    // Use Lander for higher reps
    estimated1RM = calculateLander(weight, actualRepsToFailure);
    formula = 'Lander';
    confidence = 'medium';
  } else {
    // Very high reps - use Lander but lower confidence
    estimated1RM = calculateLander(weight, actualRepsToFailure);
    formula = 'Lander (High Rep)';
    confidence = 'low';
  }
  
  return {
    estimated1RM: Math.round(estimated1RM * 100) / 100, // Round to 2 decimal places
    formula,
    confidence
  };
};

/**
 * Calculate the best 1RM estimate from multiple sets
 * Prioritizes recent performance and higher confidence estimates
 */
export const calculateBest1RM = (sets: SetData[]): OneRepMaxResult | null => {
  if (sets.length === 0) return null;
  
  const calculations = sets
    .filter(set => set.weight > 0 && set.reps > 0)
    .map(set => calculate1RMWithRIR(set))
    .sort((a, b) => {
      // Sort by confidence (high > medium > low) then by estimated 1RM
      const confidenceWeight = { high: 3, medium: 2, low: 1 };
      const aScore = confidenceWeight[a.confidence] * 1000 + a.estimated1RM;
      const bScore = confidenceWeight[b.confidence] * 1000 + b.estimated1RM;
      return bScore - aScore;
    });
  
  return calculations[0] || null;
};

/**
 * Suggest weight based on 1RM and target rep range
 * Uses percentage-based recommendations
 */
export const suggestWeight = (oneRM: number, targetReps: number | string, targetRIR: number = 2): number => {
  // Handle rep ranges like "8-12"
  let reps: number;
  if (typeof targetReps === 'string') {
    const repRange = targetReps.split('-').map(r => parseInt(r.trim()));
    reps = repRange.length === 2 ? Math.round((repRange[0] + repRange[1]) / 2) : repRange[0];
  } else {
    reps = targetReps;
  }
  
  // Adjust for RIR - if targeting 2 RIR, calculate for reps + 2
  const effectiveReps = reps + targetRIR;
  
  // Percentage recommendations based on rep ranges
  let percentage: number;
  if (effectiveReps <= 3) {
    percentage = 0.90; // 90% for 1-3 reps
  } else if (effectiveReps <= 5) {
    percentage = 0.85; // 85% for 4-5 reps
  } else if (effectiveReps <= 8) {
    percentage = 0.80; // 80% for 6-8 reps
  } else if (effectiveReps <= 12) {
    percentage = 0.75; // 75% for 9-12 reps
  } else if (effectiveReps <= 15) {
    percentage = 0.70; // 70% for 13-15 reps
  } else {
    percentage = 0.65; // 65% for 16+ reps
  }
  
  const suggestedWeight = oneRM * percentage;
  
  // Round to nearest 2.5 for most gyms (plates come in 2.5kg/5lb increments)
  return Math.round(suggestedWeight / 2.5) * 2.5;
};

/**
 * Get weight progression suggestion
 * If user has been consistently hitting target reps, suggest small increase
 */
export const getProgressionSuggestion = (
  recentSets: SetData[],
  currentSuggestion: number,
  targetReps: number
): { weight: number; note: string } => {
  if (recentSets.length < 2) {
    return { weight: currentSuggestion, note: "Baseline suggestion" };
  }
  
  // Check if user has been consistently hitting target reps with low RIR
  const recentPerformance = recentSets.slice(-3); // Last 3 sets
  const consistentlyStrong = recentPerformance.every(set => 
    set.reps >= targetReps && (set.rir || 0) <= 1
  );
  
  if (consistentlyStrong) {
    const increase = currentSuggestion >= 100 ? 5 : 2.5; // Larger increases for heavier weights
    return { 
      weight: currentSuggestion + increase, 
      note: `Progressed +${increase}kg - consistent performance` 
    };
  }
  
  // Check if user has been struggling
  const struggling = recentPerformance.some(set => 
    set.reps < targetReps * 0.8 || (set.rir || 0) === 0
  );
  
  if (struggling) {
    const decrease = currentSuggestion >= 100 ? 5 : 2.5;
    return { 
      weight: Math.max(currentSuggestion - decrease, currentSuggestion * 0.9), 
      note: `Reduced -${decrease}kg - allow recovery` 
    };
  }
  
  return { weight: currentSuggestion, note: "Maintain current weight" };
};