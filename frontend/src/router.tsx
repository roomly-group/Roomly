import { lazy, Suspense } from 'react';
import { Route, Switch, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
const NotFound = lazy(() => import('@/pages/not-found'));
const Home = lazy(() => import('@/pages/home').then((m) => ({ default: m.Home })));
const LoginPage = lazy(() => import('@/pages/login').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/pages/register').then((m) => ({ default: m.RegisterPage })));
const SearchPage = lazy(() => import('@/pages/search').then((m) => ({ default: m.SearchPage })));
const ListingDetail = lazy(() => import('@/pages/listing-detail').then((m) => ({ default: m.ListingDetail })));
const StudentMessagesRoute = lazy(() => import('@/pages/messages').then((m) => ({ default: m.StudentMessagesRoute })));
const OwnerMessagesRoute = lazy(() => import('@/pages/messages').then((m) => ({ default: m.OwnerMessagesRoute })));
const StudentProfileRoute = lazy(() => import('@/pages/profile').then((m) => ({ default: m.StudentProfileRoute })));
const OwnerProfileRoute = lazy(() => import('@/pages/profile').then((m) => ({ default: m.OwnerProfileRoute })));
const UserPreferencesPage = lazy(() => import('@/pages/user-preferences').then((m) => ({ default: m.UserPreferencesPage })));
const OwnerDashboard = lazy(() => import('@/pages/owner-dashboard').then((m) => ({ default: m.OwnerDashboard })));
const NewListingPage = lazy(() => import('@/pages/new-listing').then((m) => ({ default: m.NewListingPage })));
const EditListingPage = lazy(() => import('@/pages/edit-listing').then((m) => ({ default: m.EditListingPage })));
const WaitlistPage = lazy(() => import('@/pages/waitlist').then((m) => ({ default: m.WaitlistPage })));
const WaitlistConfirmedPage = lazy(() => import('@/pages/waitlist-confirmed').then((m) => ({ default: m.WaitlistConfirmedPage })));
const ChiSiamoPage = lazy(() => import('@/pages/chi-siamo').then((m) => ({ default: m.ChiSiamoPage })));
const ContattiPage = lazy(() => import('@/pages/contatti').then((m) => ({ default: m.ContattiPage })));
const PrivacyPage = lazy(() => import('@/pages/privacy').then((m) => ({ default: m.PrivacyPage })));
const TerminiPage = lazy(() => import('@/pages/termini').then((m) => ({ default: m.TerminiPage })));
const CookiePage = lazy(() => import('@/pages/cookie').then((m) => ({ default: m.CookiePage })));
import { RequireAuth } from '@/components/RequireAuth';
import { RequireAdmin } from '@/components/RequireAdmin';
import { RequireOwner } from '@/components/RequireOwner';
import { APP_ROUTES } from '@/lib/constants';

export function Router() {
  const [location] = useLocation();

  return (
    <ErrorBoundary resetKey={location}>
      {/* Each page is its own chunk: the first visit downloads only the page it opens. */}
      <Suspense fallback={<div className="min-h-screen bg-cream" />}>
      <Switch>
        {/* The app now opens on the login page instead of Home. */}
        <Route path={APP_ROUTES.ROOT} component={WaitlistPage} />
        <Route path={APP_ROUTES.LOGIN} component={LoginPage} />
        <Route path={APP_ROUTES.REGISTER} component={RegisterPage} />
        <Route path={APP_ROUTES.HOME}>
          <RequireAdmin allowOwner>
            <Home />
          </RequireAdmin>
        </Route>
        <Route path={APP_ROUTES.SEARCH}>
          <RequireAdmin allowOwner>
            <SearchPage />
          </RequireAdmin>
        </Route>
        <Route path={APP_ROUTES.LISTING_DETAIL}>
          <RequireAdmin allowOwner>
            <ListingDetail />
          </RequireAdmin>
        </Route>
        <Route path={APP_ROUTES.MESSAGE_DETAIL}>
          <RequireAdmin allowOwner>
            <StudentMessagesRoute />
          </RequireAdmin>
        </Route>
        <Route path={APP_ROUTES.PROFILE}>
          <RequireAuth>
            <StudentProfileRoute />
          </RequireAuth>
        </Route>
        <Route path={APP_ROUTES.PROFILE_PREFERENCES}>
          <RequireAuth>
            <UserPreferencesPage />
          </RequireAuth>
        </Route>
        <Route path={APP_ROUTES.OWNER_LISTING_NEW}>
          <RequireAuth>
            <RequireOwner>
              <NewListingPage />
            </RequireOwner>
          </RequireAuth>
        </Route>
        <Route path={APP_ROUTES.OWNER_MESSAGE_DETAIL}>
          <RequireAuth>
            <OwnerMessagesRoute />
          </RequireAuth>
        </Route>
        <Route path={APP_ROUTES.OWNER_PROFILE}>
          <RequireAuth>
            <RequireOwner>
              <OwnerProfileRoute />
            </RequireOwner>
          </RequireAuth>
        </Route>
        <Route path={APP_ROUTES.OWNER_PROFILE_PREFERENCES}>
          <RequireAuth>
            <RequireOwner>
              <UserPreferencesPage owner />
            </RequireOwner>
          </RequireAuth>
        </Route>
        <Route path={APP_ROUTES.OWNER_LISTING_EDIT}>
          <RequireAuth>
            <RequireOwner>
              <EditListingPage />
            </RequireOwner>
          </RequireAuth>
        </Route>
        <Route path={APP_ROUTES.OWNER_DASHBOARD}>
          <RequireAuth>
            <RequireOwner>
              <OwnerDashboard />
            </RequireOwner>
          </RequireAuth>
        </Route>
        <Route path={APP_ROUTES.WAITLIST} component={WaitlistPage} />
        <Route path={APP_ROUTES.WAITLIST_CONFIRMED} component={WaitlistConfirmedPage} />
        <Route path={APP_ROUTES.ABOUT} component={ChiSiamoPage} />
        <Route path={APP_ROUTES.CONTACT} component={ContattiPage} />
        <Route path={APP_ROUTES.PRIVACY} component={PrivacyPage} />
        <Route path={APP_ROUTES.TERMS} component={TerminiPage} />
        <Route path={APP_ROUTES.COOKIES} component={CookiePage} />
        <Route component={NotFound} />
      </Switch>
      </Suspense>
    </ErrorBoundary>
  );
}