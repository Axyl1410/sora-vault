import { Box, Flex } from "@radix-ui/themes";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Footer } from "./components/Layout/Footer";
import { Header } from "./components/Layout/Header";
import { Sidebar } from "./components/Layout/Sidebar";
import { PublisherThemeProvider } from "./contexts/PublisherThemeContext";
import { ReaderThemeProvider } from "./contexts/ReaderThemeContext";
import { AnalyticsDashboardPage } from "./pages/AnalyticsDashboardPage";
import { ArticleReaderPage } from "./pages/ArticleReaderPage";
import { BackendInfoPage } from "./pages/BackendInfoPage";
import { CreatePublicationPage } from "./pages/CreatePublicationPage";
import { DashboardPage } from "./pages/DashboardPage";
import { FeedPage } from "./pages/FeedPage";
import { HomePage } from "./pages/HomePage";
import { MarketplacePage } from "./pages/MarketplacePage";
import { MySubscriptionsPage } from "./pages/MySubscriptionsPage";
import { PublicationArticlesPage } from "./pages/PublicationArticlesPage";
import { PublicationDetailPage } from "./pages/PublicationDetailPage";
import { PublicationManagementPage } from "./pages/PublicationManagementPage";
import { PublicationSettingsPage } from "./pages/PublicationSettingsPage";
import { PublicationsPage } from "./pages/PublicationsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { WriteArticlePage } from "./pages/WriteArticlePage";

function App() {
	return (
		<ReaderThemeProvider>
			<PublisherThemeProvider>
				<BrowserRouter>
					<Flex direction="column" style={{ minHeight: "100vh" }}>
						<Header />

						<Flex style={{ flex: 1 }}>
							{/* Left Sidebar - Shows when wallet connected */}
							<Sidebar />

							{/* Main Content Area */}
							<Box style={{ flex: 1, overflowX: "auto" }}>
								<Routes>
									<Route path="/" element={<HomePage />} />
									<Route path="/feed" element={<FeedPage />} />
									<Route path="/publications" element={<PublicationsPage />} />
									<Route
										path="/publications/:id"
										element={<PublicationDetailPage />}
									/>
									<Route
										path="/publications/:pubId/articles/:articleId"
										element={<ArticleReaderPage />}
									/>
									<Route
										path="/articles/:articleId"
										element={<ArticleReaderPage />}
									/>
									<Route
										path="/create-publication"
										element={<CreatePublicationPage />}
									/>
									<Route path="/dashboard" element={<DashboardPage />} />
									<Route
										path="/dashboard/write"
										element={<WriteArticlePage />}
									/>
									<Route
										path="/dashboard/publications/:id"
										element={<PublicationManagementPage />}
									/>
									<Route
										path="/dashboard/publications/:id/articles"
										element={<PublicationArticlesPage />}
									/>
									<Route
										path="/dashboard/publications/:id/analytics"
										element={<AnalyticsDashboardPage />}
									/>
									<Route
										path="/dashboard/publications/:id/settings"
										element={<PublicationSettingsPage />}
									/>
									<Route
										path="/my-subscriptions"
										element={<MySubscriptionsPage />}
									/>
									<Route path="/marketplace" element={<MarketplacePage />} />
									<Route path="/settings" element={<SettingsPage />} />
									<Route path="/backend-info" element={<BackendInfoPage />} />
								</Routes>
							</Box>
						</Flex>

						<Footer />
					</Flex>
				</BrowserRouter>
			</PublisherThemeProvider>
		</ReaderThemeProvider>
	);
}

export default App;
