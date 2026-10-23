import { assertTransition } from '../src/modules/orders/order.rules.js';
import { escapeRegex } from '../src/common/utils/regex.js';

describe('order status machine', () => {
  it('allows the documented transitions', () => {
    expect(() => assertTransition('pending', 'processing', 'admin', false)).not.toThrow();
    expect(() => assertTransition('processing', 'shipped', 'admin', false)).not.toThrow();
    expect(() => assertTransition('shipped', 'delivered', 'admin', false)).not.toThrow();
    expect(() => assertTransition('pending', 'cancelled', 'customer', true)).not.toThrow();
    expect(() => assertTransition('processing', 'cancelled', 'admin', false)).not.toThrow();
  });
  it('rejects everything else', () => {
    expect(() => assertTransition('pending', 'shipped', 'admin', false)).toThrow(/Cannot change/);
    expect(() => assertTransition('processing', 'cancelled', 'customer', true)).toThrow();
    expect(() => assertTransition('pending', 'processing', 'customer', true)).toThrow();
    expect(() => assertTransition('delivered', 'cancelled', 'admin', false)).toThrow();
    expect(() => assertTransition('cancelled', 'pending', 'admin', false)).toThrow();
  });
});

describe('escapeRegex', () => {
  it('neutralises regex metacharacters so user input cannot break or DoS the query', () => {
    expect(() => new RegExp(escapeRegex('('), 'i')).not.toThrow();
    expect(new RegExp(escapeRegex('a.b'), 'i').test('axb')).toBe(false);
    expect(new RegExp(escapeRegex('a.b'), 'i').test('A.B')).toBe(true);
  });
});
