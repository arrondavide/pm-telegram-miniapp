"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Star, Lock } from "lucide-react"
import { getPlanById } from "@/lib/plans"

interface UpgradePromptProps {
  title: string
  message: string
  planRequired: string
  onUpgrade: () => void
  onDismiss?: () => void
  variant?: "dialog" | "inline"
  open?: boolean
}

export function UpgradePrompt({
  title,
  message,
  planRequired,
  onUpgrade,
  onDismiss,
  variant = "dialog",
  open = true,
}: UpgradePromptProps) {
  const plan = getPlanById(planRequired)

  const content = (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="rounded-full bg-amber-500/10 p-3">
        <Lock className="h-8 w-8 text-amber-500" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{message}</p>
        {plan && (
          <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-sm font-medium">{plan.name} Plan</p>
            <div className="mt-1 flex items-center justify-center gap-1 text-amber-600">
              <Star className="h-4 w-4 fill-current" />
              <span className="text-lg font-bold">{plan.priceStars}</span>
              <span className="text-xs text-muted-foreground">Stars/month</span>
            </div>
            <ul className="mt-2 space-y-1 text-left text-xs text-muted-foreground">
              {plan.features.slice(0, 4).map((f) => (
                <li key={f} className="flex items-center gap-1.5">
                  <span className="text-green-500">+</span> {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="flex w-full gap-2">
        {onDismiss && (
          <Button variant="outline" className="flex-1" onClick={onDismiss}>
            Maybe Later
          </Button>
        )}
        <Button className="flex-1 bg-amber-500 hover:bg-amber-600" onClick={onUpgrade}>
          <Star className="mr-1.5 h-4 w-4" />
          Upgrade
        </Button>
      </div>
    </div>
  )

  if (variant === "inline") {
    return (
      <Card className="border-amber-500/20">
        <CardContent className="p-4">{content}</CardContent>
      </Card>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss?.()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{message}</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  )
}
