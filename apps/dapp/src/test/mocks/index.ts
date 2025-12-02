/**
 * Test mocks barrel export
 * Convenient single import for all mocks
 */

// Export all Dapp-Kit mocks
export * from "./dapp-kit";
// Export all Seal mocks
export * from "./seal";
// Export Seal Session mocks
export * from "./seal-session";
// Export all Walrus mocks
export * from "./walrus";

import { resetDappKitMocks } from "./dapp-kit";
/**
 * Reset all mocks helper
 * Call this in beforeEach() to ensure clean state
 */
import { resetSealMocks } from "./seal";
import { resetSealSessionMocks } from "./seal-session";
import { resetWalrusMocks } from "./walrus";

export const resetAllMocks = (): void => {
	resetSealMocks();
	resetWalrusMocks();
	resetDappKitMocks();
	resetSealSessionMocks();
};
