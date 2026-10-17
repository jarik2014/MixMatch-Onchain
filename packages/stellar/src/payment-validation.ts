/**
 * Up-front validation for payment parameters (#1258).
 *
 * Without this, a memo longer than 28 bytes, a malformed destination, a bad
 * amount or an invalid asset code were thrown *inside* the submission `try`
 * block and classified as `network_error` ("Failed to reach Stellar network") —
 * pointing the user at the network for their own input mistake.
 */

import { StrKey } from '@stellar/stellar-sdk';

import { StellarPaymentError } from './payment-errors.js';

/** Stellar text memos are capped at 28 *bytes*, not characters. */
const MEMO_MAX_BYTES = 28;
const AMOUNT_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,7})?$/;
const ASSET_CODE_PATTERN = /^[A-Za-z0-9]{1,12}$/;

export interface PaymentValidationInput {
  destinationPublicKey: string;
  amount: string;
  memo?: string;
  asset?: { code: string; issuer: string };
}

function fail(field: string, message: string): never {
  throw new StellarPaymentError('validation', message, { field });
}

/** Throws `StellarPaymentError('validation')` for anything the network would reject anyway. */
export function validatePaymentParams(params: PaymentValidationInput): void {
  const destination = params.destinationPublicKey?.trim() ?? '';
  if (!StrKey.isValidEd25519PublicKey(destination)) {
    fail('destinationPublicKey', 'Destination is not a valid Stellar account address.');
  }

  const amount = params.amount?.trim() ?? '';
  if (!AMOUNT_PATTERN.test(amount)) {
    fail('amount', 'Amount must be a positive decimal with at most 7 fractional digits.');
  }
  if (Number(amount) <= 0) {
    fail('amount', 'Amount must be greater than zero.');
  }

  if (params.memo !== undefined) {
    // Byte length, not string length: "ё" and emoji take two and four bytes.
    const bytes = new TextEncoder().encode(params.memo).length;
    if (bytes > MEMO_MAX_BYTES) {
      fail('memo', `Memo is ${bytes} bytes; Stellar allows at most ${MEMO_MAX_BYTES}.`);
    }
  }

  if (params.asset !== undefined) {
    if (!ASSET_CODE_PATTERN.test(params.asset.code ?? '')) {
      fail('asset.code', 'Asset code must be 1-12 alphanumeric characters.');
    }
    if (!StrKey.isValidEd25519PublicKey(params.asset.issuer ?? '')) {
      fail('asset.issuer', 'Asset issuer is not a valid Stellar account address.');
    }
  }
}
