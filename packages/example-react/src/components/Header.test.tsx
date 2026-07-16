import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, expect, test, vi } from 'vitest'

import { Header } from './Header.tsx'

afterEach(() => {
    cleanup()
})

test('header renders logged out actions', () => {
    const onLogin = vi.fn()
    const onCreateAccount = vi.fn()

    render(<Header onCreateAccount={onCreateAccount} onLogin={onLogin} />)

    const loginButton = screen.getByRole('button', { name: 'Log in' })
    const signUpButton = screen.getByRole('button', { name: 'Sign up' })

    expect(screen.getByRole('heading', { name: 'Acme' })).toBeInTheDocument()
    expect(loginButton).toBeInTheDocument()
    expect(signUpButton).toBeInTheDocument()

    fireEvent.click(loginButton)
    fireEvent.click(signUpButton)

    expect(onLogin).toHaveBeenCalledTimes(1)
    expect(onCreateAccount).toHaveBeenCalledTimes(1)
})

test('header renders logged in state', () => {
    const onLogout = vi.fn()

    render(<Header onLogout={onLogout} user={{ name: 'Jane' }} />)

    expect(
        screen.getByText((_, element) => {
            return element?.textContent === 'Welcome, Jane!'
        }),
    ).toBeInTheDocument()

    const logoutButton = screen.getByRole('button', { name: 'Log out' })
    expect(logoutButton).toBeInTheDocument()
    expect(
        screen.queryByRole('button', { name: 'Log in' }),
    ).not.toBeInTheDocument()
    expect(
        screen.queryByRole('button', { name: 'Sign up' }),
    ).not.toBeInTheDocument()

    fireEvent.click(logoutButton)
    expect(onLogout).toHaveBeenCalledTimes(1)
})
