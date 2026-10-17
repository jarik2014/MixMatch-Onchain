import type { StellarNetwork } from './types/index.js';

export interface StellarConfig {
  network: StellarNetwork;
  horizonUrl: string;
  rpcUrl: string;
  /** Deployed id of the escrow contract (see contracts/escrow) on this network, if configured. */
  escrowContractId?: string;
}

const NETWORK_DEFAULTS: Record<StellarNetwork, { horizonUrl: string; rpcUrl: string }> = {
  testnet: {
    horizonUrl: 'https://horizon-testnet.stellar.org',
    rpcUrl: 'https://soroban-testnet.stellar.org',
  },
  public: {
    horizonUrl: 'https://horizon.stellar.org',
    rpcUrl: 'https://mainnet.sorobanrpc.com',
  },
};

const KNOWN_NETWORKS = ['testnet', 'public'] as const;

/**
 * Resolves `STELLAR_NETWORK`.
 *
 * Unset stays a documented default (testnet), but a *set* value we do not
 * recognise is an error: silently falling back to testnet means a deployment
 * that meant mainnet talks to the wrong network, and a typo reports success
 * while pointing at testnet (#1246).
 */
function parseNetwork(raw: string | undefined): StellarNetwork {
  const value = raw?.trim().toLowerCase();
  if (!value) return 'testnet';

  const match = KNOWN_NETWORKS.find((known) => known === value);
  if (match) return match;

  throw new Error(
    `Unknown STELLAR_NETWORK "${raw}". Expected one of: ${KNOWN_NETWORKS.join(', ')}. ` +
      'Refusing to guess a network — leave the variable unset to use testnet.',
  );
}

/** Builds a `StellarConfig` from environment variables, falling back to sensible network defaults. */
export function loadStellarConfig(env: NodeJS.ProcessEnv = process.env): StellarConfig {
  const network = parseNetwork(env.STELLAR_NETWORK);
  const defaults = NETWORK_DEFAULTS[network];

  return {
    network,
    horizonUrl: env.STELLAR_HORIZON_URL?.trim() || defaults.horizonUrl,
    rpcUrl: env.STELLAR_RPC_URL?.trim() || defaults.rpcUrl,
    escrowContractId: env.STELLAR_ESCROW_CONTRACT_ID?.trim() || undefined,
  };
}
