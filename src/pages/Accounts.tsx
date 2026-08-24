import { EntityCrud } from '@/components/EntityCrud'
import type { Account } from '@/types/database'

export default function Accounts() {
  return (
    <EntityCrud<Account>
      table="accounts"
      title="🏦 Cuentas"
      description="Cuentas bancarias, efectivo e inversiones. La suma de sus saldos alimenta tu liquidez y patrimonio."
      orderBy="created_at"
      labelField="name"
      amountField="opening_balance"
      amountTone="positive"
      fields={[
        { name: 'name', label: 'Nombre', type: 'text', required: true },
        { name: 'type', label: 'Tipo (checking/savings/cash/investment/other)', type: 'text', defaultValue: 'checking' },
        { name: 'opening_balance', label: 'Saldo', type: 'number', required: true },
      ]}
    />
  )
}
