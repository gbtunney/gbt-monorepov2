import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, expect, test } from 'vitest'

import { Button } from './Button.tsx'

afterEach(() => {
    cleanup()
})

test('button', () => {
    render(<Button label="Button" primary size="medium" />)
    const buttonElement = screen.getByRole('button')

    expect(buttonElement).toBeInTheDocument()
    expect(buttonElement).toHaveTextContent('Button')
    expect(buttonElement).toHaveClass('storybook-button')
    expect(buttonElement).toHaveClass('storybook-button--primary')
    expect(buttonElement).toHaveClass('storybook-button--medium')
})

test('button defaults to secondary variant', () => {
    render(<Button label="Secondary" />)
    const buttonElement = screen.getByRole('button')

    expect(buttonElement).toBeInTheDocument()
    expect(buttonElement).toHaveTextContent('Secondary')
    expect(buttonElement).toHaveClass('storybook-button')
    expect(buttonElement).toHaveClass('storybook-button--secondary')
    expect(buttonElement).toHaveClass('storybook-button--medium')
})
