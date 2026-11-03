"use client";
import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & { thumbLabel: string; valueText?: string }
>(({ className, thumbLabel, valueText, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none items-center py-2 select-none data-[disabled]:opacity-50", className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      aria-label={thumbLabel}
      aria-valuetext={valueText}
      className="block size-5 rounded-full border-2 border-primary bg-card shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    />
  </SliderPrimitive.Root>
));
Slider.displayName = "Slider";
