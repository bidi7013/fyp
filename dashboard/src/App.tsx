import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { JobsProvider } from './lib/jobs';
import { Shell } from './components/Shell';
import { RunsPage } from './pages/RunsPage';
import { NewRunPage } from './pages/NewRunPage';
import { VideosPage } from './pages/VideosPage';
import { ComparePage } from './pages/ComparePage';
import { RunPage } from './pages/run/RunPage';

// Hash routing keeps deep links working when the built dashboard is served
// as static files by `python -m src.cli serve`.
export default function App() {
  return (
    <HashRouter>
      <JobsProvider>
        <Shell>
          <Routes>
            <Route path="/" element={<RunsPage />} />
            <Route path="/new" element={<NewRunPage />} />
            <Route path="/videos" element={<VideosPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/runs/:runId" element={<RunPage />} />
            <Route path="/runs/:runId/:tab" element={<RunPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Shell>
      </JobsProvider>
    </HashRouter>
  );
}
