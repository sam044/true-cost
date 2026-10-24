"use client";

// Lets the user choose which apartments appear on Compare. At least one stays shown.
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Apartment } from "@/lib/types";

export function ApartmentPicker({
  apartments,
  shown,
  onToggle,
}: {
  apartments: Apartment[];
  shown: Set<string>;
  onToggle: (id: string, show: boolean) => void;
}) {
  const onlyOneLeft = shown.size === 1;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="self-start">
          Comparing {shown.size} of {apartments.length}
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Show these apartments</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {apartments.map((apartment) => {
          const checked = shown.has(apartment.id);
          return (
            <DropdownMenuCheckboxItem
              key={apartment.id}
              checked={checked}
              disabled={checked && onlyOneLeft}
              // Keep the menu open so several apartments can be toggled in a row.
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={(value) => onToggle(apartment.id, value === true)}
            >
              {apartment.name}
            </DropdownMenuCheckboxItem>
          );
        })}
        {onlyOneLeft && (
          <p className="px-1.5 pt-2 pb-1 text-xs text-muted-foreground">
            At least one apartment stays on screen.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
