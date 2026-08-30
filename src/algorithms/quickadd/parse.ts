import type { ExpenseCategory, ExpenseSubcategory } from '@/types/database'

// Registro ultrarrápido (secc. 27): interpreta frases como
// "Gasté 25 en almuerzo" o "Uber 18" contra las categorías/subcategorías
// REALES del usuario (data-driven, sin diccionario hardcodeado por persona).
// Siempre devuelve una interpretación para CONFIRMAR, nunca inserta directo.

export interface QuickAddParse {
  amount: number
  categoryId: string | null
  categoryName: string | null
  subcategoryId: string | null
  subcategoryName: string | null
  description: string
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

const FILLER_WORDS = new Set([
  'gaste', 'gasto', 'pague', 'pago', 'compre', 'compra', 'en', 'de', 'el',
  'la', 'los', 'las', 'un', 'una', 'por', 'para', 'soles', 's/', 'con', 'y',
])

export function parseQuickExpense(
  input: string,
  categories: ExpenseCategory[],
  subcategories: ExpenseSubcategory[],
): QuickAddParse | null {
  const amountMatch = input.match(/(\d+(?:[.,]\d{1,2})?)/)
  if (!amountMatch) return null
  const amount = parseFloat(amountMatch[1].replace(',', '.'))
  if (!(amount > 0)) return null

  const words = normalize(input.replace(amountMatch[0], ''))
    .split(/\s+/)
    .filter((w) => w.length > 1 && !FILLER_WORDS.has(w))

  // Primero intenta subcategoría (más específica), luego categoría.
  let matchedSub: ExpenseSubcategory | null = null
  for (const sub of subcategories) {
    const subNorm = normalize(sub.name)
    if (words.some((w) => subNorm.includes(w) || w.includes(subNorm))) {
      matchedSub = sub
      break
    }
  }

  let matchedCat: ExpenseCategory | null = null
  if (matchedSub) {
    matchedCat = categories.find((c) => c.id === matchedSub!.category_id) ?? null
  } else {
    for (const cat of categories) {
      const catNorm = normalize(cat.name)
      if (words.some((w) => catNorm.includes(w) || w.includes(catNorm))) {
        matchedCat = cat
        break
      }
    }
  }

  return {
    amount,
    categoryId: matchedCat?.id ?? null,
    categoryName: matchedCat?.name ?? null,
    subcategoryId: matchedSub?.id ?? null,
    subcategoryName: matchedSub?.name ?? null,
    description: input.trim(),
  }
}
