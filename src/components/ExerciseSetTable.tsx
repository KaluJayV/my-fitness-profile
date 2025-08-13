import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";


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
  const handleInputChange = (setIndex: number, field: keyof Set, value: string) => {
    const numValue = value === '' ? null : parseFloat(value);
    onUpdateSet(setIndex, field, isNaN(numValue) ? null : numValue);
  };

  if (sets.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        No sets recorded yet. Add your first set!
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 text-center">Set</TableHead>
          <TableHead className="text-center">Weight</TableHead>
          <TableHead className="text-center">Reps</TableHead>
          <TableHead className="text-center">RIR</TableHead>
          <TableHead className="w-12"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sets.map((set, index) => (
          <TableRow key={set.id}>
            <TableCell className="text-center font-medium">
              {index + 1}
            </TableCell>
            <TableCell>
              <Input
                type="number"
                placeholder="0"
                value={set.weight || ''}
                onChange={(e) => handleInputChange(index, 'weight', e.target.value)}
                className="text-center"
                min="0"
                step="0.5"
              />
            </TableCell>
            <TableCell>
              <Input
                type="number"
                placeholder="0"
                value={set.reps || ''}
                onChange={(e) => handleInputChange(index, 'reps', e.target.value)}
                className="text-center"
                min="0"
                step="1"
              />
            </TableCell>
            <TableCell>
              <Input
                type="number"
                placeholder="0"
                value={set.rir || ''}
                onChange={(e) => handleInputChange(index, 'rir', e.target.value)}
                className="text-center"
                min="0"
                max="10"
                step="1"
              />
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveSet(index)}
                className="h-8 w-8 p-0"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};