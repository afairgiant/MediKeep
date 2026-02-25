import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import DirectoryCard from '../DirectoryCard';

const renderDirectoryCard = (props) => {
  return render(
    <MantineProvider>
      <DirectoryCard {...props} />
    </MantineProvider>
  );
};

const healthyDir = {
  exists: true,
  write_permission: true,
  size_mb: 42,
  file_count: 15,
};

const unhealthyDir = {
  exists: true,
  write_permission: false,
  size_mb: 0,
  file_count: 0,
};

const errorDir = {
  exists: false,
  write_permission: false,
  size_mb: 0,
  file_count: 0,
  error: 'Directory not found',
};

describe('DirectoryCard', () => {
  test('renders directory name capitalized', () => {
    renderDirectoryCard({ name: 'uploads', info: healthyDir });

    expect(screen.getByText('Uploads')).toBeInTheDocument();
  });

  test('shows OK badge for healthy directory', () => {
    renderDirectoryCard({ name: 'uploads', info: healthyDir });

    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  test('shows Error badge when write_permission is false', () => {
    renderDirectoryCard({ name: 'backups', info: unhealthyDir });

    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  test('shows Error badge when directory does not exist', () => {
    renderDirectoryCard({ name: 'logs', info: errorDir });

    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  test('displays size and file count', () => {
    renderDirectoryCard({ name: 'uploads', info: healthyDir });

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('MB')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('files')).toBeInTheDocument();
  });

  test('renders error alert when info.error exists', () => {
    renderDirectoryCard({ name: 'logs', info: errorDir });

    expect(screen.getByText('Directory not found')).toBeInTheDocument();
  });

  test('does not render error alert when no error', () => {
    renderDirectoryCard({ name: 'uploads', info: healthyDir });

    expect(screen.queryByText('Directory not found')).not.toBeInTheDocument();
  });

  test('handles unknown directory names with fallback icon', () => {
    renderDirectoryCard({ name: 'cache', info: healthyDir });

    expect(screen.getByText('Cache')).toBeInTheDocument();
    expect(screen.getByText('OK')).toBeInTheDocument();
  });
});
