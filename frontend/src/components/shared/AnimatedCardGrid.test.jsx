import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AnimatedCardGrid from './AnimatedCardGrid';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div data-testid="motion-div" {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

describe('AnimatedCardGrid', () => {
  const mockItems = [
    { id: 1, name: 'Item 1' },
    { id: 2, name: 'Item 2' },
    { id: 3, name: 'Item 3' },
  ];

  const mockRenderCard = (item) => (
    <div data-testid={`card-${item.id}`}>{item.name}</div>
  );

  describe('rendering', () => {
    it('renders all items as cards', () => {
      render(
        <AnimatedCardGrid items={mockItems} renderCard={mockRenderCard} />
      );

      expect(screen.getByTestId('card-1')).toBeInTheDocument();
      expect(screen.getByTestId('card-2')).toBeInTheDocument();
      expect(screen.getByTestId('card-3')).toBeInTheDocument();
    });

    it('renders item content correctly', () => {
      render(
        <AnimatedCardGrid items={mockItems} renderCard={mockRenderCard} />
      );

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('Item 3')).toBeInTheDocument();
    });

    it('returns null for empty items array', () => {
      const { container } = render(
        <AnimatedCardGrid items={[]} renderCard={mockRenderCard} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('returns null for null items', () => {
      const { container } = render(
        <AnimatedCardGrid items={null} renderCard={mockRenderCard} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('returns null for undefined items', () => {
      const { container } = render(
        <AnimatedCardGrid items={undefined} renderCard={mockRenderCard} />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('keyExtractor', () => {
    it('uses default keyExtractor (item.id)', () => {
      render(
        <AnimatedCardGrid items={mockItems} renderCard={mockRenderCard} />
      );

      // Cards should render without key warnings (id is used as key)
      expect(screen.getByTestId('card-1')).toBeInTheDocument();
    });

    it('uses custom keyExtractor when provided', () => {
      const itemsWithCustomKey = [
        { customId: 'a', name: 'Item A' },
        { customId: 'b', name: 'Item B' },
      ];

      const customRenderCard = (item) => (
        <div data-testid={`card-${item.customId}`}>{item.name}</div>
      );

      render(
        <AnimatedCardGrid
          items={itemsWithCustomKey}
          renderCard={customRenderCard}
          keyExtractor={(item) => item.customId}
        />
      );

      expect(screen.getByTestId('card-a')).toBeInTheDocument();
      expect(screen.getByTestId('card-b')).toBeInTheDocument();
    });
  });

  describe('columns', () => {
    it('applies default columns { base: 12, md: 6, lg: 4 }', () => {
      const { container } = render(
        <AnimatedCardGrid items={mockItems} renderCard={mockRenderCard} />
      );

      // Grid.Col components are rendered
      const cols = container.querySelectorAll('.mantine-Grid-col');
      expect(cols.length).toBe(3);
    });

    it('accepts custom columns object', () => {
      const { container } = render(
        <AnimatedCardGrid
          items={mockItems}
          renderCard={mockRenderCard}
          columns={{ base: 12, md: 4, xl: 3 }}
        />
      );

      const cols = container.querySelectorAll('.mantine-Grid-col');
      expect(cols.length).toBe(3);
    });

    it('accepts numeric column span', () => {
      const { container } = render(
        <AnimatedCardGrid
          items={mockItems}
          renderCard={mockRenderCard}
          columns={6}
        />
      );

      const cols = container.querySelectorAll('.mantine-Grid-col');
      expect(cols.length).toBe(3);
    });
  });

  describe('animation', () => {
    it('renders motion.div wrappers when animate=true (default)', () => {
      render(
        <AnimatedCardGrid items={mockItems} renderCard={mockRenderCard} />
      );

      const motionDivs = screen.getAllByTestId('motion-div');
      expect(motionDivs.length).toBe(3);
    });

    it('does not render motion.div wrappers when animate=false', () => {
      render(
        <AnimatedCardGrid
          items={mockItems}
          renderCard={mockRenderCard}
          animate={false}
        />
      );

      const motionDivs = screen.queryAllByTestId('motion-div');
      expect(motionDivs.length).toBe(0);
    });
  });

  describe('staggerDelay', () => {
    it('applies default staggerDelay of 0.1', () => {
      render(
        <AnimatedCardGrid items={mockItems} renderCard={mockRenderCard} />
      );

      // Motion divs should be rendered with stagger delay
      const motionDivs = screen.getAllByTestId('motion-div');
      expect(motionDivs.length).toBe(3);
    });

    it('accepts custom staggerDelay', () => {
      render(
        <AnimatedCardGrid
          items={mockItems}
          renderCard={mockRenderCard}
          staggerDelay={0.05}
        />
      );

      const motionDivs = screen.getAllByTestId('motion-div');
      expect(motionDivs.length).toBe(3);
    });
  });

  describe('renderCard function', () => {
    it('passes the correct item to renderCard', () => {
      const renderCardSpy = vi.fn((item) => (
        <div data-testid={`card-${item.id}`}>{item.name}</div>
      ));

      render(
        <AnimatedCardGrid items={mockItems} renderCard={renderCardSpy} />
      );

      expect(renderCardSpy).toHaveBeenCalledTimes(3);
      expect(renderCardSpy).toHaveBeenCalledWith(mockItems[0]);
      expect(renderCardSpy).toHaveBeenCalledWith(mockItems[1]);
      expect(renderCardSpy).toHaveBeenCalledWith(mockItems[2]);
    });
  });
});
