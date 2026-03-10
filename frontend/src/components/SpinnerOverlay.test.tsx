import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { SpinnerOverlay } from './SpinnerOverlay';

describe('SpinnerOverlay', () => {
  it('renders the provided message text', () => {
    render(<SpinnerOverlay message="Loading image..." />);
    expect(screen.getByText('Loading image...')).toBeInTheDocument();
  });

  it('has a status role for accessibility', () => {
    render(<SpinnerOverlay message="Processing..." />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has aria-live polite attribute on the status container', () => {
    render(<SpinnerOverlay message="Uploading..." />);
    const statusEl = screen.getByRole('status');
    expect(statusEl.getAttribute('aria-live')).toBe('polite');
  });

  it('hides the spinner SVG from assistive technology', () => {
    render(<SpinnerOverlay message="Saving..." />);
    const svg = screen.getByRole('status').querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });
});
