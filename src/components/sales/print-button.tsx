'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PrintButton() {
  return (
    <div className="flex justify-end mb-6 print:hidden">
      <Button onClick={() => window.print()} className="bg-teal-600 hover:bg-teal-700">
        <Printer className="mr-1.5 h-4 w-4" />Print / Save as PDF
      </Button>
    </div>
  );
}
