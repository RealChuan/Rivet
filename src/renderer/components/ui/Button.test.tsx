import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button.js'

describe('Button component', () => {
  it('should render with default variant', () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole('button', { name: 'Click me' })
    expect(button).not.toBeNull()
  })

  it('should render with secondary variant', () => {
    render(<Button variant="secondary">Secondary</Button>)
    const button = screen.getByRole('button', { name: 'Secondary' })
    expect(button).not.toBeNull()
  })

  it('should render with danger variant', () => {
    render(<Button variant="danger">Danger</Button>)
    const button = screen.getByRole('button', { name: 'Danger' })
    expect(button).not.toBeNull()
  })

  it('should render with warning variant', () => {
    render(<Button variant="warning">Warning</Button>)
    const button = screen.getByRole('button', { name: 'Warning' })
    expect(button).not.toBeNull()
  })

  it('should show loading spinner', () => {
    render(<Button isLoading>Loading</Button>)
    const button = screen.getByRole('button', { name: 'Loading' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>)
    const button = screen.getByRole('button', { name: 'Disabled' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })

  it('should call onClick when clicked', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Clickable</Button>)
    const button = screen.getByRole('button', { name: 'Clickable' })
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('should not call onClick when disabled', () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>
    )
    const button = screen.getByRole('button', { name: 'Disabled' })
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})
