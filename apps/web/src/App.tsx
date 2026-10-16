import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router';
import styles from './App.module.css';
import { CompetitorListPage } from './features/competitors/CompetitorListPage';
import { TimelinePage } from './features/timeline/TimelinePage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
});

function Layout() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>CompetitorPulse</h1>
      <Outlet />
    </main>
  );
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <CompetitorListPage /> },
      { path: '/competitors/:id', element: <TimelinePage /> },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
