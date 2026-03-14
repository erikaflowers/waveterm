import { describe, test, expect } from 'vitest';
import { formatDate, slugify, truncate } from './utils.js';

describe('slugify', () => {
  test('converts text to lowercase slug', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  test('handles special characters', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
  });

  test('collapses multiple spaces and dashes', () => {
    expect(slugify('too   many   spaces')).toBe('too-many-spaces');
  });

  test('trims leading and trailing dashes', () => {
    expect(slugify('  --hello--  ')).toBe('hello');
  });
});

describe('truncate', () => {
  test('returns short text unchanged', () => {
    expect(truncate('Hello', 100)).toBe('Hello');
  });

  test('truncates long text with ellipsis', () => {
    expect(truncate('This is a long sentence that should be truncated', 20)).toBe('This is a long sente...');
  });

  test('uses default maxLength of 100', () => {
    const short = 'Short text';
    expect(truncate(short)).toBe(short);
  });
});

describe('formatDate', () => {
  test('formats a date string', () => {
    const result = formatDate('2026-01-15T12:00:00');
    expect(result).toContain('2026');
    expect(result).toContain('January');
    expect(result).toContain('15');
  });

  test('formats a Date object', () => {
    const result = formatDate(new Date(2026, 0, 15));
    expect(result).toContain('2026');
  });
});
