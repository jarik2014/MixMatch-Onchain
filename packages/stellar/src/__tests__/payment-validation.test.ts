import { describe, expect, it } from 'vitest';

import { StellarPaymentError } from '../payment-errors.js';
import { validatePaymentParams } from '../payment-validation.js';

// Real StrKey account addresses (the SDK validates the base32 checksum, so a
// made-up "G..." string would be rejected for the wrong reason).
const DEST = 'GCHLHDBOKG2JWMJQBTLSL5XG6NO7ESXI2TAQKZXCXWXB5WI2X6W233PR';
const ISSUER = 'GCDNJUBQSX7AJWLJACMJ7I4BC3Z47BQUTMHEICZLE6MU4KQBRYG5JY6B';

function expectValidationError(field: string, params: Parameters<typeof validatePaymentParams>[0]) {
  try {
    validatePaymentParams(params);
  } catch (error) {
    expect(error).toBeInstanceOf(StellarPaymentError);
    const paymentError = error as StellarPaymentError;
    expect(paymentError.kind).toBe('validation');
    expect(paymentError.field).toBe(field);
    return paymentError;
  }
  throw new Error(`expected a validation error for ${field}`);
}

describe('validatePaymentParams (#1258)', () => {
  it('accepts a well-formed payment', () => {
    expect(() =>
      validatePaymentParams({ destinationPublicKey: DEST, amount: '1.5', memo: 'invoice-42' }),
    ).not.toThrow();
  });

  it('rejects a destination that is not an account address', () => {
    expectValidationError('destinationPublicKey', {
      destinationPublicKey: 'not-an-address',
      amount: '1',
    });
  });

  it('rejects an amount with more than 7 decimals, zero, and garbage', () => {
    for (const amount of ['1.12345678', '0', '-1', 'abc', '']) {
      expectValidationError('amount', { destinationPublicKey: DEST, amount });
    }
    expect(() => validatePaymentParams({ destinationPublicKey: DEST, amount: '1.1234567' })).not.toThrow();
  });

  it('rejects a memo longer than 28 bytes, counting bytes not characters', () => {
    // 15 two-byte Cyrillic characters = 30 bytes: fits in "28 characters", not in 28 bytes.
    expectValidationError('memo', {
      destinationPublicKey: DEST,
      amount: '1',
      memo: 'щ'.repeat(15),
    });
    expect(() =>
      validatePaymentParams({ destinationPublicKey: DEST, amount: '1', memo: 'a'.repeat(28) }),
    ).not.toThrow();
  });

  it('rejects a bad asset code and a bad issuer', () => {
    expectValidationError('asset.code', {
      destinationPublicKey: DEST,
      amount: '1',
      asset: { code: 'TOO-LONG-CODE', issuer: ISSUER },
    });
    expectValidationError('asset.issuer', {
      destinationPublicKey: DEST,
      amount: '1',
      asset: { code: 'USDC', issuer: 'nope' },
    });
  });

  it('is never classified as a network failure', () => {
    const error = expectValidationError('amount', { destinationPublicKey: DEST, amount: 'x' });
    expect(error.kind).not.toBe('network_error');
    expect(error.message).not.toMatch(/Failed to reach Stellar network/i);
  });
});
