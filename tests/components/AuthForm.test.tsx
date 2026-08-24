import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuthForm } from '@/components/AuthForm'

describe('AuthForm', () => {
  it('calls onSubmit with email and password on login', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ error: null })
    render(<AuthForm mode="login" onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/correo/i), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('a@b.com', 'secret123', undefined))
  })

  it('shows the error message returned by onSubmit', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ error: 'Credenciales inválidas' })
    render(<AuthForm mode="login" onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/correo/i), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    expect(await screen.findByText('Credenciales inválidas')).toBeInTheDocument()
  })
})
