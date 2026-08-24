import type { SavingsGoal } from '@/types/database'

export interface GoalProgress {
  goalId: string
  progressPercent: number
  remaining: number
  monthsToTarget: number | null
  requiredMonthlyContribution: number | null
}

export function calculateGoalProgress(goal: SavingsGoal, today = new Date()): GoalProgress {
  const remaining = Math.max(goal.target_amount - goal.current_amount, 0)
  const progressPercent = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0

  let monthsToTarget: number | null = null
  let requiredMonthlyContribution: number | null = null

  if (goal.target_date) {
    const target = new Date(goal.target_date)
    const monthsDiff =
      (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth())
    monthsToTarget = Math.max(monthsDiff, 0)
    requiredMonthlyContribution = monthsToTarget > 0 ? remaining / monthsToTarget : remaining
  }

  return {
    goalId: goal.id,
    progressPercent: Math.min(progressPercent, 100),
    remaining,
    monthsToTarget,
    requiredMonthlyContribution,
  }
}
