import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import { Layout, Navbar } from "nextra-theme-docs";
import "nextra-theme-docs/style.css";
import "./globals.css";

export const metadata = {
	// Define your metadata here
	// For more information on metadata API, see: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
};

// const banner = <Banner storageKey="some-key">Axyl docs are live 🎉</Banner>;
const navbar = (
	<Navbar
		logo={
			<div className="h-full">
				<p className="sr-only">Axyl</p>
				{/** biome-ignore lint/a11y/noSvgWithoutTitle: <explanation> */}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 3207 485"
					fill="currentColor"
					height={14}
				>
					<line
						x1="362.28"
						y1="151"
						x2="362"
						y2="151.16"
						stroke="currentColor"
					/>
					<polygon points="2446 0 2446 87.14 2380.42 125 2335.39 151 2118.88 276 2075 301.33 2018.42 334 1855.8 427.89 1756.88 485 1455 485 1455 334 1716.54 334 1817.03 276 1592.64 276 1455 196.56 1455 151 1373.92 151 795.41 485 362 485 362 334 754.94 334 855.4 276 930.75 232.5 789.62 151 362 151 362 151.16 151 272.98 151 485 0 485 0 185.8 60.28 151 105.31 125 151 98.62 321.82 0 830.32 0 1046.89 125 1081.93 145.22 1116.95 125 1223.97 63.21 1333.46 0 1606 0 1606 151 2033.6 151 2075 127.11 2078.65 125 2295.22 0 2446 0" />
					<polygon points="1397.25 327.22 1397.25 485 1368 485 1140.84 353.82 1175.18 334 1275.64 276 1292.07 266.51 1308.51 276 1397.25 327.22" />
					<polygon points="3207 217.14 3207 485 2075 485 2075 368.31 2134.42 334 2234.88 276 2446 154.11 2451.39 151 2496.42 125 2671.08 24.16 2712.93 0 2876 0 2876 81.17 2822.91 111.82 2800.09 125 2755.06 151 2538.55 276 2446 329.43 2446 334 3056 334 3056 305.29 3005.28 276 2920 226.77 2920 151 3092.44 151 3207 217.14" />
				</svg>
			</div>
		}
		// ... Your additional navbar options
	/>
);
// const footer = <Footer>MIT {new Date().getFullYear()} © Axyl.</Footer>;

export default async function RootLayout({ children }) {
	return (
		<html
			// Not required, but good for SEO
			lang="en"
			// Required to be set
			dir="ltr"
			// Suggested by `next-themes` package https://github.com/pacocoursey/next-themes#with-app
			suppressHydrationWarning
		>
			<Head
			// ... Your additional head options
			>
				{/* Your additional tags should be passed as `children` of `<Head>` element */}
			</Head>
			<body>
				<Layout
					// banner={banner}
					navbar={navbar}
					pageMap={await getPageMap()}
					docsRepositoryBase="https://github.com/Axyl1410/sora-vault/tree/main/apps/docs"
					// footer={footer}
					// ... Your additional layout options
				>
					{children}
				</Layout>
			</body>
		</html>
	);
}
