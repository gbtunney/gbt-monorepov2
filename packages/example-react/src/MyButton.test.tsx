import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'
import { MyButton } from '../src'

// Extend vitest's expect with jest-dom matchers
expect.extend(matchers)

test('button', () => {
  render(<MyButton type="primary" />)
  const buttonElement = screen.getByRole('button')

  expect(buttonElement).toBeInTheDocument()
  expect(buttonElement).toHaveTextContent('my button type: primary count: 0')
  expect(buttonElement).toHaveClass('my-button')
})