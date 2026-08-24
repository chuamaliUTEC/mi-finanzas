import { EntityCrud } from '@/components/EntityCrud'
import type { CreditCard } from '@/types/database'

export default function CreditCards() {
  return (
    <EntityCrud<CreditCard>
      table="credit_cards"
      title="Tarjetas de crédito"
      description="Tus tarjetas y su saldo actual. Deja el saldo vacío si aún no lo confirmas."
      orderBy="created_at"
      labelField="name"
      amountField="current_balance"
      amountTone="negative"
      fields={[
        { name: 'name', label: 'Nombre', type: 'text', required: true },
        { name: 'issuer', label: 'Emisor', type: 'text' },
        { name: 'credit_limit', label: 'Límite', type: 'number', required: true },
        { name: 'current_balance', label: 'Saldo actual (vacío = por confirmar)', type: 'number' },
      ]}
    />
  )
}
