"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn("flex flex-col gap-0", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex items-center rounded-xl p-1 gap-1",
        "bg-white/[0.04] border border-white/[0.06]",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        // base
        "relative flex-1 inline-flex items-center justify-center",
        "px-4 py-2 text-sm font-medium rounded-lg",
        "text-slate-400 transition-all duration-200 cursor-pointer",
        "whitespace-nowrap select-none",
        // hover
        "hover:text-slate-200 hover:bg-white/[0.05]",
        // focus
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
        // active state via data-active (Base UI)
        "data-[active]:bg-white/[0.10] data-[active]:text-white data-[active]:shadow-sm",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none focus-visible:outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
