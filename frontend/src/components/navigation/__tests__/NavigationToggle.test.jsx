import { vi, describe, test, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import NavigationToggle from '../NavigationToggle';

const TestWrapper = ({ children }) => (
  <MantineProvider>
    {children}
  </MantineProvider>
);

describe('NavigationToggle', () => {
  test('renders without crashing', () => {
    render(
      <TestWrapper>
        <NavigationToggle isOpen={false} onToggle={vi.fn()} />
      </TestWrapper>
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  test('shows closed state icon when isOpen is false', () => {
    render(
      <TestWrapper>
        <NavigationToggle isOpen={false} onToggle={vi.fn()} />
      </TestWrapper>
    );

    const button = screen.getByRole('button', { name: /open navigation menu/i });
    expect(button).toBeInTheDocument();
  });

  test('shows open state icon when isOpen is true', () => {
    render(
      <TestWrapper>
        <NavigationToggle isOpen={true} onToggle={vi.fn()} />
      </TestWrapper>
    );

    const button = screen.getByRole('button', { name: /close navigation menu/i });
    expect(button).toBeInTheDocument();
  });

  test('calls onToggle when clicked', () => {
    const mockToggle = vi.fn();
    render(
      <TestWrapper>
        <NavigationToggle isOpen={false} onToggle={mockToggle} />
      </TestWrapper>
    );

    fireEvent.click(screen.getByRole('button'));
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });
});
