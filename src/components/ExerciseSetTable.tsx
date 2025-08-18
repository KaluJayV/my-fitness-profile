import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";


interface Set {
  id: string;
  weight: number | null;
  reps: number | null;
  rir: number | null;
}

interface ExerciseSetTableProps {
  sets: Set[];
  onUpdateSet: (setIndex: number, field: keyof Set, value: number | null) => void;
  onRemoveSet: (setIndex: number) => void;
}

export const ExerciseSetTable = ({ sets, onUpdateSet, onRemoveSet }: ExerciseSetTableProps) => {
  const isMobile = useIsMobile();
  
  const handleInputChange = (setIndex: number, field: keyof Set, value: string) => {
    const numValue = value === '' ? null : parseFloat(value);
    onUpdateSet(setIndex, field, isNaN(numValue) ? null : numValue);
  };

  if (sets.length === 0) {
    return (
      <div className={`text-center py-4 text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>
        No sets recorded yet. Add your first set!
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={`${isMobile ? 'w-8 text-xs' : 'w-12'} text-center`}>Set</TableHead>
          <TableHead className={`text-center ${isMobile ? 'text-xs' : ''}`}>Weight</TableHead>
          <TableHead className={`text-center ${isMobile ? 'text-xs' : ''}`}>Reps</TableHead>
          <TableHead className={`text-center ${isMobile ? 'text-xs' : ''}`}>RIR</TableHead>
          <TableHead className={isMobile ? 'w-8' : 'w-12'}></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sets.map((set, index) => (
          <TableRow key={set.id}>
            <TableCell className={`text-center font-medium ${isMobile ? 'text-xs py-2' : ''}`}>
              {index + 1}
            </TableCell>
            <TableCell className={isMobile ? 'py-2' : ''}>
              <Input
                type="number"
                placeholder="0"
                value={set.weight || ''}
                onChange={(e) => handleInputChange(index, 'weight', e.target.value)}
                className={`text-center ${isMobile ? 'h-8 text-xs' : ''}`}
                min="0"
                step="0.5"
              />
            </TableCell>
            <TableCell className={isMobile ? 'py-2' : ''}>
              <Input
                type="number"
                placeholder="0"
                value={set.reps || ''}
                onChange={(e) => handleInputChange(index, 'reps', e.target.value)}
                className={`text-center ${isMobile ? 'h-8 text-xs' : ''}`}
                min="0"
                step="1"
              />
            </TableCell>
            <TableCell className={isMobile ? 'py-2' : ''}>
              <Input
                type="number"
                placeholder="0"
                value={set.rir || ''}
                onChange={(e) => handleInputChange(index, 'rir', e.target.value)}
                className={`text-center ${isMobile ? 'h-8 text-xs' : ''}`}
                min="0"
                max="10"
                step="1"
              />
            </TableCell>
            <TableCell className={isMobile ? 'py-2' : ''}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveSet(index)}
                className={isMobile ? "h-6 w-6 p-0" : "h-8 w-8 p-0"}
              >
                <Trash2 className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} text-destructive`} />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};