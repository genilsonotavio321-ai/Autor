"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface SettingSliderProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Suffixo exibido junto ao valor, ex.: "px", "palavras". */
  unit?: string;
  onValueChange: (value: number) => void;
}

/**
 * Slider com input numérico ao lado: o slider cobre o caso comum (toque) e o
 * input permite valores fora da faixa padrão sem perder a digitação direta.
 */
export function SettingSlider({
  id,
  label,
  value,
  min,
  max,
  step,
  unit,
  onValueChange,
}: SettingSliderProps) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>
          {label}
          {unit ? ` (${unit})` : ""}
        </Label>
        <Input
          id={`${id}-number`}
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(event) => onValueChange(Number(event.target.value))}
          className="h-8 w-24 text-right"
          aria-label={`${label} — valor exato`}
        />
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([next]) => {
          if (next !== undefined) onValueChange(next);
        }}
        aria-label={label}
      />
    </div>
  );
}
