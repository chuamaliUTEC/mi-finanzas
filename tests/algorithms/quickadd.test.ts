import { describe, expect, it } from 'vitest'
import { parseQuickExpense } from '@/algorithms/quickadd/parse'
import type { ExpenseCategory, ExpenseSubcategory } from '@/types/database'

const categories: ExpenseCategory[] = [
  { id: 'c1', user_id: 'u', name: 'Alimentación', icon: null, sort_order: 1, created_at: '', updated_at: '', deleted_at: null },
  { id: 'c2', user_id: 'u', name: 'Transporte', icon: null, sort_order: 2, created_at: '', updated_at: '', deleted_at: null },
]

const subcategories: ExpenseSubcategory[] = [
  { id: 's1', user_id: 'u', category_id: 'c1', name: 'almuerzo laboral', created_at: '' },
  { id: 's2', user_id: 'u', category_id: 'c2', name: 'Uber', created_at: '' },
]

describe('parseQuickExpense', () => {
  it('interpreta "Gasté 25 en almuerzo" como Alimentación → almuerzo', () => {
    const parsed = parseQuickExpense('Gasté 25 en almuerzo', categories, subcategories)
    expect(parsed).not.toBeNull()
    expect(parsed!.amount).toBe(25)
    expect(parsed!.categoryId).toBe('c1')
    expect(parsed!.subcategoryId).toBe('s1')
  })

  it('interpreta "Uber 18" como Transporte → Uber', () => {
    const parsed = parseQuickExpense('Uber 18', categories, subcategories)
    expect(parsed!.amount).toBe(18)
    expect(parsed!.categoryId).toBe('c2')
    expect(parsed!.subcategoryName).toBe('Uber')
  })

  it('acepta decimales con coma o punto', () => {
    expect(parseQuickExpense('cafe 7,50', categories, subcategories)!.amount).toBe(7.5)
    expect(parseQuickExpense('cafe 7.50', categories, subcategories)!.amount).toBe(7.5)
  })

  it('devuelve null sin monto y sin categoría cuando no hay match', () => {
    expect(parseQuickExpense('almuerzo rico', categories, subcategories)).toBeNull()
    const noMatch = parseQuickExpense('zapatos 90', categories, subcategories)
    expect(noMatch!.amount).toBe(90)
    expect(noMatch!.categoryId).toBeNull()
  })
})
