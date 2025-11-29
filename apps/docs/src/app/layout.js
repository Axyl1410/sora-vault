import { Banner, Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import "nextra-theme-docs/style.css";

export const metadata = {
	// Define your metadata here
	// For more information on metadata API, see: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
};

// const banner = <Banner storageKey="some-key">Axyl docs are live 🎉</Banner>;
const navbar = (
	<Navbar
		logo={<b>Sora Vault</b>}
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
