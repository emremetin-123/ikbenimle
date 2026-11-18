import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Navigate, useLocation, useParams, useNavigate } from './router';
import { AuthProvider, useAuth } from './AuthContext';
import { Login } from './Login';
import { DashboardLayout } from './layouts/DashboardLayout';
import { SessionTimeout } from './SessionTimeout';
import { LoadingIndicator } from './components/LoadingIndicator';

const AdminDashboard = lazy(() => import('./AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const VideoPlayer = lazy(() => import('./VideoPlayer').then(module => ({ default: module.VideoPlayer })));
const Home = lazy(() => import('./pages/Home').then(module => ({ default: module.Home })));
const Trainings = lazy(() => import('./pages/Trainings').then(module => ({ default: module.Trainings })));
const PersonalInfo = lazy(() => import('./pages/PersonalInfo').then(module => ({ default: module.PersonalInfo })));
const Documents = lazy(() => import('./pages/Documents').then(module => ({ default: module.Documents })));
const Announcements = lazy(() => import('./pages/Announcements').then(module => ({ default: module.Announcements })));
const Feedback = lazy(() => import('./pages/Feedback').then(module => ({ default: module.Feedback })));
const Directory = lazy(() => import('./pages/Directory').then(module => ({ default: module.Directory })));
const Careers = lazy(() => import('./pages/Careers').then(module => ({ default: module.Careers })));
const JobDetail = lazy(() => import('./pages/JobDetail').then(module => ({ default: module.JobDetail })));
const KnowledgePortal = lazy(() => import('./pages/KnowledgePortal').then(module => ({ default: module.KnowledgePortal })));
const Surveys = lazy(() => import('./pages/Surveys').then(module => ({ default: module.Surveys })));
const LeaveRequests = lazy(() => import('./pages/LeaveRequests').then(module => ({ default: module.LeaveRequests })));
const ServiceRoutes = lazy(() => import('./pages/ServiceRoutes').then(module => ({ default: module.ServiceRoutes })));
const PolyvalenceTasks = lazy(() => import('./pages/PolyvalenceTasks').then(module => ({ default: module.PolyvalenceTasks })));

const RouteLoading = () => <LoadingIndicator label="Sayfa yükleniyor" />;

const VideoPlayerWrapper = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  return <VideoPlayer videoId={Number(id)} onBack={() => navigate('/employee/egitimler')} />;
};

const AdminModuleWrapper = () => {
  const { module } = useParams();
  const tabMap = {
    egitimler: 'egitimler',
    kullanicilar: 'kullanicilar',
    duyurular: 'duyurular',
    haberler: 'haberler',
    belgeler: 'belgeler',
    geribildirim: 'geribildirim',
    kariyer: 'kariyer',
    'bilgi-portali': 'bilgi-portali',
    anketler: 'anketler',
    'yemek-menusu': 'yemek-menusu',
    'servis-guzergahlari': 'servis-guzergahlari',
    'ai-ayarlari': 'ai-ayarlari',
    'api-entegrasyonlari': 'api-entegrasyonlari',
    'duygu-analizi': 'duygu-analizi',
    bildirimler: 'bildirimler',
    polivalans: 'polivalans',
    'log-kayitlari': 'log-kayitlari',
  } as const;

  const embeddedTab = module && module in tabMap ? tabMap[module as keyof typeof tabMap] : 'egitimler';
  return <AdminDashboard embeddedTab={embeddedTab} />;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingIndicator label="Oturum bilgileri yükleniyor" />;
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

const EmployeeRoutes = () => {
  const { pathname } = useLocation();
  const routes: Record<string, React.ReactNode> = {
    '/employee/anasayfa': <Home />,
    '/employee/duyurular': <Announcements />,
    '/employee/egitimler': <Trainings />,
    '/employee/kisisel-bilgiler': <PersonalInfo />,
    '/employee/izinler': <LeaveRequests />,
    '/employee/belgelerim': <Documents />,
    '/employee/oneri-sikayet': <Feedback />,
    '/employee/rehber': <Directory />,
    '/employee/kariyer': <Careers />,
    '/employee/bilgi-portali': <KnowledgePortal />,
    '/employee/anketler': <Surveys />,
    '/employee/servis-guzergahlari': <ServiceRoutes />,
    '/employee/polivalans': <PolyvalenceTasks />,
  };

  let page = routes[pathname];
  if (/^\/employee\/kariyer\/[^/]+\/?$/.test(pathname)) page = <JobDetail />;
  if (/^\/employee\/moduller\/[^/]+\/?$/.test(pathname)) page = <AdminModuleWrapper />;
  if (!page) return <Navigate to="/employee/anasayfa" replace />;

  return (
    <ProtectedRoute>
      <DashboardLayout>{page}</DashboardLayout>
    </ProtectedRoute>
  );
};

const AppRoutes = () => {
  const { pathname } = useLocation();

  if (pathname === '/login') return <Login />;

  if (pathname === '/' || pathname === '/admin' || pathname === '/employee') {
    return (
      <ProtectedRoute>
        <Navigate to="/employee/anasayfa" replace />
      </ProtectedRoute>
    );
  }
  if (/^\/employee\/egitimler\/[^/]+\/?$/.test(pathname)) {
    return (
      <ProtectedRoute>
        <VideoPlayerWrapper />
      </ProtectedRoute>
    );
  }
  if (pathname.startsWith('/employee/')) return <EmployeeRoutes />;
  return <Navigate to="/" replace />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <SessionTimeout />
        <div className="app-root">
          <div className="app-route-frame">
            <Suspense fallback={<RouteLoading />}>
              <AppRoutes />
            </Suspense>
          </div>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
