import { createNetworkConfig } from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui/client";

const { networkConfig, useNetworkVariable, useNetworkVariables } =
	createNetworkConfig({
		localnet: {
			url: "http://localhost:9000",
			variables: {
				packageId:
					"0x4d98fb194669caed4c51fb1ae848e6c2bba7fa537549a838cf3d6ad7996d5ebb", // Will be updated after deployment
				treasuryId:
					"0x58dde835a86cf87a685ce756f87cc8b78be83f60f36e05fe87ec895fbc57b820", // Will be updated after deployment
				transferPolicyId: "0x0", // Will be updated after deployment
				sealKeyServers: [] as string[], // No Seal servers for localnet
			},
		},
		devnet: {
			url: getFullnodeUrl("devnet"),
			variables: {
				packageId: "0x0",
				treasuryId: "0x0",
				transferPolicyId: "0x0",
				sealKeyServers: [] as string[], // Add devnet servers when available
			},
		},
		testnet: {
			url: getFullnodeUrl("testnet"),
			variables: {
				packageId:
					"0xca8aa8100279d691d24a1ffdcb0b1b4973438b398d1099f9f1b98f97f9a7dfcf",
				treasuryId:
					"0xc538614f76899fadc7cd4b0d7add1cf73040ed95a5df700f58d0dc7c59823ec1",
				transferPolicyId:
					"0x71ad85ae9ed409151762d78d16fa5159976aece39de3d6fe2f35ab4acfc16146",
				// Mysten Labs Open Mode Key Servers (Testnet)
				sealKeyServers: [
					"0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75", // mysten-testnet-1
					"0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8", // mysten-testnet-2
				],
			},
		},
		mainnet: {
			url: getFullnodeUrl("mainnet"),
			variables: {
				packageId: "0x0",
				treasuryId: "0x0",
				transferPolicyId: "0x0",
				sealKeyServers: [] as string[], // Add mainnet servers when needed
			},
		},
	});

export { useNetworkVariable, useNetworkVariables, networkConfig };
