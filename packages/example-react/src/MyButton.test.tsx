import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { MyButton } from './MyButton.tsx'

test('button', () => {
    render(<MyButton type="primary" />)
    const buttonElement = screen.getByRole('button')

    expect(buttonElement).toBeInTheDocument()
    expect(buttonElement).toHaveTextContent(
        'my button hi type: primary count: 0',
    )
    expect(buttonElement).toHaveClass('my-button')
})
