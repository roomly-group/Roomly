import { Route, Switch, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { Home } from '@/pages/home';
import { LoginPage } from '@/pages/login';
import { RegisterPage } from '@/pages/register';
import { SearchPage } from '@/pages/search';
import { ListingDetail } from '@/pages/listing-detail';
import { StudentMessagesRoute, OwnerMessagesRoute } from '@/pages/messages';
import { StudentProfileRoute, OwnerProfileRoute } from '@/pages/profile';
import { OwnerDashboard } from '@/pages/owner-dashboard';
import { NewListingPage } from '@/pages/new-listing';
import { WaitlistPage } from '@/pages/waitlist';
import { WaitlistConfirmedPage } from '@/pages/waitlist-confirmed';
import { RequireAuth } from '@/components/RequireAuth';
import { RequireAdmin } from '@/components/RequireAdmin';
import { RequireOwner } from '@/components/RequireOwner';

export function Router() {
  const [location] = useLocation();

  return (
    <ErrorBoundary resetKey={location}>
      <Switch>
        {/* The app now opens on the login page instead of Home. */}
        <Route path="/" component={WaitlistPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/home" component={() => (
          <RequireAdmin>
            <Home />
          </RequireAdmin>
        )} />
        <Route path="/search" component={() => (
          <RequireAdmin>
            <SearchPage />
          </RequireAdmin>
        )} />
        <Route path="/listings/:id" component={() => (
          <RequireAdmin>
            <ListingDetail />
          </RequireAdmin>
        )} />
        <Route path="/messages/:id" component={() => (
          <RequireAdmin>
            <StudentMessagesRoute />
          </RequireAdmin>
        )} />
        <Route path="/messages" component={() => (
          <RequireAdmin>
            <StudentMessagesRoute />
          </RequireAdmin>
        )} />
        <Route path="/profile" component={() => (
          <RequireAuth>
            <StudentProfileRoute />
          </RequireAuth>
        )} />
        <Route path="/owner/listings/new" component={() => (
          <RequireAdmin>
            <RequireOwner>
              <NewListingPage />
            </RequireOwner>
          </RequireAdmin>
        )} />
        <Route path="/owner/messages" component={() => (
          <RequireAdmin>
            <RequireOwner>
              <OwnerMessagesRoute />
            </RequireOwner>
          </RequireAdmin>
        )} />
        <Route path="/owner/profile" component={() => (
          <RequireAdmin>
            <RequireOwner>
              <OwnerProfileRoute />
            </RequireOwner>
          </RequireAdmin>
        )} />
        <Route path="/owner" component={() => (
          <RequireAdmin>
            <RequireOwner>
              <OwnerDashboard />
            </RequireOwner>
          </RequireAdmin>
        )} />
        <Route path="/waitlist" component={WaitlistPage} />
        <Route path="/waitlist/confirmed" component={WaitlistConfirmedPage} />
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}